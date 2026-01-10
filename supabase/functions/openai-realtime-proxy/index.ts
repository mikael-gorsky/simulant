import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get auth token from query parameter
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const isPreflightCheck = url.searchParams.get('check') === 'true';

    if (!token) {
      return new Response('Missing authentication token', {
        status: 401,
        headers: corsHeaders
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // For single-user apps: validate token is either anon key or valid user JWT
    // Try to get user first (for future multi-user support)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    // If not a valid user JWT, verify it's the anon key
    if (authError || !user) {
      if (token !== anonKey) {
        return new Response(`Authentication failed: invalid token`, {
          status: 401,
          headers: corsHeaders
        });
      }
      // Token is valid anon key - proceed
    }

    // Get OpenAI API key from database
    const { data: apiKeyData, error: keyError } = await supabase
      .from('api_keys')
      .select('key_value')
      .eq('key_name', 'openai')
      .maybeSingle();

    if (keyError || !apiKeyData?.key_value) {
      return new Response(`OpenAI API key not configured: ${keyError?.message || 'key not found'}`, {
        status: 500,
        headers: corsHeaders
      });
    }

    // If this is a pre-flight check, return success
    if (isPreflightCheck) {
      return new Response(JSON.stringify({ status: 'ok', message: 'Authentication and API key validated' }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Check if this is a WebSocket upgrade request
    const upgrade = req.headers.get('upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', {
        status: 426,
        headers: corsHeaders
      });
    }

    const openaiApiKey = apiKeyData.key_value;
    const model = url.searchParams.get('model') || 'gpt-4o-realtime-preview-2024-10-01';

    // Create WebSocket pair
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // Connect to OpenAI Realtime API
    const openaiUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
    const openaiSocket = new WebSocket(openaiUrl, [
      'realtime',
      `openai-insecure-api-key.${openaiApiKey}`,
      'openai-beta.realtime-v1'
    ]);

    // Proxy messages from client to OpenAI
    clientSocket.onmessage = (event) => {
      if (openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.send(event.data);
      }
    };

    // Proxy messages from OpenAI to client
    openaiSocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    // Handle OpenAI connection open
    openaiSocket.onopen = () => {
      console.log('Connected to OpenAI Realtime API');
    };

    // Handle errors
    openaiSocket.onerror = (error) => {
      console.error('OpenAI WebSocket error:', error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1011, 'OpenAI connection error');
      }
    };

    clientSocket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
      if (openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.close();
      }
    };

    // Handle closures
    openaiSocket.onclose = () => {
      console.log('OpenAI connection closed');
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };

    clientSocket.onclose = () => {
      console.log('Client connection closed');
      if (openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.close();
      }
    };

    return response;

  } catch (error) {
    console.error('Error in WebSocket proxy:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
