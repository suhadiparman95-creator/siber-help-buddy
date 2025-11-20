import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

    // Get Gemini API key
    const { data: settingsData } = await supabaseClient
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (!settingsData?.value) {
      throw new Error('Gemini API key not found');
    }

    const geminiApiKey = settingsData.value;
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

    // Use Gemini to summarize the content
    const prompt = type === 'website' 
      ? `Ekstrak HANYA informasi INTI dan PENTING dari konten website ini untuk Help Desk UPT PJJ UIN Siber Syekh Nurjati Cirebon.

FOKUS pada:
- Poin-poin kunci saja (bukan detail lengkap)
- Tanggal penting
- Kontak atau nomor yang relevan
- Action items atau langkah yang harus dilakukan
- Informasi yang sering ditanyakan

BUANG informasi yang:
- Berulang atau redundan
- Terlalu teknis atau administratif internal
- Tidak relevan untuk pengguna Help Desk

Format: Bullet points singkat dan padat. Maksimal 10 poin penting.

Konten website:
${content}`
      : `Analisis video YouTube ini dan buat rangkuman informasi penting untuk Help Desk UPT PJJ UIN Siber Syekh Nurjati Cirebon.

FOKUS pada:
- Topik utama video
- Poin-poin penting yang relevan
- Informasi kontak atau tindakan yang disebutkan

Format: Bullet points singkat. Maksimal 8 poin penting.

URL Video: ${url}

Catatan: Buat rangkuman berdasarkan konteks URL dan judul video. Jika tidak dapat mengakses konten video secara langsung, buat catatan bahwa ini adalah referensi video yang perlu ditonton untuk informasi lengkap.`;

    // Discover available models
    let available: string[] = [];
    try {
      const modelsResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + geminiApiKey
      );
      const modelsData = await modelsResponse.json();
      available = modelsData.models
        ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', '')) || [];
      console.log('Available models:', available);
    } catch (e) {
      console.error('Failed to fetch models, using defaults:', e);
      available = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
    }

    const preferredModels = [
      'gemini-2.0-flash-exp',
      'gemini-exp-1206', 
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest'
    ];

    const orderedModels = [
      ...preferredModels.filter(m => available.includes(m)),
      ...available.filter(m => !preferredModels.includes(m))
    ];

    if (orderedModels.length === 0) {
      throw new Error('No suitable Gemini models available');
    }

    let summary = '';
    for (const model of orderedModels) {
      try {
        console.log(`Attempting with model: ${model}`);
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
              }
            })
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error(`Model ${model} failed:`, errorText);
          continue;
        }

        const geminiData = await geminiResponse.json();
        summary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (summary) {
          console.log(`Successfully generated summary with model: ${model}`);
          break;
        }
      } catch (error) {
        console.error(`Error with model ${model}:`, error);
        continue;
      }
    }

    if (!summary) {
      throw new Error('Failed to generate summary with any available model');
    }

    // Store in knowledge_base
    const { error: insertError } = await supabaseClient
      .from('knowledge_base')
      .insert({
        title,
        content: url,
        summary,
        source_type: type,
        file_path: url
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
