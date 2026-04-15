#!/bin/bash
# Test script for LearnSphere Edge Functions
# Usage: ./test-functions.sh YOUR_JWT_TOKEN

TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo "Usage: ./test-functions.sh YOUR_JWT_TOKEN"
  echo ""
  echo "To get your JWT token:"
  echo "1. Open your app in browser and log in"
  echo "2. Open DevTools (F12) > Application > Local Storage"
  echo "3. Look for sb-erpfdokhdjrgcywiytco-auth-token"
  echo "4. Copy the 'access_token' value"
  exit 1
fi

BASE_URL="https://erpfdokhdjrgcywiytco.supabase.co/functions/v1"

echo "=== Testing LearnSphere Edge Functions ==="
echo ""

# Test 1: YouTube Search (GET)
echo "--- Test 1: YouTube Search ---"
RESULT=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/youtube-search?q=javascript" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)
echo "Status: $HTTP_CODE"
echo "Response: $BODY" | head -c 300
echo ""
echo ""

# Test 2: Generate Code (POST)
echo "--- Test 2: Generate Code ---"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/generate-code" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic":"hello world","language":"python"}')
HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)
echo "Status: $HTTP_CODE"
echo "Response: $BODY" | head -c 500
echo ""
echo ""

# Test 3: Generate Lesson (POST)
echo "--- Test 3: Generate Lesson ---"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/generate-lesson" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic":"JavaScript variables","difficulty":"beginner"}')
HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)
echo "Status: $HTTP_CODE"
echo "Response: $BODY" | head -c 500
echo ""
echo ""

# Test 4: Chat (POST - streaming)
echo "--- Test 4: Chat ---"
echo "Status: (streaming response)"
curl -s -N -X POST "$BASE_URL/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is a variable?"}' | head -c 500
echo ""
echo ""

echo "=== Tests Complete ==="
