import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://erpfdokhdjrgcywiytco.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycGZkb2toZGpyZ2N5d2l5dGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzEwMzEsImV4cCI6MjA4OTg0NzAzMX0.PihxhB5jL0VYOJfqNmAeO1PhHIzAs8TmQLxxwcn4lJU';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'testfunctions123@gmail.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function authenticate() {
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

async function testCodeGeneration() {
  console.log('🧪 Testing Code Generation Edge Function...\n');

  const session = await authenticate();

  console.log('✅ User authenticated:', session.user.email);

  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  });

  // Test the edge function
  console.log('\n📤 Calling generate-code edge function...');
  const { data, error } = await authedClient.functions.invoke('generate-code', {
    body: {
      topic: 'Write a hello world function',
      language: 'JavaScript'
    }
  });

  if (error) {
    console.error('\n❌ Edge Function Error:');
    console.error('Status:', error.context?.status || 'unknown');
    console.error('Message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    process.exit(1);
  } else {
    console.log('\n✅ Success!');
    console.log('Response:', JSON.stringify(data, null, 2));
  }
}

testCodeGeneration().catch(console.error);
