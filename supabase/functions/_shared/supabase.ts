// @ts-nocheck
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

// Fix for IDE linting: Deno is a global in Supabase Edge Functions
declare const Deno: any;

export class AuthError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface RateLimitStatus {
  withinLimit: boolean;
  count: number;
  remaining: number;
  resetAt: string;
  maxPerWindow: number;
  windowStartedAt: string;
}

/**
 * Creates a Supabase client authenticated with the user's JWT.
 * Uses ANON_KEY to respect RLS policies.
 */
export function createSupabaseClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ConfigError('SUPABASE_URL or SUPABASE_ANON_KEY not configured');
  }

  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers,
    },
  });
}

/**
 * Creates a Supabase client with service role key (bypasses RLS).
 * Use only when RLS bypass is intentional.
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new ConfigError('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Gets the authenticated user from the Supabase client.
 * Throws AuthError if not authenticated.
 */
export async function getUser(supabase: SupabaseClient): Promise<User> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('[LearnSphere] Auth error details:', {
        message: error.message,
        status: error.status,
        name: error.name
      });
      throw new AuthError(error.message);
    }

    if (!user) {
      console.error('[LearnSphere] No user returned from getUser()');
      throw new AuthError('No authenticated user');
    }

    return user;
  } catch (err) {
    console.error('[LearnSphere] getUser exception:', err);
    if (err instanceof AuthError) throw err;
    throw new AuthError(err instanceof Error ? err.message : 'Authentication failed');
  }
}

/**
 * Checks if user is within their daily rate limit for an activity.
 * Fails closed (returns false) on errors to prevent abuse during DB issues.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  activityType: string,
  maxPerDay: number
): Promise<boolean> {
  const status = await getRateLimitStatus(supabase, userId, activityType, maxPerDay);
  return status.withinLimit;
}

export async function getRateLimitStatus(
  supabase: SupabaseClient,
  userId: string,
  activityType: string,
  maxPerDay: number,
  windowMs: number = 24 * 60 * 60 * 1000
): Promise<RateLimitStatus> {
  const windowStartedAt = new Date(Date.now() - windowMs).toISOString();

  try {
    const [{ count, error: countError }, { data: oldestActivity, error: oldestError }] = await Promise.all([
      supabase
        .from('activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('activity_type', activityType)
        .gte('created_at', windowStartedAt),
      supabase
        .from('activity_log')
        .select('created_at')
        .eq('user_id', userId)
        .eq('activity_type', activityType)
        .gte('created_at', windowStartedAt)
        .order('created_at', { ascending: true })
        .limit(1),
    ]);

    if (countError || oldestError) {
      console.error('[LearnSphere] Rate limit check error:', countError || oldestError);
      return {
        withinLimit: false,
        count: maxPerDay,
        remaining: 0,
        resetAt: new Date(Date.now() + windowMs).toISOString(),
        maxPerWindow: maxPerDay,
        windowStartedAt,
      };
    }

    const currentCount = count ?? 0;
    const remaining = Math.max(0, maxPerDay - currentCount);
    const oldestCreatedAt = oldestActivity?.[0]?.created_at;
    const resetAt = oldestCreatedAt
      ? new Date(new Date(oldestCreatedAt).getTime() + windowMs).toISOString()
      : new Date(Date.now() + windowMs).toISOString();

    return {
      withinLimit: currentCount < maxPerDay,
      count: currentCount,
      remaining,
      resetAt,
      maxPerWindow: maxPerDay,
      windowStartedAt,
    };
  } catch (err) {
    console.error('[LearnSphere] Rate limit exception:', err);
    return {
      withinLimit: false,
      count: maxPerDay,
      remaining: 0,
      resetAt: new Date(Date.now() + windowMs).toISOString(),
      maxPerWindow: maxPerDay,
      windowStartedAt,
    };
  }
}

/**
 * Logs user activity for analytics and rate limiting.
 */
export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  activityType: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.from('activity_log').insert({
      user_id: userId,
      activity_type: activityType,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata: metadata ?? {},
    });

    if (error) {
      console.error('[LearnSphere] Activity log error:', error);
    }
  } catch (err) {
    console.error('[LearnSphere] Activity log exception:', err);
    // Don't throw - activity logging should not fail the request
  }
}
