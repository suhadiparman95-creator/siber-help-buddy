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

    // Get all knowledge base summaries (more token-efficient than full content)
    const { data: knowledgeData, error: knowledgeError } = await supabase
      .from('knowledge_base')
      .select('title, summary')
      .order('created_at', { ascending: false });

    if (knowledgeError) {
      console.error('Knowledge base error:', knowledgeError);
    }

    // Get helpdesk_info content
    const { data: helpdeskInfoData, error: helpdeskInfoError } = await supabase
      .from('helpdesk_info')
      .select('content')
      .order('created_at', { ascending: false });

    if (helpdeskInfoError) {
      console.error('Helpdesk info error:', helpdeskInfoError);
    }

    // Build context from knowledge base summaries
    let knowledgeContext = '';
    if (knowledgeData && knowledgeData.length > 0) {
      knowledgeContext = knowledgeData
        .map(kb => `${kb.title}:\n${kb.summary}`)
        .join('\n\n---\n\n');
    }

    // Build context from helpdesk info
    let helpdeskInfoContext = '';
    if (helpdeskInfoData && helpdeskInfoData.length > 0) {
      helpdeskInfoContext = helpdeskInfoData
        .map(info => info.content)
        .join('\n\n---\n\n');
    }

    // Combine both contexts
    let helpdeskContext = '';
    if (knowledgeContext || helpdeskInfoContext) {
      helpdeskContext = [
        knowledgeContext ? `=== KNOWLEDGE BASE ===\n${knowledgeContext}` : '',
        helpdeskInfoContext ? `=== KONTEN INFORMASI ===\n${helpdeskInfoContext}` : ''
      ].filter(Boolean).join('\n\n');
    } else {
      helpdeskContext = 'Tidak ada informasi help desk yang tersedia.';
    }

    // Get contact settings
    const { data: contactData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['contact_whatsapp', 'contact_email', 'contact_phone', 'contact_hours']);

    const contacts: Record<string, string> = {};
    if (contactData) {
      contactData.forEach(item => {
        contacts[item.key] = item.value || '';
      });
    }

    const contactWhatsapp = contacts['contact_whatsapp'] || '0812-3456-7890';
    const contactEmail = contacts['contact_email'] || 'uptpjj@uinssc.ac.id';
    const contactPhone = contacts['contact_phone'] || '(0231) 123456';
    const contactHours = contacts['contact_hours'] || 'Senin-Jumat, 08.00-16.00 WIB';

    // System prompt to keep responses focused on help desk with web search capability
    const systemPrompt = `Anda adalah asisten Help Desk untuk UPT PJJ (Unit Pelaksana Teknis Pembelajaran Jarak Jauh) di UIN Siber Syekh Nurjati Cirebon. 

Informasi Help Desk Resmi:
${helpdeskContext}

PENTING - Konteks Utama UPT PJJ:
- Anda FOKUS UTAMA pada informasi tentang UPT PJJ UIN Siber Syekh Nurjati Cirebon
- Ketika pengguna bertanya tanpa menyebutkan institusi spesifik, DEFAULT-nya adalah tentang UPT PJJ:
  * "ada jurusan apa saja?" → Jurusan di UPT PJJ
  * "kapan pendaftaran?" → Pendaftaran UPT PJJ
  * "bagaimana cara daftar?" → Cara daftar UPT PJJ
  * "berapa biayanya?" → Biaya di UPT PJJ
  
- HANYA jika pengguna EKSPLISIT menyebutkan institusi lain, jawab tentang institusi tersebut:
  * "jurusan di UIN SSC" → Semua jurusan UIN Siber Syekh Nurjati Cirebon (bukan hanya UPT PJJ)
  * "fakultas di UIN Cirebon" → Informasi umum tentang UIN
  * "prodi di kampus X" → Informasi tentang kampus X

PENTING - Prioritas Informasi:
1. UTAMAKAN informasi dari "Informasi Help Desk Resmi" di atas (Knowledge Base dan Konten Informasi) untuk menjawab pertanyaan
2. Jika informasi tidak tersedia di Help Desk Resmi:
   - Untuk pertanyaan umum (tanpa institusi spesifik): fokus cari tentang UPT PJJ
   - Untuk pertanyaan dengan institusi eksplisit: cari tentang institusi tersebut
3. Jika ada perbedaan informasi antara Help Desk Resmi dengan informasi dari internet, SELALU prioritaskan informasi dari Help Desk Resmi
4. Sebutkan sumber informasi jika menggunakan informasi dari internet

PENTING - Informasi Kontak Bantuan:
Jika Anda tidak dapat menjawab pertanyaan dengan yakin atau pertanyaan memerlukan penanganan langsung dari tim, SELALU sertakan informasi kontak berikut di akhir jawaban:

📞 **Hubungi Kami untuk Bantuan Lebih Lanjut:**
- WhatsApp: ${contactWhatsapp}
- Email: ${contactEmail}
- Telepon: ${contactPhone}
- Jam Operasional: ${contactHours}

Gunakan informasi kontak ini ketika:
- Pertanyaan teknis yang kompleks (masalah login, error sistem, dll)
- Pertanyaan administratif yang memerlukan verifikasi data
- Keluhan atau masalah yang perlu ditangani langsung
- Informasi yang tidak tersedia dalam knowledge base

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
