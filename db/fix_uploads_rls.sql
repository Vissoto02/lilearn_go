-- ============================================================================
-- FIX UPLOADS TABLE RLS POLICY
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can update own pending uploads" ON uploads;

-- Create a more permissive policy that allows users to update their own uploads
-- regardless of status (they own the record, they should be able to update it)
CREATE POLICY "Users can update own uploads" ON uploads
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: Service role (n8n) bypasses RLS automatically, so it can update any status
