-- Insert a test ride
INSERT INTO "public"."rides" (
  "id", 
  "driver_id", 
  "from_city", 
  "to_city", 
  "departure_time", 
  "price", 
  "seats_available", 
  "car_model", 
  "car_color", 
  "car_year", 
  "created_at", 
  "updated_at", 
  "total_seats"
) VALUES (
  '12345678-1234-1234-1234-123456789abc',
  '8821b7c8-53b9-4952-8b38-bcdcc1c27046',
  'Douala',
  'Yaoundé',
  '2025-02-21 09:00:00.000000+00',
  '5000',
  '3',
  'Toyota Corolla',
  'Black',
  '2020',
  '2025-02-20 16:51:00.000000+00',
  '2025-02-20 16:51:00.000000+00',
  '3'
);

-- Insert a test booking
INSERT INTO "public"."bookings" (
  "id",
  "ride_id",
  "user_id",
  "seats",
  "status",
  "payment_status",
  "created_at",
  "updated_at"
) VALUES (
  '98765432-1234-1234-1234-123456789abc',
  '12345678-1234-1234-1234-123456789abc',
  '8821b7c8-53b9-4952-8b38-bcdcc1c27046',
  1,
  'pending',
  'pending',
  '2025-02-20 16:51:00.000000+00',
  '2025-02-20 16:51:00.000000+00'
);
