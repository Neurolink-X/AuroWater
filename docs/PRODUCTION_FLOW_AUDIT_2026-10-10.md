# Production Flow Audit — October 10, 2026

## Confirmed issues from production evidence
- `POST /api/geocode/reverse` returns 405 for existing clients. The route previously only exported GET despite the API client sending POST. A backward-compatible POST handler was added and maps the body coordinates into the authenticated GET flow.
- Supplier dashboard queried `public.supplier_earnings`, but the live PostgREST error confirms that table does not exist. Dashboard earnings now read completed supplier orders from the canonical `orders` table and use `supplier_payout`.
- Supplier realtime handler refreshed orders but not earnings. Order changes now refresh both; notification subscriptions are scoped to the authenticated supplier user ID.
- Screenshot shows supplier dispatch status Offline. The dispatch engine only offers orders to eligible online suppliers, so an offline supplier should not expect new order offers. Turn Online and verify active location, radius, stock and approved/active account.
- Dashboard currently has Active Orders and History tabs within the dashboard; repository route inventory shows no separate supplier subpages beyond the dashboard. A separate premium multi-page navigation experience remains a planned implementation, not something to claim as already complete.
- The generated marketing artwork is an original SVG illustration added locally to the public marketing assets; it is not a licensed photo.

## Scope of this branch
- Preserve POST reverse-geocode compatibility.
- Remove dependency on nonexistent `supplier_earnings` table.
- Refresh supplier orders and earnings from realtime order changes.
- Scope notification realtime listener to the supplier.
- Add original supplier/service-team marketing SVG.
- This branch has not yet been built or deployed. Validate lint, typecheck, build, live API response, realtime delivery and staging booking lifecycle before merging.

## Required end-to-end checks
1. POST reverse geocode with valid authenticated session; confirm 200 and expected legacy response fields.
2. Supplier goes online; verify `supplier_settings.is_online=true`, coordinates, radius and stock.
3. Create a customer water-can order with a valid scheduled slot; verify order supplier assignment, notification, order visibility and realtime update.
4. Create a plumbing/RO booking; verify technician assignment, scheduled date/time, technician job list and notification.
5. Verify realtime order status changes refresh customer, supplier and technician pages.
6. Confirm supplier earnings only increase from completed eligible orders and do not rely on a missing table.
7. Check all dashboard controls, browser console, Network panel and mobile layout.
