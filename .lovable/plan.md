

## LearnSphere AI — Plan Addendum (Final Gaps)

This addendum adds 7 remaining implementation details to the approved plan.

### 1. CORS Headers (All Edge Functions)

Every edge function includes this shared CORS block at the top:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

All responses (including errors) include `headers: corsHeaders`.

### 2. TTS Voice Preference Persistence

- Store in `profiles.settings` JSONB field under key `tts_voice_preference` (string, nullable)
- Fallback: `window.speechSynthesis.getVoices()[0]`
- Load on app init via profile query, sync to `uiStore`

### 3. Edge Function Response Shapes

**`generate-lesson`:**
```json
{
  "title": "string",
  "slug": "string",
  "summary": "string",
  "content": "string (markdown)",
  "key_takeaways": ["string"],
  "examples": ["string"],
  "questions": ["string"],
  "difficulty": "beginner|intermediate|advanced"
}
```

**`generate-code`:**
```json
{
  "code": "string",
  "language": "string",
  "explanation": "string"
}
```

**`youtube-search`:**
```json
{
  "videos": [
    {
      "videoId": "string",
      "title": "string",
      "thumbnail": "string",
      "channelName": "string",
      "publishedAt": "string"
    }
  ]
}
```

### 4. Conversation Auto-Title

- Auto-title: first 50 characters of user's first message
- Set `conversations.title` on first message insert (in `chat` edge function)
- Display truncated with ellipsis in sidebar

### 5. nanoid in Edge Functions (Deno)

Use ESM import for Deno runtime:
```typescript
import { nanoid } from 'https://esm.sh/nanoid@5'
```

### Implementation Order

All 10 phases from the approved plan remain unchanged. These details are folded into their respective phases:
- Items 1, 5 → Phase 1 (Foundation / Edge Functions)
- Item 2 → Phase 9 (Settings)
- Item 3 → Phases 5, 7, 8 (Lessons, Code, Videos)
- Item 4 → Phase 6 (Chat)

