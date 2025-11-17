import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get API key from settings
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (apiKeyError || !apiKeyData?.value) {
      console.error('API key error:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'Gemini API key tidak ditemukan. Silakan konfigurasikan di panel admin.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get help desk information
    const { data: helpdeskData, error: helpdeskError } = await supabase
      .from('helpdesk_info')
      .select('content')
      .single();

    if (helpdeskError) {
      console.error('Helpdesk info error:', helpdeskError);
    }

    const helpdeskContext = helpdeskData?.content || 'Tidak ada informasi help desk yang tersedia.';

    // System prompt to keep responses focused on help desk
    const systemPrompt = `Anda adalah asisten Help Desk untuk UPT PJJ (Unit Pelaksana Teknis Pembelajaran Jarak Jauh) di UIN Siber Syekh Nurjati Cirebon. 

Informasi Help Desk:
${helpdeskContext}

PENTING:
- Jawab HANYA pertanyaan yang berkaitan dengan Help Desk UPT PJJ berdasarkan informasi di atas
- Jika pertanyaan di luar konteks Help Desk, jawab dengan sopan: "Maaf, saya hanya dapat membantu menjawab pertanyaan seputar Help Desk UPT PJJ. Apakah ada yang bisa saya bantu terkait layanan help desk kami?"
- Gunakan bahasa yang sopan, profesional, dan ramah
- Berikan jawaban yang jelas dan informatif`;

    // Call Gemini API using the latest stable model
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyData.value}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `User: ${message}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response:', JSON.stringify(geminiData));

    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 
                 'Maaf, terjadi kesalahan dalam memproses permintaan Anda.';

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
