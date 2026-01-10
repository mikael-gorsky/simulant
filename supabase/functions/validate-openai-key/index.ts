import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { apiKey } = await req.json();

    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "API key is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!apiKey.startsWith("sk-")) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid API key format. OpenAI keys start with 'sk-'",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid API key",
          details: "The provided API key is not valid. Please check and try again.",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (response.status === 429) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Rate limit exceeded",
          details: "Too many requests. Please wait a moment and try again.",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Validation failed",
          details: `API returned status ${response.status}`,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const data = await response.json();
    const modelCount = data?.data?.length || 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: "OpenAI API key is valid",
        details: `Successfully authenticated. Found ${modelCount} available models.`,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Validation error",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});