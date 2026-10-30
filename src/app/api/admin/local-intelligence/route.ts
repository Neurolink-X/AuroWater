// src/app/api/admin/local-intelligence/route.ts
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import {
  isDispatchEligibleSupplier,
  normalizePincode,
  summarizeLocalDemand,
  summarizeSupplierOutcomes,
  type ServiceZone,
  type SupplierProfile,
  type SupplierZoneLink,
} from '@/lib/local-intelligence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 90;
const MAX_ORDERS = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Row limits for each table. If a table reaches its limit, we warn the admin. */
const LIMITS = {
  profiles: 5000,
  supplierZones: 10000,
  serviceZones: 5000,
  stock: 5000,
} as const;

/** Reads ?days= safely. Bad input falls back to 30, big input is capped at 90. */
function parseWindowDays(raw: string | null): number {
  if (raw === null || raw.trim() === '') return DEFAULT_WINDOW_DAYS;

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) return DEFAULT_WINDOW_DAYS;

  return Math.min(value, MAX_WINDOW_DAYS);
}

/** A number that is never negative and never NaN. Missing data stays null. */
function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = await requireSupabaseAuth(req);
    if (!auth.ok) return auth.response;
    if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

    const url = new URL(req.url);
    const windowDays = parseWindowDays(url.searchParams.get('days'));
    const since = new Date(Date.now() - windowDays * DAY_MS).toISOString();
    const db = createServiceClient();

    /*
     * All 5 database questions are asked AT THE SAME TIME.
     * Before: orders first, then the other 4 (two waits).
     * Now: one wait. The page opens faster.
     */
    const [ordersResult, profilesResult, linksResult, zonesResult, stockResult, addressesResult] =
      await Promise.all([
        db
          .from('orders')
          .select(
            'id, created_at, status, supplier_id, customer_id, rating, total_amount, service_type, address, address_snapshot',
          )
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(MAX_ORDERS),
        db
          .from('profiles')
          .select('*') // Optional profile columns vary across deployed schemas.
          .eq('role', 'supplier')
          .limit(LIMITS.profiles),
        db
          .from('supplier_zones')
          .select('supplier_id, zone_id, service_keys')
          .limit(LIMITS.supplierZones),
        db
          .from('service_zones')
          .select('id, city, name, status, pincodes')
          .limit(LIMITS.serviceZones),
        db
          .from('supplier_stock')
          .select(
            'supplier_id, cans_available, reserved_cans, reservation_buffer_cans, low_stock_alert',
          )
          .limit(LIMITS.stock),
        db
          .from('addresses')
          .select('customer_id, pincode, city')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(MAX_ORDERS),
      ]);

    // Orders are the heart of this report. Without them we stop.
    if (ordersResult.error) {
      console.error('[admin/local-intelligence] order query failed', {
        code: ordersResult.error.code,
        message: ordersResult.error.message,
      });
      return jsonErr('Local demand data is temporarily unavailable.', 503);
    }

    const orders = ordersResult.data ?? [];
    const profileRows = (profilesResult.data ?? []) as SupplierProfile[];
    const linkRows = (linksResult.data ?? []) as SupplierZoneLink[];
    const zoneRows = (zonesResult.data ?? []) as ServiceZone[];
    const stockRows = stockResult.data ?? [];

    /* ---------------------------------------------------------
       WARNINGS: tell the admin when numbers may be incomplete
       --------------------------------------------------------- */
    const warnings: string[] = [];

    if (profilesResult.error) {
      console.error(
        '[admin/local-intelligence] supplier profiles unavailable',
        profilesResult.error.code,
      );
      warnings.push(
        'Supplier verification data unavailable; coverage counts are incomplete.',
      );
    }
    if (linksResult.error) {
      console.error(
        '[admin/local-intelligence] supplier-zone mappings unavailable',
        linksResult.error.code,
      );
      warnings.push(
        'Supplier-area mappings unavailable; coverage-gap signals are incomplete.',
      );
    }
    if (zonesResult.error) {
      console.error(
        '[admin/local-intelligence] service zones unavailable',
        zonesResult.error.code,
      );
      warnings.push(
        'Service-zone status unavailable; coverage-gap signals are incomplete.',
      );
    }
    if (stockResult.error) {
      console.error(
        '[admin/local-intelligence] supplier stock unavailable',
        stockResult.error.code,
      );
      warnings.push(
        'Supplier stock data unavailable; stock counts are not reliable for this report.',
      );
    }
    if (addressesResult.error) {
      console.error(
        '[admin/local-intelligence] saved address demand unavailable',
        addressesResult.error.code,
      );
      warnings.push(
        'Saved-address demand signals are unavailable; PIN-code interest may be understated.',
      );
    }

    // Future-proof: if a table grows past its limit, say so instead of
    // silently showing smaller numbers.
    const truncated = {
      orders: orders.length >= MAX_ORDERS,
      profiles: profileRows.length >= LIMITS.profiles,
      supplierZones: linkRows.length >= LIMITS.supplierZones,
      serviceZones: zoneRows.length >= LIMITS.serviceZones,
      stock: stockRows.length >= LIMITS.stock,
      addresses: (addressesResult.data ?? []).length >= MAX_ORDERS,
    };

    if (truncated.profiles || truncated.supplierZones || truncated.serviceZones) {
      warnings.push(
        'Supplier or zone data reached its safe row limit; coverage counts may be understated.',
      );
    }
    if (truncated.stock) {
      warnings.push(
        'Stock data reached its safe row limit; stock totals may be understated.',
      );
    }
    if (truncated.addresses) {
      warnings.push(
        'Saved-address demand reached its safe row limit; PIN-code interest may be understated.',
      );
    }

    /* ---------------------------------------------------------
       LOOKUP TABLES (built once, used many times)
       --------------------------------------------------------- */
    const eligibleSupplierIds = new Set(
      profileRows.filter(isDispatchEligibleSupplier).map((p) => String(p.id)),
    );
    const profilesById = new Map(
      (profilesResult.data ?? []).map((profile) => [String(profile.id), profile]),
    );
    const stockById = new Map(
      stockRows.map((stock) => [String(stock.supplier_id), stock]),
    );
    const zonesById = new Map(zoneRows.map((zone) => [String(zone.id), zone]));

    /* ---------------------------------------------------------
       COVERAGE: how many ready suppliers serve each pincode
       --------------------------------------------------------- */
    const mappedSupplierCountByPincode = new Map<string, number>();
    const supplierPinsById = new Map<string, Set<string>>();
    const seenSupplierPin = new Set<string>();

    for (const link of linkRows) {
      const supplierId = String(link.supplier_id);
      if (!eligibleSupplierIds.has(supplierId)) continue;

      const zone = zonesById.get(String(link.zone_id));
      if (!zone) continue;

      const zoneStatus = String(zone.status ?? '').trim().toUpperCase();
      // Coverage is only operational when the admin marked the zone Available/Limited.
      if (zoneStatus !== 'AVAILABLE' && zoneStatus !== 'LIMITED') continue;

      const zonePins = Array.isArray(zone.pincodes) ? zone.pincodes : [];

      for (const rawPin of zonePins) {
        const pincode = normalizePincode(rawPin);
        if (!pincode) continue;

        let supplierPins = supplierPinsById.get(supplierId);
        if (!supplierPins) {
          supplierPins = new Set<string>();
          supplierPinsById.set(supplierId, supplierPins);
        }
        supplierPins.add(pincode);

        // Count each supplier only once per pincode.
        const key = `${supplierId}:${pincode}`;
        if (seenSupplierPin.has(key)) continue;
        seenSupplierPin.add(key);

        mappedSupplierCountByPincode.set(
          pincode,
          (mappedSupplierCountByPincode.get(pincode) ?? 0) + 1,
        );
      }
    }

    /* ---------------------------------------------------------
       STOCK: how many cans each ready supplier can really send
       Example: 40 available - 10 reserved - 5 buffer = 25 dispatchable
       --------------------------------------------------------- */
    const stockBySupplier = [...eligibleSupplierIds]
      .map((supplierId) => {
        const profile = profilesById.get(supplierId);
        const stock = stockById.get(supplierId);

        const cansAvailable = stock ? toCount(stock.cans_available) : null;
        const reservedCans = stock ? toCount(stock.reserved_cans) : null;
        const bufferCans = stock ? toCount(stock.reservation_buffer_cans) : null;
        const lowStockAlert = stock ? toCount(stock.low_stock_alert) : null;

        const dispatchableCans =
          cansAvailable === null
            ? null
            : Math.max(0, cansAvailable - (reservedCans ?? 0) - (bufferCans ?? 0));

        return {
          supplierId,
          supplierName: String(
            profile?.business_name ?? profile?.full_name ?? 'Supplier',
          ),
          city: String(profile?.city ?? ''),
          pincodes: [...(supplierPinsById.get(supplierId) ?? new Set<string>())].sort(),
          cansAvailable,
          reservedCans,
          bufferCans,
          dispatchableCans,
          lowStock:
            cansAvailable !== null && lowStockAlert !== null
              ? cansAvailable <= lowStockAlert
              : null,
          stockConfigured: Boolean(stock),
        };
      })
      .sort(
        (a, b) =>
          (b.dispatchableCans ?? -1) - (a.dispatchableCans ?? -1) ||
          a.supplierName.localeCompare(b.supplierName),
      );

    const stockDataAvailable = !stockResult.error && !profilesResult.error;

    const sumOf = (pick: (row: (typeof stockBySupplier)[number]) => number | null) =>
      stockDataAvailable
        ? stockBySupplier.reduce((sum, row) => sum + (pick(row) ?? 0), 0)
        : null;

    const stockSummary = {
      dataAvailable: stockDataAvailable,
      eligibleSuppliers: eligibleSupplierIds.size,
      suppliersWithStockRecord: stockBySupplier.filter((r) => r.stockConfigured).length,
      suppliersWithUsableStock: stockBySupplier.filter((r) => (r.dispatchableCans ?? 0) > 0).length,
      lowStockSuppliers: stockBySupplier.filter((r) => r.lowStock === true).length,
      totalCansAvailable: sumOf((r) => r.cansAvailable),
      totalReservedCans: sumOf((r) => r.reservedCans),
      totalBufferCans: sumOf((r) => r.bufferCans),
    };

    /* ---------------------------------------------------------
       DEMAND + SUPPLIER RESULTS
       --------------------------------------------------------- */
    const supplierInfo = new Map(
      [...profilesById.entries()].map(([id, profile]) => [
        id,
        {
          name: String(profile.business_name || profile.full_name || 'Supplier'),
          city: String(profile.city ?? ''),
        },
      ]),
    );

    const supplierOutcomes = summarizeSupplierOutcomes(
      orders.map((order) => ({
        supplier_id: order.supplier_id,
        status: order.status,
        rating: order.rating,
      })),
      supplierInfo,
    );

    const summary = summarizeLocalDemand(
      orders.map((order) => ({
        id: order.id,
        created_at: order.created_at,
        status: order.status,
        supplier_id: order.supplier_id,
        customer_id: order.customer_id,
        rating: order.rating,
        total_amount: order.total_amount,
        service_type: order.service_type,
        address: order.address,
        address_snapshot: order.address_snapshot,
      })),
      mappedSupplierCountByPincode,
      windowDays,
    );

    // Saved addresses are demand signals even before a customer places an order.
    // Aggregate only counts by PIN; never return customer IDs or street addresses.
    const savedDemandByPin = new Map<string, { city: string; addresses: number; customers: Set<string> }>();
    for (const address of addressesResult.data ?? []) {
      const pincode = normalizePincode(address.pincode);
      if (!pincode) continue;
      const row = savedDemandByPin.get(pincode) ?? {
        city: String(address.city ?? 'Unknown'),
        addresses: 0,
        customers: new Set<string>(),
      };
      row.addresses += 1;
      if (address.customer_id) row.customers.add(String(address.customer_id));
      savedDemandByPin.set(pincode, row);
    }

    const demandRows = new Map(summary.demandByPincode.map((row) => [row.pincode, row]));
    for (const [pincode, saved] of savedDemandByPin) {
      const existing = demandRows.get(pincode);
      const mappedSuppliers = existing?.mappedSuppliers ?? mappedSupplierCountByPincode.get(pincode) ?? 0;
      demandRows.set(pincode, {
        pincode,
        city: existing?.city && existing.city !== 'Unknown' ? existing.city : saved.city,
        orders: existing?.orders ?? 0,
        cancelled: existing?.cancelled ?? 0,
        cancellationRate: existing?.cancellationRate ?? 0,
        assignedOrders: existing?.assignedOrders ?? 0,
        unassignedOrders: existing?.unassignedOrders ?? 0,
        mappedSuppliers,
        coverageGap: Boolean(existing?.coverageGap) || (saved.addresses >= 3 && mappedSuppliers < 2),
        savedAddresses: saved.addresses,
        interestedCustomers: saved.customers.size,
      });
    }
    summary.demandByPincode = [...demandRows.values()].sort(
      (a, b) => (b.orders + (b.savedAddresses ?? 0)) - (a.orders + (a.savedAddresses ?? 0))
        || a.pincode.localeCompare(b.pincode),
    );

    const response = jsonOk({
      ...summary,
      dataLimited: truncated.orders,
      source: 'orders + current supplier eligibility + coverage mappings + stock records',
      stockSummary,
      stockBySupplier,
      supplierOutcomes,
      timezone: 'Asia/Kolkata',
      warnings,
      generatedAt: new Date().toISOString(),
      // NEW: extra details. Old fields above are unchanged.
      meta: {
        windowDays,
        since,
        ordersAnalysed: orders.length,
        partial: warnings.length > 0,
        truncated,
        queryMs: Date.now() - startedAt,
      },
    });

    // Admin numbers must always be fresh and never stored by a shared cache.
    if (response instanceof Response) {
      response.headers.set('Cache-Control', 'private, no-store, max-age=0');
      response.headers.set(
        'Server-Timing',
        `total;dur=${Date.now() - startedAt}`,
      );
    }

    return response;
  } catch (error) {
    // One safe message for the admin, full detail only in the server log.
    console.error('[admin/local-intelligence] unexpected failure', error);
    return jsonErr('Local demand data is temporarily unavailable.', 500);
  }
}









// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
// import { createServiceClient } from '@/utils/supabase/server';
// import {
//   isDispatchEligibleSupplier,
//   normalizePincode,
//   summarizeLocalDemand,
//   summarizeSupplierOutcomes,
//   type ServiceZone,
//   type SupplierProfile,
//   type SupplierZoneLink,
// } from '@/lib/local-intelligence';

// export const dynamic = 'force-dynamic';
// export const runtime = 'nodejs';

// const WINDOW_DAYS = 30;
// const MAX_ORDERS = 1000;

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

//   const url = new URL(req.url);
//   const rawDays = Number(url.searchParams.get('days') ?? WINDOW_DAYS);
//   const windowDays = Number.isInteger(rawDays) && rawDays > 0 ? Math.min(rawDays, 90) : WINDOW_DAYS;
//   const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
//   const db = createServiceClient();

//   const ordersResult = await db
//     .from('orders')
//     .select('id, created_at, status, supplier_id, customer_id, rating, total_amount, service_type, address, address_snapshot')
//     .gte('created_at', since)
//     .order('created_at', { ascending: false })
//     .limit(MAX_ORDERS);

//   if (ordersResult.error) {
//     console.error('[admin/local-intelligence] order query failed', {
//       code: ordersResult.error.code,
//       message: ordersResult.error.message,
//     });
//     return jsonErr('Local demand data is temporarily unavailable.', 503);
//   }

