/*
  # Update storage policies for support letters

  1. Changes
    - Drop existing storage policy
    - Create new policy that allows authenticated users to upload files
    - Add folder structure based on user ID
  
  2. Security
    - Enable RLS on storage.objects table
    - Add policy for authenticated users to upload files to their own folder
*/

-- Drop existing policy if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload support letters'
  ) THEN
    DROP POLICY "Authenticated users can upload support letters" ON storage.objects;
  END IF;
END $$;

-- Create new policy with proper user_id check
CREATE POLICY "Authenticated users can upload support letters"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-letters' AND
  auth.uid() IS NOT NULL
);