TRUNCATE TABLE IF EXISTS
  meter_readings,
  bank_transactions,
  units,
  tenants,
  properties
RESTART IDENTITY CASCADE;
