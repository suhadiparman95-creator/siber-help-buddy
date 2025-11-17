-- Fix function search path security warning
ALTER FUNCTION update_updated_at_column() SET search_path = public;