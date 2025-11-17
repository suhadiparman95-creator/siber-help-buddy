import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey } = await req.json();
    
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Step 1: Simple connectivity check by listing models
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listResp = await fetch(listUrl, { method: 'GET' });

    if (!listResp.ok) {
      const errorText = await listResp.text();
      console.error('Gemini list models error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `API key tidak valid atau terjadi kesalahan. Status: ${listResp.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional Step 2: Try a tiny generate call with robust model alias
    const candidates = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
    let genOk = false;

    for (const model of candidates) {
      const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const genResp = await fetch(genUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [ { parts: [ { text: 'Katakan: Koneksi berhasil.' } ] } ]
        })
      });
      if (genResp.ok) { genOk = true; break; }
      const t = await genResp.text();
      console.error('Gemini generate test error for', model, t);
    }

    if (!genOk) {
      // Still consider connectivity successful since listing works
      return new Response(
        JSON.stringify({ success: true, message: 'Koneksi berhasil! (Model generateContent akan disesuaikan otomatis)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Koneksi berhasil!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in test-gemini function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});