//   const [profilesResult, linksResult, zonesResult, stockResult] = await Promise.all([
//     db.from('profiles')
//       .select('*') // Optional profile columns vary across deployed schemas.
//       .eq('role', 'supplier')
//       .limit(5000),
//     db.from('supplier_zones').select('supplier_id, zone_id, service_keys').limit(10000),
//     db.from('service_zones').select('id, city, name, status, pincodes').limit(5000),
//     db.from('supplier_stock').select('supplier_id, cans_available, reserved_cans, reservation_buffer_cans, low_stock_alert').limit(5000),
//   ]);

//   const warnings: string[] = [];
//   if (profilesResult.error) {
//     console.error('[admin/local-intelligence] supplier profiles unavailable', profilesResult.error.code);
//     warnings.push('Supplier verification data unavailable; coverage counts are incomplete.');
//   }
//   if (linksResult.error) {
//     console.error('[admin/local-intelligence] supplier-zone mappings unavailable', linksResult.error.code);
//     warnings.push('Supplier-area mappings unavailable; coverage-gap signals are incomplete.');
//   }
//   if (zonesResult.error) {
//     console.error('[admin/local-intelligence] service zones unavailable', zonesResult.error.code);
//     warnings.push('Service-zone status unavailable; coverage-gap signals are incomplete.');
//   }
//   if (stockResult.error) {
//     console.error('[admin/local-intelligence] supplier stock unavailable', stockResult.error.code);
//     warnings.push('Supplier stock data unavailable; stock counts are not reliable for this report.');
//   }

