# AuroTap role-by-role production audit and supplier portal follow-up — 2026-10-10

## Confirmed from production screenshot and repository
- Supplier dashboard was offline at the time of the screenshot. Dispatch candidates are sourced from `supplier_settings.is_online=true`, valid account state, service radius/location, active-order limits and available stock.
- Existing dispatch engine sends an assigned-order notification after the atomic stock-aware assignment.
- Dashboard uses Supabase Realtime for order updates, but realtime configuration/transport has not been proven from source alone. A 10-second polling fallback and refresh-on-tab-visible were added so a missed websocket event does not leave the visible order list stale indefinitely.
- Supplier settings API now retries up to 25 recent unassigned `PENDING` `water_can` orders created in the last 24 hours when the supplier switches online. Each order still passes through the existing dispatch engine; no bypass of eligibility, location, stock, or concurrency checks is added.
- Supplier API scopes order listing to `orders.supplier_id = authenticated profile id`.
- Existing supplier earnings endpoint depends on RPC `get_supplier_earnings`; verify the function exists in the live Supabase database. The dashboard's completed-order fallback previously used `orders.supplier_payout`; that is not an accounting ledger substitute.
- Payout request endpoint supports explicit UPI/bank methods and records a pending request; it does not transfer funds by itself.

## Branch additions
- Persistent supplier navigation.
- Dedicated supplier Orders, Inventory, Earnings & Payouts, Dispatch Settings, Performance and Support pages, reusing existing authenticated endpoints.
- Orders page clearly explains that it lists assigned orders and links to dispatch settings if empty.
- Inventory page uses the existing supplier stock API and server-side stock checks.
- Earnings page reads the existing earnings RPC and submits payout requests using the existing payout endpoint.
- Settings page toggles online status and updates radius using the existing settings API.
- Support page does not fake a ticket backend.
- Dashboard polls orders/earnings every 10 seconds and refreshes when a background tab becomes visible; realtime remains primary.
- Existing settings API retries pending water orders when the supplier comes online.
- No new database tables or migrations are introduced.

## Verification gates before merge
1. Run lint/typecheck/build CI and resolve all failures.
2. In staging, create a water order while no supplier is online; then bring an eligible supplier online and confirm the order becomes assigned, visible in the dashboard and Orders page, with a notification.
3. Create an order while supplier is online; confirm assignment and instant notification without waiting for polling.
4. Verify Realtime publication includes `orders` and `notifications`, filters/RLS permit the correct supplier to receive only their own events, and no other supplier can read the order.
5. Test stock race conditions, rejection/timeout reassignment, payment confirmation, completed-order earnings, UPI and bank payout requests.
6. Test technician booking scheduling, dispatch, acceptance, status updates and customer tracking independently.
7. Test each route at mobile/desktop widths, browser console/network, and verify private/customer/admin routes remain protected.
8. Validate production schema and RPCs; never apply a migration or change production data without reviewing it first.

## Not claimed as complete
- End-to-end production testing is still required; source edits alone do not prove realtime or order dispatch in the live database.
- Supplier support ticket workflow requires a real backend before it can be represented as operational.
- Payout provider integration and payment settlement are not included.
- Real photo assets are delivered separately as a manual public-assets pack; they must be reviewed/licensed and placed by the user before use.
