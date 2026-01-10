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
    const { apiKey, faceId } = await req.json();

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

    if (!faceId || !faceId.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Face ID is required",
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

    // Test creating a session with this face ID
    // Note: Simli API expects 'simliAPIKey' in the body, not in headers
    const response = await fetch("https://api.simli.ai/createE2ESessionToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        simliAPIKey: apiKey,
        faceId: faceId,
      }),
    });

    // If we get 401/403, the key is invalid
    if (response.status === 401 || response.status === 403) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid API key",
          details: "The provided Simli API key is not valid.",
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
          details: "Too many requests. Please wait and try again.",
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

    // Check if response is successful
    if (response.status >= 200 && response.status < 300) {
      const data = await response.json();
      
      // If we got a valid response, the face ID is valid
      return new Response(
        JSON.stringify({
          success: true,
          message: "Face ID is valid and accessible",
          details: `Successfully verified access to face ID: ${faceId}`,
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

    // If we get 400 or 422, it might be an invalid face ID or validation error
    if (response.status === 400 || response.status === 422) {
      const errorData = await response.json().catch(() => null);
      
      // Extract error message from various possible formats
      let errorMessage = `The face ID "${faceId}" does not exist or is not accessible with your API key.`;
      
      if (errorData?.detail) {
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          // Pydantic validation errors
          const faceIdError = errorData.detail.find((e: any) => e.loc?.includes('faceId'));
          if (faceIdError) {
            errorMessage = faceIdError.msg || errorMessage;
          }
        }
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid Face ID",
          details: errorMessage,
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

    // For any other error
    const errorText = await response.text();
    return new Response(
      JSON.stringify({
        success: false,
        message: `API error (${response.status})`,
        details: errorText || "An error occurred while validating the face ID",
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