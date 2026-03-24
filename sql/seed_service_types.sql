-- Seed service_types for AuroWater (run after schema.sql).
-- Ensures the booking wizard Step 2 has services to display.
-- Usage: psql -d your_database -f sql/seed_service_types.sql

INSERT INTO service_types (name, description, base_price, is_active)
VALUES
  ('WATER_SUPPLY', 'Tankered water supply and delivery to your address', 500.00, true),
  ('SUBMERSIBLE_INSTALLATION', 'Submersible pump installation and setup', 3500.00, true),
  ('REPAIR_MAINTENANCE', 'Repair and maintenance of pumps and water systems', 800.00, true)
ON CONFLICT (name) DO NOTHING;
