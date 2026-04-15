// @ts-nocheck
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Expose-Headers': 'X-RateLimit-Remaining, X-RateLimit-Reset',
};

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(
  data: unknown,
  status: number = 200,
  extraHeaders: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function errorResponse(
  message: string,
  status: number = 500,
  code: string = 'UNKNOWN_ERROR',
  extraHeaders: HeadersInit = {}
): Response {
  return jsonResponse({ error: message, code, status }, status, extraHeaders);
}
