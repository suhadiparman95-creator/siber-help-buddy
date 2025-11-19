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
      .maybeSingle();

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
      .maybeSingle();

    if (helpdeskError) {
      console.error('Helpdesk info error:', helpdeskError);
    }

    const helpdeskContext = helpdeskData?.content || 'Tidak ada informasi help desk yang tersedia.';

    // System prompt to keep responses focused on help desk with web search capability
    const systemPrompt = `Anda adalah asisten Help Desk untuk UPT PJJ (Unit Pelaksana Teknis Pembelajaran Jarak Jauh) di UIN Siber Syekh Nurjati Cirebon. 

Informasi Help Desk Resmi:
${helpdeskContext}

PENTING - Prioritas Informasi:
1. UTAMAKAN informasi dari "Informasi Help Desk Resmi" di atas untuk menjawab pertanyaan
2. Jika informasi tidak tersedia di Help Desk Resmi, Anda dapat mencari informasi dari internet yang relevan dan kredibel
3. Jika ada perbedaan informasi antara Help Desk Resmi dengan informasi dari internet, SELALU prioritaskan informasi dari Help Desk Resmi
4. Sebutkan sumber informasi jika menggunakan informasi dari internet

Pedoman Jawaban:
- Jawab pertanyaan yang berkaitan dengan Help Desk UPT PJJ atau topik terkait pendidikan dan teknologi
- Jika pertanyaan di luar konteks yang wajar, jawab dengan sopan: "Maaf, saya hanya dapat membantu menjawab pertanyaan seputar Help Desk UPT PJJ dan topik terkait. Apakah ada yang bisa saya bantu?"
- Gunakan bahasa yang sopan, profesional, dan ramah
- Berikan jawaban yang jelas, informatif, dan akurat
- JANGAN mengulang sapaan seperti "Halo", "Selamat datang", atau perkenalan di setiap respons
- Langsung jawab pertanyaan dengan natural seperti percakapan biasa
- Hanya sapa di awal percakapan saja, untuk respons selanjutnya langsung ke inti jawaban`;

    // Discover available models dynamically and prefer stable ones
    let available: string[] = [];
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeyData.value}`;
      const listResp = await fetch(listUrl, { method: 'GET' });
      if (listResp.ok) {
        const listJson = await listResp.json();
        const models = listJson.models as Array<{ name: string; supported_generation_methods?: string[] }>;
        available = (models || [])
          .filter(m => (m.supported_generation_methods || []).includes('generateContent'))
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(Boolean);
      } else {
        console.error('Failed to list models:', await listResp.text());
      }
    } catch (e) {
      console.error('Error listing models:', e);
    }

    const preferred = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const orderedCandidates = Array.from(new Set([
      ...preferred.filter(m => available.includes(m)),
      ...available,
      ...preferred, // fallback
    ]));

    let success = false;
    let reply = 'Maaf, terjadi kesalahan dalam memproses permintaan Anda.';
    let lastErr = '';

    for (const model of orderedCandidates) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyData.value}`;
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
          },
          tools: [
            {
              googleSearch: {}
            }
          ]
        })
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        lastErr = `Gemini API error for ${model}: ${errorText}`;
        console.error(lastErr);
        continue;
      }

      const geminiData = await geminiResponse.json();
      reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || reply;
      success = true;
      break;
    }

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Tidak dapat menghubungkan ke Gemini API. ' + (lastErr || '') }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


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
