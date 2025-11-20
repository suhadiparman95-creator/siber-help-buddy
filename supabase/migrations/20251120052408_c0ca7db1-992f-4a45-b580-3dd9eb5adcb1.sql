-- Update the check constraint on knowledge_base.source_type to allow website and video
ALTER TABLE public.knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_source_type_check;

ALTER TABLE public.knowledge_base 
ADD CONSTRAINT knowledge_base_source_type_check 
CHECK (source_type IN ('pdf', 'website', 'video'));