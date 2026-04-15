import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://erpfdokhdjrgcywiytco.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycGZkb2toZGpyZ2N5d2l5dGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzEwMzEsImV4cCI6MjA4OTg0NzAzMX0.PihxhB5jL0VYOJfqNmAeO1PhHIzAs8TmQLxxwcn4lJU';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'testfunctions123@gmail.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

function since(start) {
  return Number((performance.now() - start).toFixed(1));
}

function parseSseBlock(block) {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  let event = 'message';
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join('\n');
  let payload;

  try {
    payload = JSON.parse(rawData);
  } catch {
    payload = { _raw: rawData };
  }

  return { event, payload };
}

async function authenticate() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const signInResult = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (!signInResult.error && signInResult.data.session) {
    return signInResult.data.session;
  }

  const signUpResult = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signUpResult.error || !signUpResult.data.session) {
    const reason = signInResult.error?.message || signUpResult.error?.message || 'Authentication failed';
    throw new Error(`${reason}. Set TEST_USER_EMAIL and TEST_USER_PASSWORD for an existing account.`);
  }

  return signUpResult.data.session;
}

async function run() {
  const startedAt = performance.now();
  const session = await authenticate();

  const requestBody = {
    topic: 'Create a JavaScript function that returns the first non-repeating character in a string.',
    language: 'JavaScript',
    optimization: 'optimized',
    mode: 'fast',
    stream: true,
    requestId: crypto.randomUUID(),
  };

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/generate-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(requestBody),
  });

  const httpReadyMs = since(startedAt);

  if (!response.ok) {
    const body = await response.text();
    console.log(
      JSON.stringify(
        {
          ok: false,
          status: response.status,
          httpReadyMs,
          body,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (!response.body) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          status: response.status,
          httpReadyMs,
          error: 'No response body',
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const timeline = [];
  const chunkTimeline = [];
  let completePayload = null;
  let errorPayload = null;
  let buffer = '';
  let rawStreamText = '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    const decodedChunk = decoder.decode(value, { stream: true });
    rawStreamText += decodedChunk;
    buffer += decodedChunk;
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      if (!block || block.startsWith(':')) {
        continue;
      }

      const parsed = parseSseBlock(block);
      if (!parsed) {
        continue;
      }

      const t = since(startedAt);
      const { event, payload } = parsed;

      timeline.push({
        t,
        event,
        message: payload?.message || null,
      });

      if (event === 'chunk') {
        const chunkText = typeof payload?.chunk === 'string' ? payload.chunk : '';
        chunkTimeline.push({
          t,
          length: chunkText.length,
          model: payload?.model || null,
          preview: chunkText.slice(0, 60),
        });
      }

      if (event === 'complete') {
        completePayload = payload;
      }

      if (event === 'error') {
        errorPayload = payload;
      }
    }
  }

  const finishedMs = since(startedAt);

  console.log(
    JSON.stringify(
      {
        ok: !errorPayload,
        status: response.status,
        httpReadyMs,
        finishedMs,
        contentType: response.headers.get('content-type'),
        totalEvents: timeline.length,
        timeline,
        statusEvents: timeline.filter((entry) => entry.event === 'status'),
        chunkCount: chunkTimeline.length,
        chunkTimeline,
        firstChunk: chunkTimeline[0] || null,
        lastChunk: chunkTimeline[chunkTimeline.length - 1] || null,
        completeAtMs: timeline.find((entry) => entry.event === 'complete')?.t || null,
        errorAtMs: timeline.find((entry) => entry.event === 'error')?.t || null,
        completeCodeLength: typeof completePayload?.code === 'string' ? completePayload.code.length : null,
        completeGenerationTimeMs:
          typeof completePayload?.generationTimeMs === 'number' ? completePayload.generationTimeMs : null,
        completePayloadKeys: completePayload ? Object.keys(completePayload) : null,
        rawStreamLength: rawStreamText.length,
        rawStreamPreview: rawStreamText.slice(0, 600),
        errorPayload,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
