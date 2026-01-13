import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { url, type } = await req.json();
    console.log(`Processing ${type} URL:`, url);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Lovable AI API key
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI API key tidak dikonfigurasi.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let content = '';
    let title = '';

    if (type === 'website') {
      // Fetch website content
      console.log('Fetching website content...');
      const response = await fetch(url);
      const html = await response.text();
      
      // Extract text content (simple approach)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      content = textContent.substring(0, 50000); // Limit content size
      
      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

    } else if (type === 'video') {
      // For YouTube videos, extract video ID and use it as reference
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (!videoIdMatch) {
        throw new Error('Invalid YouTube URL');
      }
      
      const videoId = videoIdMatch[1];
      title = `Video: ${videoId}`;
      content = `YouTube Video URL: ${url}\nVideo ID: ${videoId}`;
      
      // Note: For actual video transcription, you would need YouTube Data API
      // This is a simplified approach
    }

    // Build prompt for summarization
    const prompt = type === 'website' 
      ? `Ekstrak dan simpan SEMUA informasi LENGKAP dan RELEVAN dari konten website ini untuk Help Desk UPT PJJ UIN Siber Syekh Nurjati Cirebon.

TUJUAN: Simpan informasi selengkap mungkin agar chatbot dapat menjawab pertanyaan dengan detail.

SIMPAN semua informasi tentang:
- Program studi, jurusan, dan informasi akademik
- Prosedur pendaftaran, syarat, dan jadwal
- Biaya kuliah dan cara pembayaran
- Kontak (telepon, email, WhatsApp, alamat)
- Layanan yang tersedia dan cara mengaksesnya
- Tanggal-tanggal penting
- Persyaratan dan dokumen yang dibutuhkan
- FAQ atau pertanyaan yang sering ditanyakan
- Link-link penting dan informasi terkait

FILTER HANYA informasi yang:
- Tidak relevan sama sekali dengan Help Desk/pendidikan (misal: iklan, navigasi website, footer generik)
- Berulang/duplikat persis

FORMAT: Tulis dalam paragraf yang terstruktur dan jelas. Gunakan heading dan bullet points untuk organisasi. Tidak ada batasan panjang - yang penting LENGKAP dan INFORMATIF.

Konten website:
${content}`
      : `Ekstrak dan simpan SEMUA informasi LENGKAP dan RELEVAN dari video YouTube ini untuk Help Desk UPT PJJ UIN Siber Syekh Nurjati Cirebon.

TUJUAN: Simpan informasi selengkap mungkin dari video agar chatbot dapat menjawab pertanyaan dengan detail.

SIMPAN semua informasi tentang:
- Topik utama dan sub-topik yang dibahas
- Penjelasan detail tentang program/layanan yang disebutkan
- Instruksi atau langkah-langkah yang dijelaskan
- Informasi kontak atau cara menghubungi
- Tanggal, jadwal, atau timeline yang disebutkan
- Tips, saran, atau hal penting yang disampaikan
- Link atau referensi yang disebutkan

FORMAT: Tulis dalam paragraf yang terstruktur dan lengkap. Gunakan heading dan bullet points untuk organisasi. Tidak ada batasan panjang - yang penting LENGKAP dan INFORMATIF.

URL Video: ${url}

Catatan: Ekstrak informasi sebanyak mungkin dari judul, deskripsi, dan konteks URL video. Jika tidak dapat mengakses konten video secara langsung, tulis bahwa ini adalah referensi video YouTube dengan informasi yang perlu ditonton langsung untuk detail lengkap, namun tetap berikan konteks dari judul dan URL.`;

    // Call Lovable AI Gateway
    console.log('Calling Lovable AI Gateway for summarization...');
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Anda adalah asisten yang ahli dalam mengekstrak dan meringkas informasi dari konten web untuk keperluan Help Desk pendidikan." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ error: 'Kredit AI habis. Silakan hubungi administrator.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error('Gagal menghubungi layanan AI');
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || '';

    if (!summary) {
      throw new Error('Failed to generate summary');
    }

    console.log('Successfully generated summary');

    // Store in knowledge_base
    const { error: insertError } = await supabaseClient
      .from('knowledge_base')
      .insert({
        source: title || url,
        summary,
        type: type === 'website' ? 'url' : 'video'
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('URL processed and stored successfully');

    return new Response(
      JSON.stringify({ success: true, title, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-url function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
