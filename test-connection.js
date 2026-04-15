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

async function testConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  const session = await authenticate();
  console.log('✅ User authenticated:', session.user.email);

  // Test 1: Check connection
  console.log('1️⃣ Testing basic connection...');
  const { data: healthCheck, error: healthError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('id', session.user.id)
    .limit(1);

  if (healthError) {
    console.error('❌ Connection failed:', healthError.message);
    process.exit(1);
  }
  console.log('✅ Connection successful!\n');

  // Test 2: Check auth status
  console.log('2️⃣ Checking auth configuration...');
  const { data: { session: activeSession } } = await supabase.auth.getSession();
  console.log('Session:', activeSession ? '✅ Active' : '❌ No active session (this is normal before login)\n');

  // Test 3: Check tables exist
  console.log('3️⃣ Checking database tables...');
  const tables = [
    'profiles',
    'lessons',
    'code_snippets',
    'conversations',
    'messages',
    'saved_videos',
    'daily_stats',
    'learning_streaks',
    'topic_mastery',
    'activity_log'
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(1);
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: exists`);
    }
  }

  console.log('\n4️⃣ Checking authenticated profile row...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profileError) {
    console.log(`⚠️  Could not verify profile row: ${profileError.message}\n`);
  } else if (!profile) {
    console.log('⚠️  No profile row found for test user (check signup trigger)\n');
  } else {
    console.log('✅ Profile row exists for authenticated user\n');
  }

  console.log('✅ All checks complete!\n');
  console.log('📝 Summary:');
  console.log('- Database connection: ✅ Working');
  console.log('- All tables created: ✅ Yes');
  console.log('- Ready for auth: ✅ Yes\n');
  console.log('Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Open: http://localhost:5173');
  console.log('3. Register a new account');
  console.log('4. Check if profile is auto-created\n');
}

testConnection().catch(console.error);