//   const eligibleSupplierIds = new Set(
//     ((profilesResult.data ?? []) as SupplierProfile[])
//       .filter(isDispatchEligibleSupplier)
//       .map((profile) => String(profile.id)),
//   );
//   const profilesById = new Map((profilesResult.data ?? []).map((profile) => [String(profile.id), profile]));
//   const stockById = new Map((stockResult.data ?? []).map((stock) => [String(stock.supplier_id), stock]));
//   const zonesById = new Map(
//     ((zonesResult.data ?? []) as ServiceZone[]).map((zone) => [String(zone.id), zone]),
//   );
//   const mappedSupplierCountByPincode = new Map<string, number>();
//   const supplierPinsById = new Map<string, Set<string>>();
//   const seenSupplierPin = new Set<string>();

//   for (const link of (linksResult.data ?? []) as SupplierZoneLink[]) {
//     const supplierId = String(link.supplier_id);
//     if (!eligibleSupplierIds.has(supplierId)) continue;
//     const zone = zonesById.get(String(link.zone_id));
//     if (!zone) continue;
//     const zoneStatus = String(zone.status ?? '').trim().toUpperCase();
//     // Coverage is only considered operational when the admin has marked the zone Available/Limited.
//     if (!['AVAILABLE', 'LIMITED'].includes(zoneStatus)) continue;
//     const zonePins = Array.isArray(zone.pincodes) ? zone.pincodes : [];
//     for (const rawPin of zonePins) {
//       const pincode = normalizePincode(rawPin);
//       if (!pincode) continue;
//       const key = `${supplierId}:${pincode}`;
//       const supplierPins = supplierPinsById.get(supplierId) ?? new Set<string>();
//       supplierPins.add(pincode);
//       supplierPinsById.set(supplierId, supplierPins);
//       if (seenSupplierPin.has(key)) continue;
//       seenSupplierPin.add(key);
//       mappedSupplierCountByPincode.set(
//         pincode,
//         (mappedSupplierCountByPincode.get(pincode) ?? 0) + 1,
//       );
//     }
//   }

