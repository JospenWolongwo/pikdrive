/*
  # SMS Verification System Setup

  1. New Tables
    - `verification_codes`
      - `id` (uuid, primary key)
      - `phone` (text, the phone number being verified)
      - `code` (text, the 6-digit verification code)
      - `attempts` (int, number of verification attempts)
      - `expires_at` (timestamptz, when the code expires)
      - `created_at` (timestamptz, when the code was created)
      - `verified_at` (timestamptz, when the code was successfully verified)

  2. Security
    - Enable RLS on verification_codes table
    - Add policies for inserting and updating verification codes
    
  3. Functions
    - create_verification: Creates a new verification code
    - verify_code: Verifies a submitted code
*/

-- Create verification codes table
CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  attempts int DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  CONSTRAINT valid_phone CHECK (phone ~ '^(?:\+237|237)?[6-9][0-9]{8}$')
);

-- Enable RLS
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX IF NOT EXISTS idx_verification_codes_created_at ON verification_codes(created_at);

-- Create verification function
CREATE OR REPLACE FUNCTION create_verification(phone_number text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code text;
  new_id uuid;
BEGIN
  -- Generate a random 6-digit code
  new_code := floor(random() * 900000 + 100000)::text;
  
  -- Insert new verification code
  INSERT INTO verification_codes (phone, code, expires_at)
  VALUES (
    phone_number,
    new_code,
    now() + interval '10 minutes'
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Create verification check function
CREATE OR REPLACE FUNCTION verify_code(phone_number text, submitted_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_code verification_codes%ROWTYPE;
BEGIN
  -- Get the latest unverified code for this phone number
  SELECT *
  INTO stored_code
  FROM verification_codes
  WHERE phone = phone_number
    AND verified_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Return false if no valid code found
  IF stored_code IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update attempts
  UPDATE verification_codes
  SET attempts = attempts + 1
  WHERE id = stored_code.id;
  
  -- Check if code matches and hasn't been tried too many times
  IF stored_code.code = submitted_code AND stored_code.attempts < 3 THEN
    -- Mark as verified
    UPDATE verification_codes
    SET verified_at = now()
    WHERE id = stored_code.id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- RLS Policies
CREATE POLICY "Anyone can create verification codes"
  ON verification_codes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "System can update verification codes"
  ON verification_codes
  FOR UPDATE
  USING (true);