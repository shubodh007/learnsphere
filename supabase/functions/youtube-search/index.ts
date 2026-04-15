// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Fix for IDE linting: Deno is a global in Supabase Edge Functions
declare const Deno: any;
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import {
  createSupabaseClient,
  getUser,
  checkRateLimit,
  logActivity,
  AuthError,
  ConfigError,
} from '../_shared/supabase.ts';

interface YouTubeSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    thumbnails?: { medium?: { url?: string } };
    channelTitle?: string;
    publishedAt?: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  error?: {
    code?: number;
    message?: string;
  };
}

serve(async (req: Request) => {
  // STEP 1: CORS preflight - ALWAYS FIRST
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // STEP 2: Method check
    if (req.method !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    // STEP 3: Create Supabase client and authenticate
    const supabase = createSupabaseClient(req);
    const user = await getUser(supabase);

    // STEP 4: Check rate limit (100 searches/day to protect YouTube API quota)
    const withinLimit = await checkRateLimit(supabase, user.id, 'video_searched', 100);
    if (!withinLimit) {
      return errorResponse('Daily video search limit reached (100/day)', 429);
    }

    // STEP 5: Parse query parameters
    const url = new URL(req.url);
    const query = url.searchParams.get('q');
    const maxResultsParam = url.searchParams.get('maxResults') || '10';

    // STEP 6: Validate and sanitize maxResults (YouTube API accepts 1-50)
    const maxResults = Math.min(50, Math.max(1, parseInt(maxResultsParam, 10) || 10));

    // STEP 7: Validate input
    if (!query || query.trim().length === 0) {
      return errorResponse('Search query is required', 400);
    }

    // STEP 8: Check API key
    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      console.error('[LearnSphere] YOUTUBE_API_KEY not configured');
      return errorResponse('YouTube API not configured', 500);
    }

    // STEP 9: Build YouTube API URL
    const searchQuery = `${query.trim()} programming tutorial`;

    const youtubeUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    youtubeUrl.searchParams.set('part', 'snippet');
    youtubeUrl.searchParams.set('q', searchQuery);
    youtubeUrl.searchParams.set('type', 'video');
    youtubeUrl.searchParams.set('maxResults', String(maxResults));
    youtubeUrl.searchParams.set('relevanceLanguage', 'en');
    youtubeUrl.searchParams.set('safeSearch', 'strict');
    youtubeUrl.searchParams.set('key', apiKey);

    // STEP 10: Call YouTube API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(youtubeUrl.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError: YouTubeSearchResponse['error'] | null = null;

        try {
          const parsed = JSON.parse(errorText) as YouTubeSearchResponse;
          parsedError = parsed?.error || null;
        } catch {
          parsedError = null;
        }

        console.error('[LearnSphere] YouTube HTTP error:', {
          status: response.status,
          bodyPreview: errorText.slice(0, 200),
        });

        const message = parsedError?.message || `YouTube request failed with status ${response.status}`;
        const statusCode = response.status === 429 ? 429 : 502;
        return errorResponse(`YouTube error: ${message}`, statusCode);
      }

      const data: YouTubeSearchResponse = await response.json();

    // STEP 11: Check for API-level errors
    if (data.error) {
      console.error('[LearnSphere] YouTube API returned error:', data.error);
      return errorResponse(`YouTube error: ${data.error.message || 'Unknown'}`, 502);
    }

    // STEP 12: Transform response safely
    const videos = (data.items || [])
      .filter((item) => item.id?.videoId && item.snippet)
      .map((item) => ({
        videoId: item.id!.videoId!,
        title: item.snippet!.title || 'Untitled',
        thumbnail: item.snippet!.thumbnails?.medium?.url || '',
        channelName: item.snippet!.channelTitle || 'Unknown',
        publishedAt: item.snippet!.publishedAt || '',
      }));

    // STEP 13: Log activity and return success
    await logActivity(supabase, user.id, 'video_searched', 'youtube', undefined, {
      query: query.trim(),
      resultCount: videos.length
    });

    return jsonResponse({ videos });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        return errorResponse('YouTube search timed out', 504);
      }
      throw err;
    }
  } catch (error) {
    // CATCH-ALL with proper error classification
    console.error('[LearnSphere] YouTube search error:', error);

    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }

    if (error instanceof ConfigError) {
      return errorResponse('Service configuration error', 500);
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
