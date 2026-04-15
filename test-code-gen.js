// Test code generation with optimization levels
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://erpfdokhdjrgcywiytco.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycGZkb2toZGpyZ2N5d2l5dGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzEwMzEsImV4cCI6MjA4OTg0NzAzMX0.PihxhB5jL0VYOJfqNmAeO1PhHIzAs8TmQLxxwcn4lJU';
const testEmail = process.env.TEST_USER_EMAIL || 'testfunctions123@gmail.com';
const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const authenticate = async () => {
  const signInResult = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (!signInResult.error && signInResult.data.session) {
    return signInResult.data.session;
  }

  const signUpResult = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpResult.error || !signUpResult.data.session) {
    const reason = signInResult.error?.message || signUpResult.error?.message || 'Authentication failed';
    throw new Error(`${reason}. Set TEST_USER_EMAIL and TEST_USER_PASSWORD for an existing account.`);
  }

  return signUpResult.data.session;
};

// Test user authentication
const testAuth = async () => {
  console.log('🔐 Testing authentication...');
  try {
    const session = await authenticate();
    console.log('✅ Authenticated as:', session.user.email);
    return true;
  } catch (error) {
    console.error('❌ Not authenticated. Please sign in first.');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

// Test code generation
const testCodeGen = async () => {
  console.log('\n🚀 Testing code generation...\n');

  const tests = [
    {
      topic: 'Sort an array of numbers',
      language: 'JavaScript',
      optimization: 'optimized'
    }
  ];

  for (const test of tests) {
    console.log(`\n📝 Test: ${test.topic} (${test.optimization})`);
    console.log('Language:', test.language);

    try {
      const startTime = Date.now();

      const { data, error } = await supabase.functions.invoke('generate-code', {
        body: test
      });

      const duration = Date.now() - startTime;

      if (error) {
        console.error('❌ Error:', error);
        continue;
      }

      console.log(`✅ Success in ${duration}ms`);
      console.log('Generated code length:', data.code?.length || 0);
      console.log('Has complexity:', !!data.complexity);
      console.log('Optimization:', data.optimization);

      if (data.code) {
        console.log('\n--- Code Preview ---');
        console.log(data.code.substring(0, 300) + '...');
      }

      if (data.complexity) {
        console.log('\n--- Complexity ---');
        console.log(data.complexity);
      }

    } catch (err) {
      console.error('❌ Exception:', err.message);
    }
  }
};

// Run tests
(async () => {
  const isAuth = await testAuth();
  if (!isAuth) {
    console.log('\n💡 Please sign in to the app first, then run this test again.');
    process.exit(1);
  }

  await testCodeGen();
  console.log('\n✨ Test complete!');
})();
