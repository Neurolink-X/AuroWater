-- Checkout request identity. Deploy this migration BEFORE enabling
-- CHECKOUT_IDEMPOTENCY_DB_ENABLED in the API.
-- Same authenticated customer + request UUID can create at most one order,
-- even across serverless instances and concurrent POST requests.
alter table public.orders
  add column if not exists checkout_request_id uuid;

create unique index if not exists orders_customer_checkout_request_unique_idx
  on public.orders (customer_id, checkout_request_id)
  where checkout_request_id is not null;

comment on column public.orders.checkout_request_id is
  'Opaque client-generated checkout attempt identifier. Unique per customer to make retries safe across instances.';
notify pgrst, 'reload schema';
