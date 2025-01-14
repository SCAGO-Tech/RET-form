/*
  # Grant Applications Schema

  1. New Tables
    - `grant_applications`
      - `id` (uuid, primary key)
      - `applicant_name` (text)
      - `mailing_address` (text)
      - `email` (text)
      - `phone_number` (text)
      - `date_requested` (date)
      - `funds_usage` (text)
      - `previous_grant` (boolean)
      - `previous_grant_usage` (text)
      - `verify_information` (boolean)
      - `created_at` (timestamptz)
      
  2. Security
    - Enable RLS on `grant_applications` table
    - Add policies for authenticated users to:
      - Insert their own applications
      - Read their own applications
*/

CREATE TABLE IF NOT EXISTS grant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_name text NOT NULL,
  mailing_address text NOT NULL,
  email text NOT NULL,
  phone_number text NOT NULL,
  date_requested date NOT NULL,
  funds_usage text,
  previous_grant boolean DEFAULT false,
  previous_grant_usage text,
  verify_information boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE grant_applications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own applications"
  ON grant_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own applications"
  ON grant_applications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create storage bucket for support letters
INSERT INTO storage.buckets (id, name)
VALUES ('support-letters', 'support-letters')
ON CONFLICT DO NOTHING;

-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload support letters"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-letters'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );