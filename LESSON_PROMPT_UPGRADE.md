# Lesson Prompt Upgrade - Token Optimized

## Summary

Upgraded lesson generation with **3 difficulty-specific prompts** at **75% fewer tokens**.

## Token Usage

| Component | Tokens |
|-----------|--------|
| Beginner prompt | ~126 |
| Intermediate prompt | ~124 |
| Advanced prompt | ~146 |
| User template | ~167 |
| **Per-request total** | **~290** |

**Before:** ~1,200+ tokens per request  
**After:** ~290 tokens per request  
**Savings:** 75% reduction

## Changes

### 1. `supabase/functions/_shared/elite-prompt.ts`

Three concise prompts with level-specific rules:

**Beginner (~126 tokens):**
- Real-world analogy first
- Define all terms in plain English
- Code < 15 lines, line-by-line comments
- "Think of it like this:" sections
- Friendly, patient tone

**Intermediate (~124 tokens):**
- Skip basic definitions
- Focus on "why" and tradeoffs
- Code 20-40 lines, real patterns
- "Under the hood" explanations
- Peer-to-peer tone

**Advanced (~146 tokens):**
- Assume strong fundamentals
- Internals, runtime, memory, performance
- Production-quality code
- Failure modes and debugging
- Technical, RFC-like tone

### 2. `supabase/functions/generate-lesson/index.ts`

- Uses `getSystemPromptForLevel()` for system prompt
- Uses `buildUserPrompt()` for structured user prompt
- Both streaming and non-streaming paths updated

## Lesson Structure (8 sections)

```
# Topic

## Overview
## Core Concepts
## Code Walkthrough
## How It Works Under the Hood
## Common Mistakes & Pitfalls
## Practical Exercise
## Quick Recap
## What to Learn Next
```

## Test Results

```
✓ Beginner has analogy rule
✓ Beginner has term definition
✓ Beginner has code limit
✓ Intermediate skips basics
✓ Intermediate focuses on why
✓ Intermediate has tradeoffs
✓ Advanced assumes fundamentals
✓ Advanced has internals
✓ Advanced has failure modes
✓ All 8 sections enforced
✓ Prior lessons supported
```

## Deployment

No migration needed. Backward compatible via `FULL_ELITE_PROMPT` export.
