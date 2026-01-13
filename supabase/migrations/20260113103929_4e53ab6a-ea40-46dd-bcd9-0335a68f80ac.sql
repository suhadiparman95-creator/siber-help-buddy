-- Create settings table
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create helpdesk_info table
CREATE TABLE public.helpdesk_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create knowledge_base table
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'url', 'video')),
  source TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Settings: authenticated users have full access
CREATE POLICY "Authenticated users can view settings" ON public.settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert settings" ON public.settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update settings" ON public.settings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete settings" ON public.settings FOR DELETE USING (auth.role() = 'authenticated');

-- Helpdesk info: authenticated users have full access, anon can read
CREATE POLICY "Anyone can view helpdesk_info" ON public.helpdesk_info FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert helpdesk_info" ON public.helpdesk_info FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update helpdesk_info" ON public.helpdesk_info FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete helpdesk_info" ON public.helpdesk_info FOR DELETE USING (auth.role() = 'authenticated');

-- Knowledge base: authenticated users have full access, anon can read
CREATE POLICY "Anyone can view knowledge_base" ON public.knowledge_base FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert knowledge_base" ON public.knowledge_base FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update knowledge_base" ON public.knowledge_base FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete knowledge_base" ON public.knowledge_base FOR DELETE USING (auth.role() = 'authenticated');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_helpdesk_info_updated_at BEFORE UPDATE ON public.helpdesk_info FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON public.knowledge_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();