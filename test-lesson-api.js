// Test the lesson generation API
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://erpfdokhdjrgcywiytco.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVycGZkb2toZGpyZ2N5d2l5dGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzEwMzEsImV4cCI6MjA4OTg0NzAzMX0.PihxhB5jL0VYOJfqNmAeO1PhHIzAs8TmQLxxwcn4lJU';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'testfunctions123@gmail.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

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

async function testLessonGeneration() {
  console.log('🧪 Testing Lesson Generation API...\n');

  try {
    const session = await authenticate();

    console.log('✅ Authenticated:', session.user.email);
    console.log('🔑 Token:', session.access_token.substring(0, 20) + '...\n');

    // Test the edge function
    console.log('📤 Calling generate-lesson edge function...');
    console.log('Topic: "Introduction to JavaScript"');
    console.log('Difficulty: "beginner"\n');

    const startTime = Date.now();
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-lesson`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          topic: 'Introduction to JavaScript',
          difficulty: 'beginner'
        }),
      }
    );

    const endTime = Date.now();
    console.log(`⏱️  Response time: ${endTime - startTime}ms\n`);

    console.log('📊 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ API Error:');
      console.error('Status:', response.status);
      console.error('Response:', errorText);

      try {
        const errorJson = JSON.parse(errorText);
        console.error('Error details:', JSON.stringify(errorJson, null, 2));
      } catch {
        // Not JSON
      }
      process.exit(1);
      return;
    }

    const data = await response.json();
    console.log('\n✅ Success!');
    console.log('Title:', data.title);
    console.log('Slug:', data.slug);
    console.log('Difficulty:', data.difficulty);
    console.log('Summary:', data.summary?.substring(0, 100) + '...');
    console.log('Content length:', data.content?.length, 'characters');
    console.log('Key takeaways:', data.key_takeaways?.length);
    console.log('Examples:', data.examples?.length);
    console.log('Questions:', data.questions?.length);

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

testLessonGeneration();