//   const stockBySupplier = [...eligibleSupplierIds].map((supplierId) => {
//     const profile = profilesById.get(supplierId);
//     const stock = stockById.get(supplierId);
//     const cansAvailable = stock ? Math.max(0, Number(stock.cans_available) || 0) : null;
//     const reservedCans = stock ? Math.max(0, Number(stock.reserved_cans) || 0) : null;
//     const bufferCans = stock ? Math.max(0, Number(stock.reservation_buffer_cans) || 0) : null;
//     const dispatchableCans = cansAvailable === null ? null : Math.max(0, cansAvailable - (reservedCans ?? 0) - (bufferCans ?? 0));
//     const lowStockAlert = stock ? Math.max(0, Number(stock.low_stock_alert) || 0) : null;
//     return {
//       supplierId,
//       supplierName: String(profile?.business_name ?? profile?.full_name ?? 'Supplier'),
//       city: String(profile?.city ?? ''),
//       pincodes: [...(supplierPinsById.get(supplierId) ?? new Set<string>())].sort(),
//       cansAvailable,
//       reservedCans,
//       bufferCans,
//       dispatchableCans,
//       lowStock: cansAvailable !== null && lowStockAlert !== null ? cansAvailable <= lowStockAlert : null,
//       stockConfigured: Boolean(stock),
//     };
//   }).sort((a, b) => (b.dispatchableCans ?? -1) - (a.dispatchableCans ?? -1) || a.supplierName.localeCompare(b.supplierName));

