-- Additive bridge from legacy free-text service_zones.city to canonical public.cities.
-- Keep city text for existing dispatch, booking and serviceability code until their
-- reads have been migrated. Unknown expansion/pilot cities remain unlinked and visible.
alter table public.service_zones
  add column if not exists city_id uuid references public.cities(id) on delete restrict;

create index if not exists service_zones_city_id_idx on public.service_zones(city_id);

update public.service_zones as zone
set city_id = canonical.id
from public.cities as canonical
where zone.city_id is null
  and lower(btrim(zone.city)) = lower(btrim(canonical.name));

-- Do not force NOT NULL: pilot cities outside the canonical directory must
-- remain visible rather than creating inaccurate operational city records.
