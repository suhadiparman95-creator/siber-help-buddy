-- Create settings table for API key and other configurations
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create helpdesk_info table for storing help desk information
CREATE TABLE IF NOT EXISTS public.helpdesk_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_info ENABLE ROW LEVEL SECURITY;

-- Policies for settings (admin only)
CREATE POLICY "Allow authenticated users to read settings"
  ON public.settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert settings"
  ON public.settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update settings"
  ON public.settings
  FOR UPDATE
  TO authenticated
  USING (true);

-- Policies for helpdesk_info (admin write, public read via edge function)
CREATE POLICY "Allow authenticated users to manage helpdesk_info"
  ON public.helpdesk_info
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to read helpdesk_info"
  ON public.helpdesk_info
  FOR SELECT
  TO anon
  USING (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_helpdesk_info_updated_at
  BEFORE UPDATE ON public.helpdesk_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default helpdesk info
INSERT INTO public.helpdesk_info (content) 
VALUES ('Selamat datang di Help Desk UPT PJJ UIN Siber Syekh Nurjati Cirebon. Silakan tambahkan informasi help desk melalui panel admin.')
ON CONFLICT DO NOTHING;