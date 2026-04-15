// Test script for Supabase Edge Functions
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://erpfdokhdjrgcywiytco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycGZkb2toZGpyZ2N5d2l5dGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzEwMzEsImV4cCI6MjA4OTg0NzAzMX0.PihxhB5jL0VYOJfqNmAeO1PhHIzAs8TmQLxxwcn4lJU';

const TEST_EMAIL = 'testfunctions123@gmail.com';
const TEST_PASSWORD = 'TestPassword123!';

const INPUT_TPM_LIMIT = 30000;
const SAFE_TPM_BUDGET = 24000;
const AI_CALL_SPACING_MS = 12000;
const HEAVY_CALL_SPACING_MS = 18000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const LESSON_TEST_TOPIC = `variables in JavaScript ${Date.now()}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paceAfterCall(label, ms) {
  if (ms <= 0) return;
  console.log(`⏱️  Waiting ${Math.round(ms / 1000)}s after ${label} to stay below ~${SAFE_TPM_BUDGET}/${INPUT_TPM_LIMIT} TPM...`);
  await wait(ms);
}

async function getTestUserToken() {
  // Try to sign in first
  let { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    // If sign in fails, try to sign up
    console.log('Sign in failed:', error.message);
    console.log('Trying sign up...');
    const signUpResult = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signUpResult.error) {
      console.error('Sign up failed:', signUpResult.error.message);
      return null;
    }

    // Check if email confirmation is needed
    if (!signUpResult.data.session) {
      console.log('Sign up successful but email confirmation required.');
      console.log('User ID:', signUpResult.data.user?.id);
      console.log('Please use an existing user or disable email confirmation in Supabase dashboard.');
      return null;
    }

    data = signUpResult.data;
  }

  return data.session?.access_token;
}

async function testFunction(
  name,
  method,
  path,
  body = null,
  token,
  options = {}
) {
  const {
    maxRetries = 0,
    retryDelayMs = 8000,
    retryStatuses = RETRYABLE_STATUSES,
    isStreaming = false,
  } = options;

  const url = `${SUPABASE_URL}/functions/v1/${path}`;

  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;
    console.log(`\n--- Testing ${name} (attempt ${attempt}/${maxRetries + 1}) ---`);
    console.log(`${method} ${url}`);

    try {
      const requestOptions = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestOptions);
      const contentType = response.headers.get('content-type');

      console.log(`Status: ${response.status}`);

      const shouldRetry =
        retryStatuses.has(response.status) &&
        attempt <= maxRetries;

      if (shouldRetry) {
        console.log(`Transient status ${response.status}. Retrying in ${Math.round(retryDelayMs / 1000)}s...`);
        await wait(retryDelayMs);
        continue;
      }

      if (isStreaming || contentType?.includes('text/event-stream')) {
        // Handle SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = '';
        let chunks = 0;

        while (chunks < 5) { // Read first 5 chunks
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
          chunks++;
        }

        reader.cancel();
        console.log('Stream preview (first 5 chunks):');
        console.log(result.slice(0, 500));
        return { status: response.status, streaming: true, attempt };
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (response.ok) {
        console.log('SUCCESS:', JSON.stringify(data, null, 2).slice(0, 500));
      } else {
        console.log('ERROR:', JSON.stringify(data, null, 2));
      }

      return { status: response.status, data, attempt };
    } catch (err) {
      console.error('FETCH ERROR:', err.message);
      if (attempt <= maxRetries) {
        console.log(`Retrying in ${Math.round(retryDelayMs / 1000)}s...`);
        await wait(retryDelayMs);
        continue;
      }
      return { status: 0, error: err.message, attempt };
    }
  }

  return { status: 0, error: 'Retries exhausted', attempt };
}

async function main() {
  console.log('=== LearnSphere Edge Functions Test ===\n');

  // Get token
  console.log('Getting test user token...');
  const token = await getTestUserToken();

  if (!token) {
    console.error('Failed to get token. Exiting.');
    process.exit(1);
  }

  console.log('Token obtained successfully!\n');

  // Test results
  const results = {};

  // Test 1: youtube-search (GET)
  results.youtubeSearch = await testFunction(
    'YouTube Search',
    'GET',
    'youtube-search?q=javascript',
    null,
    token,
    {
      maxRetries: 1,
      retryDelayMs: 4000,
    }
  );
  await paceAfterCall('youtube-search', 1500);

  // Test 2: generate-code (POST)
  results.generateCode = await testFunction(
    'Generate Code',
    'POST',
    'generate-code',
    {
      topic: 'sum two numbers',
      language: 'python',
      optimization: 'optimized',
      mode: 'fast',
    },
    token,
    {
      maxRetries: 2,
      retryDelayMs: 12000,
    }
  );
  await paceAfterCall('generate-code', AI_CALL_SPACING_MS);

  // Test 3: generate-lesson (POST)
  results.generateLesson = await testFunction(
    'Generate Lesson',
    'POST',
    'generate-lesson',
    {
      topic: LESSON_TEST_TOPIC,
      difficulty: 'beginner',
      includeQuiz: false,
    },
    token,
    {
      maxRetries: 2,
      retryDelayMs: 15000,
    }
  );
  await paceAfterCall('generate-lesson', HEAVY_CALL_SPACING_MS);

  // Test 4: chat (POST - streaming)
  results.chat = await testFunction(
    'Chat',
    'POST',
    'chat',
    { message: 'Define a JavaScript variable in one sentence.' },
    token,
    {
      maxRetries: 0,
      isStreaming: true,
    }
  );

  // Summary
  console.log('\n\n=== TEST SUMMARY ===');
  for (const [name, result] of Object.entries(results)) {
    const status = result.status >= 200 && result.status < 300 ? '✅' : '❌';
    console.log(`${status} ${name}: ${result.status}`);
  }
}

main().catch(console.error);
