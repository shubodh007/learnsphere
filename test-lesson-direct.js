// Direct test of lesson generation API
// You need to provide a valid access token from your browser
// To get it:
// 1. Login to the app
// 2. Open browser console
// 3. Run: localStorage.getItem('sb-erpfdokhdjrgcywiytco-auth-token')
// 4. Copy the access_token value and paste it below

const SUPABASE_URL = 'https://erpfdokhdjrgcywiytco.supabase.co';

// Replace this with your actual access token
const ACCESS_TOKEN = process.argv[2] || 'YOUR_TOKEN_HERE';

async function testLessonAPI() {
  console.log('🧪 Testing Lesson Generation Edge Function\n');

  if (ACCESS_TOKEN === 'YOUR_TOKEN_HERE') {
    console.log('❌ No access token provided');
    console.log('\nTo get your access token:');
    console.log('1. Run: npm run dev');
    console.log('2. Login at http://localhost:5173');
    console.log('3. Open browser DevTools console');
    console.log('4. Run this in console:');
    console.log('   JSON.parse(localStorage.getItem("sb-erpfdokhdjrgcywiytco-auth-token")).access_token');
    console.log('5. Copy the token');
    console.log('6. Run: node test-lesson-direct.js YOUR_TOKEN');
    return;
  }

  console.log('🔑 Using token:', ACCESS_TOKEN.substring(0, 20) + '...');
  console.log('📤 Calling Edge Function...\n');

  try {
    const startTime = Date.now();

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-lesson`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          topic: 'Test Lesson: Basic Python',
          difficulty: 'beginner'
        }),
      }
    );

    const elapsed = Date.now() - startTime;

    console.log('⏱️  Response time:', elapsed, 'ms');
    console.log('📊 Status:', response.status, response.statusText);
    console.log('');

    const responseText = await response.text();

    if (!response.ok) {
      console.error('❌ API Error Response:');
      console.error(responseText);

      try {
        const errorJson = JSON.parse(responseText);
        console.error('\nParsed error:', JSON.stringify(errorJson, null, 2));
      } catch {
        // Not JSON
      }
      return;
    }

    const data = JSON.parse(responseText);
    console.log('✅ Success! Lesson generated:');
    console.log('   Title:', data.title);
    console.log('   Slug:', data.slug);
    console.log('   Difficulty:', data.difficulty);
    console.log('   Summary:', data.summary?.substring(0, 80) + '...');
    console.log('   Content length:', data.content?.length, 'chars');
    console.log('   Key takeaways:', data.key_takeaways?.length);
    console.log('   Examples:', data.examples?.length);
    console.log('   Questions:', data.questions?.length);

  } catch (error) {
    console.error('❌ Request failed:');
    console.error(error.message);
    console.error(error);
  }
}

testLessonAPI();
