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
    const { filePath, title } = await req.json();
    
    if (!filePath || !title) {
      throw new Error('File path and title are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get API key
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .maybeSingle();

    if (apiKeyError || !apiKeyData?.value) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key tidak ditemukan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download PDF from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (fileError || !fileData) {
      console.error('Error downloading file:', fileError);
      return new Response(
        JSON.stringify({ error: 'Gagal mengunduh file PDF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert to base64 for Gemini API
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid stack overflow with large files
    const chunkSize = 8192;
    let base64Pdf = '';
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      base64Pdf += String.fromCharCode(...chunk);
    }
    base64Pdf = btoa(base64Pdf);

    // Use Gemini with vision to extract and summarize PDF content
    const prompt = `Ekstrak HANYA informasi INTI dan PENTING dari dokumen PDF ini untuk Help Desk UPT PJJ UIN Siber Syekh Nurjati Cirebon. 

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

Format: Bullet points singkat dan padat. Maksimal 10 poin penting.`;

    // Discover available models
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
      }
    } catch (e) {
      console.error('Error listing models:', e);
    }

    // Prefer vision-capable models for PDF processing
    const preferred = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const orderedCandidates = Array.from(new Set([
      ...preferred.filter(m => available.includes(m)),
      ...available,
      ...preferred,
    ]));

    let summary = '';
    let success = false;

    for (const model of orderedCandidates) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeyData.value}`;
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'application/pdf',
                    data: base64Pdf
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 2000,
            }
          })
        });

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error(`Gemini API error for ${model}:`, errorText);
          continue;
        }

        const geminiData = await geminiResponse.json();
        summary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (summary) {
          success = true;
          console.log(`Successfully processed PDF with model: ${model}`);
          break;
        }
      } catch (e) {
        console.error(`Error with model ${model}:`, e);
        continue;
      }
    }

    if (!success || !summary) {
      return new Response(
        JSON.stringify({ error: 'Gagal membuat rangkuman dengan Gemini API. Pastikan API key valid dan memiliki akses ke model yang mendukung PDF.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save to knowledge_base
    const { data: insertData, error: insertError } = await supabase
      .from('knowledge_base')
      .insert({
        title,
        content: `PDF Document: ${title}`,
        summary,
        source_type: 'pdf',
        file_path: filePath
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting knowledge:', insertError);
      return new Response(
        JSON.stringify({ error: 'Gagal menyimpan rangkuman ke database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: insertData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-document function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});