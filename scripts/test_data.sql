-- First, get the current user's ID
DO $$ 
DECLARE
    current_user_id UUID;
BEGIN
    -- Get the current user's ID from profiles
    SELECT id INTO current_user_id
    FROM public.profiles
    LIMIT 1;

    -- Insert a test ride
    INSERT INTO public.rides (
      id,
      driver_id,
      from_city,
      to_city,
      departure_time,
      price,
      seats_available,
      total_seats,
      car_model,
      car_color,
      car_year,
      created_at
    ) VALUES (
      gen_random_uuid(),
      current_user_id,
      'Douala',
      'Yaoundé',
      NOW() + interval '1 day',
      5000,
      3,
      4,
      'Toyota Corolla',
      'Black',
      2020,
      NOW()
    );

    -- Insert a test booking
    INSERT INTO public.bookings (
      id,
      ride_id,
      user_id,
      seats,
      status,
      created_at
    ) 
    SELECT 
      gen_random_uuid(),
      r.id,
      current_user_id,
      1,
      'confirmed',
      NOW()
    FROM public.rides r
    WHERE r.driver_id = current_user_id
    ORDER BY r.created_at DESC
    LIMIT 1;

    -- Insert test messages
    WITH latest_booking AS (
      SELECT b.ride_id, b.user_id
      FROM public.bookings b
      WHERE b.user_id = current_user_id
      ORDER BY b.created_at DESC
      LIMIT 1
    )
    INSERT INTO public.messages (
      id,
      ride_id,
      sender_id,
      receiver_id,
      content,
      read,
      created_at
    )
    SELECT
      gen_random_uuid(),
      ride_id,
      user_id,
      user_id,
      'Hi, I would like to confirm my booking.',
      false,
      NOW()
    FROM latest_booking
    UNION ALL
    SELECT
      gen_random_uuid(),
      ride_id,
      user_id,
      user_id,
      'What time should I arrive at the pickup point?',
      false,
      NOW() + interval '1 minute'
    FROM latest_booking;

    RAISE NOTICE 'Successfully created test data for user %', current_user_id;
END $$;
