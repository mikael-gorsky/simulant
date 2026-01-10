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

    // Try the session token endpoint which is documented
    const response = await fetch("https://api.simli.ai/createE2ESessionToken", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Empty body just to test if API key is valid
      }),
    });

    // If we get 401/403, the key is invalid
    if (response.status === 401 || response.status === 403) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid API key",
          details: "The provided Simli API key is not valid. Please check and try again.",
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

    // If we get here and the response is in 200-299 range or 400 (bad request but API key accepted),
    // the API key is valid
    if (response.status >= 200 && response.status < 500) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Simli API key is valid",
          details: "Successfully authenticated with Simli API.",
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

    // For any other status, return error with details
    const errorText = await response.text();
    return new Response(
      JSON.stringify({
        success: false,
        message: `API error (${response.status})`,
        details: errorText || "An error occurred while validating the API key",
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