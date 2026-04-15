// Edge Function API Tests
// Run with: node test-api-fixes.js

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://erpfdokhdjrgcywiytco.supabase.co';

console.log('🧪 Testing Edge Function Fixes\n');

async function testYouTubeMaxResults() {
  console.log('Test: YouTube maxResults Sanitization');

  const tests = [
    { value: 'invalid', expected: 10, desc: 'Invalid string → default 10' },
    { value: 100, expected: 50, desc: 'Over limit (100) → clamped to 50' },
    { value: -5, expected: 1, desc: 'Negative (-5) → clamped to 1' },
    { value: 25, expected: 25, desc: 'Valid (25) → unchanged' },
  ];

  for (const test of tests) {
    console.log(`  Testing: ${test.desc}`);
    console.log(`    URL: ${SUPABASE_URL}/functions/v1/youtube-search?q=test&maxResults=${test.value}`);
    console.log(`    Expected: ${test.expected} results`);
  }

  console.log('  ℹ️  Requires authentication - test manually in browser\n');
}

async function testChatErrorHandling() {
  console.log('Test: Mid-stream AI Error Handling');
  console.log('  1. Open browser DevTools (F12)');
  console.log('  2. Go to Chat page');
  console.log('  3. Network tab → Filter: chat');
  console.log('  4. Send a message');
  console.log('  5. Look for SSE events with {"error": "..."} format');
  console.log('  6. Verify error is shown in UI (not silent)\n');
}

async function testRateLimitFailClosed() {
  console.log('Test: Rate Limit Fail-Closed Behavior');
  console.log('  Scenario: Database error during rate limit check');
  console.log('  Expected: Request should be DENIED (fail closed)');
  console.log('  Previous: Request would be ALLOWED (fail open - security issue)');
  console.log('  ℹ️  Simulate by temporarily breaking DB connection\n');
}

async function testOpenRouterDelay() {
  console.log('Test: OpenRouter Retry Delay');
  console.log('  Check Supabase Edge Functions logs:');
  console.log('  1. Dashboard → Edge Functions → chat');
  console.log('  2. Send chat message');
  console.log('  3. If model fails, check timestamps');
  console.log('  4. Should see ~500ms gaps between retries\n');
}

async function testMessageCountIncrement() {
  console.log('Test: Message Count Increment');
  console.log('  1. Start new chat conversation');
  console.log('  2. Send 5 messages back and forth (10 total)');
  console.log('  3. Continue to message 15, then 20');
  console.log('  4. Check: SELECT id, message_count FROM conversations;');
  console.log('  5. message_count should be 20 (not stuck at 10)');
  console.log('  Previous bug: Would be stuck at 10 (wrong logic)\n');
}

async function testDeleteAccountPolicy() {
  console.log('Test: Profile DELETE Policy');
  console.log('  ⚠️  WARNING: This will delete your test account!');
  console.log('  1. Create a test account');
  console.log('  2. Go to Settings page');
  console.log('  3. Click "Delete Account"');
  console.log('  4. Should succeed without RLS error');
  console.log('  Previous bug: Would fail with RLS policy error\n');
}

async function testGitHubOAuthAvatar() {
  console.log('Test: GitHub OAuth Avatar Initials');
  console.log('  1. Sign out if logged in');
  console.log('  2. Sign up with GitHub OAuth');
  console.log('  3. Go to Settings page');
  console.log('  4. Avatar should show first letter of your GitHub name');
  console.log('  Previous bug: Would show blank (empty string)\n');
}

// Main
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('              API & FUNCTION TESTS           ');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

testYouTubeMaxResults();
testChatErrorHandling();
testRateLimitFailClosed();
testOpenRouterDelay();
testMessageCountIncrement();
testDeleteAccountPolicy();
testGitHubOAuthAvatar();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Run these tests manually in your browser');
console.log('Most require authentication and user interaction');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
