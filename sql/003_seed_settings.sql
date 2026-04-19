-- Default platform settings + service catalogue
-- Idempotent

INSERT INTO public.service_types (key, name, description, base_price, unit, is_active, sort_order) VALUES
  ('water_can', 'Water Can (20L)', 'RO-purified BIS-certified 20L sealed water cans.', 12, 'per can', true, 1),
  ('water_tanker', 'Water Tanker', 'Bulk water delivery via tanker.', 299, 'per delivery', true, 2),
  ('ro_service', 'RO Service & Repair', 'RO purifier service, filter change, AMC.', 199, 'per visit', true, 3),
  ('plumbing', 'Plumbing', 'Pipe fitting, leakage repair, installation.', 149, 'per visit', true, 4),
  ('borewell', 'Borewell Services', 'Borewell drilling, repair, motor fitting.', 499, 'per service', true, 5),
  ('motor_pump', 'Motor & Pump Repair', 'Submersible motor repair, pump installation.', 249, 'per visit', true, 6),
  ('tank_cleaning', 'Water Tank Cleaning', 'Overhead/underground tank cleaning.', 349, 'per tank', true, 7)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES
  ('default_can_price',        '12'),
  ('subscription_can_price',   '10'),
  ('bulk_can_price',           '9'),
  ('bulk_threshold',           '50'),
  ('market_can_price',         '20'),
  ('water_tanker_price',       '299'),
  ('ro_service_price',         '199'),
  ('plumbing_price',           '149'),
  ('borewell_price',           '499'),
  ('motor_pump_price',         '249'),
  ('tank_cleaning_price',      '349'),
  ('convenience_fee',          '29'),
  ('emergency_surcharge',      '199'),
  ('gst_rate',                 '18'),
  ('bulk_commission',          '8'),
  ('technician_commission',    '50'),
  ('supplier_commission',      '30'),
  ('support_email',            'support.aurotap@gmail.com'),
  ('secondary_email',          'aurotap@gmail.com'),
  ('phone_primary',            '9889305803'),
  ('phone_secondary',          ''),
  ('office_address',           'Kanpur, Uttar Pradesh'),
  ('working_hours',            '09:00–21:00 IST'),
  ('brand_name',               'Auro Water'),
  ('whatsapp_enabled',         '1'),
  ('service_base_prices',      '{"water_tanker":299,"ro_service":199,"plumbing":149,"borewell":499,"motor_pump":249,"tank_cleaning":349}')
ON CONFLICT (key) DO NOTHING;
