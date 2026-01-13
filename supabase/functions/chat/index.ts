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

    // Get Lovable AI API key
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI API key tidak dikonfigurasi.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all knowledge base summaries
    const { data: knowledgeData, error: knowledgeError } = await supabase
      .from('knowledge_base')
      .select('source, summary')
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
        .map(kb => `${kb.source}:\n${kb.summary || 'Tidak ada ringkasan'}`)
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

    // System prompt
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
  
- HANYA jika pengguna EKSPLISIT menyebutkan institusi lain, jawab tentang institusi tersebut

PENTING - Prioritas Informasi:
1. UTAMAKAN informasi dari "Informasi Help Desk Resmi" di atas (Knowledge Base dan Konten Informasi) untuk menjawab pertanyaan
2. Jika informasi tidak tersedia di Help Desk Resmi, berikan informasi umum yang relevan
3. Jika ada perbedaan informasi, SELALU prioritaskan informasi dari Help Desk Resmi

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
- Langsung jawab pertanyaan dengan natural seperti percakapan biasa`;

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ error: 'Kredit AI habis. Silakan hubungi administrator.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Gagal menghubungi layanan AI.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Maaf, saya tidak dapat memberikan respons saat ini.';

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
