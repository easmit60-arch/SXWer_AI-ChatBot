addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Let browsers complete CORS checks before the real POST request.
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Serve HTML/CSS/JS files for normal page requests.
  if (request.method === "GET" || request.method === "HEAD") {
    if (typeof ASSETS !== "undefined" && typeof ASSETS.fetch === "function") {
      return ASSETS.fetch(request);
    }

    return new Response("Asset binding not configured.", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Keep the API route explicit so site routes and API routes do not conflict.
  if (request.method !== "POST" || url.pathname !== "/api/chat") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  }

  // In Cloudflare Workers, secrets are available as environment bindings.
  // Set your API keys in the Cloudflare dashboard, not in code.

  // Example API keys to set as environment variables in Cloudflare:
  //   OPENAI_API_KEY
  //   MISTRAL_API_KEY
  //   API_ID
  //   APIFY_API_TOKEN
  //   AGENT_ID
  // Reference: https://apclips.com/johndoe (for documentation or integration)

  const apiKey = OPENAI_API_KEY; // OpenAI
  const mistralKey =
    typeof MISTRAL_API_KEY !== "undefined" ? MISTRAL_API_KEY : undefined;
  const apifyToken =
    typeof APIFY_API_TOKEN !== "undefined" ? APIFY_API_TOKEN : undefined;
  // const apiId = typeof API_ID !== 'undefined' ? API_ID : undefined;
  // const agentId = typeof AGENT_ID !== 'undefined' ? AGENT_ID : undefined;

  // Example: If you want to require MISTRAL_API_KEY or APIFY_API_TOKEN for certain routes, add checks like:
  // if (!mistralKey) { return new Response(JSON.stringify({ error: "Missing MISTRAL_API_KEY secret." }), { status: 500, headers: corsHeaders }); }
  // if (!apifyToken) { return new Response(JSON.stringify({ error: "Missing APIFY_API_TOKEN secret." }), { status: 500, headers: corsHeaders }); }

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "Missing OPENAI_API_KEY secret. Set it as an environment variable in Cloudflare.",
      }),
      { status: 500, headers: corsHeaders },
    );
  }

  // If you need to use other APIs (e.g., Mistral, Apify),
  // add their keys as environment variables and access them the same way:
  // const mistralKey = MISTRAL_API_KEY;
  // const apiId = API_ID;
  // const apifyToken = APIFY_API_TOKEN;
  // const agentId = AGENT_ID;

  let userInput;

  try {
    userInput = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!Array.isArray(userInput.messages)) {
    return new Response(
      JSON.stringify({ error: "Request body must include messages array." }),
      { status: 400, headers: corsHeaders },
    );
  }

  const useWebSearch = Boolean(userInput.useWebSearch);
  const selectedModel = useWebSearch ? "gpt-4o-search-preview" : "gpt-4o";
  const systemPrompt = useWebSearch
    ? "You are a helpful L'Oréal beauty assistant. Give short, clear, beginner-friendly answers focused on L'Oréal products and routines. If you use web information, include a short Sources section with direct URLs."
    : "You are a helpful L'Oréal beauty assistant. Give short, clear, beginner-friendly answers focused on L'Oréal products and routines.";

  // Add one system instruction, then pass student chat messages through.
  const requestBody = {
    model: selectedModel,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...userInput.messages,
    ],
  };

  if (useWebSearch) {
    requestBody.web_search_options = {
      search_context_size: "medium",
    };
  }

  const openAiResponse = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );

  const data = await openAiResponse.json();

  return new Response(JSON.stringify(data), {
    status: openAiResponse.status,
    headers: corsHeaders,
  });
}