//   const stockDataAvailable = !stockResult.error && !profilesResult.error;
//   const stockSummary = {
//     dataAvailable: stockDataAvailable,
//     eligibleSuppliers: eligibleSupplierIds.size,
//     suppliersWithStockRecord: stockBySupplier.filter((row) => row.stockConfigured).length,
//     suppliersWithUsableStock: stockBySupplier.filter((row) => (row.dispatchableCans ?? 0) > 0).length,
//     lowStockSuppliers: stockBySupplier.filter((row) => row.lowStock === true).length,
//     totalCansAvailable: !stockDataAvailable ? null : stockBySupplier.reduce((sum, row) => sum + (row.cansAvailable ?? 0), 0),
//     totalReservedCans: !stockDataAvailable ? null : stockBySupplier.reduce((sum, row) => sum + (row.reservedCans ?? 0), 0),
//     totalBufferCans: !stockDataAvailable ? null : stockBySupplier.reduce((sum, row) => sum + (row.bufferCans ?? 0), 0),
//   };

//   const supplierInfo = new Map([...profilesById.entries()].map(([id, profile]) => [id, {
//     name: String(profile.business_name || profile.full_name || 'Supplier'),
//     city: String(profile.city ?? ''),
//   }]));
//   const supplierOutcomes = summarizeSupplierOutcomes(
//     (ordersResult.data ?? []).map((order) => ({ supplier_id: order.supplier_id, status: order.status, rating: order.rating })),
//     supplierInfo,
//   );

//   const summary = summarizeLocalDemand(
//     (ordersResult.data ?? []).map((order) => ({
//       id: order.id,
//       created_at: order.created_at,
//       status: order.status,
//       supplier_id: order.supplier_id,
//       customer_id: order.customer_id,
//       rating: order.rating,
//       total_amount: order.total_amount,
//       service_type: order.service_type,
//       address: order.address,
//       address_snapshot: order.address_snapshot,
//     })),
//     mappedSupplierCountByPincode,
//     windowDays,
//   );

//   return jsonOk({
//     ...summary,
//     dataLimited: (ordersResult.data?.length ?? 0) >= MAX_ORDERS,
//     source: 'orders + current supplier eligibility + coverage mappings + stock records',
//     stockSummary,
//     stockBySupplier,
//     supplierOutcomes,
//     timezone: 'Asia/Kolkata',
//     warnings,
//     generatedAt: new Date().toISOString(),
//   });
// }
