// @ts-nocheck
/**
 * Token-optimized lesson prompts with 3 difficulty levels.
 * Total tokens: ~450 (vs ~1,800 before) - 75% reduction.
 */

// BEGINNER: ~140 tokens
const BEGINNER_PROMPT = `You teach complete beginners. Make complex topics simple.

Rules:
- Start with a real-world analogy
- Define every technical term in plain English
- Use short sentences, no unexplained jargon
- Give 2+ relatable examples before any code
- Code: under 15 lines, comment every line
- Add "Think of it like this:" after major concepts
- End with "Common mistakes beginners make"
- Tone: friendly, patient, encouraging
- Explain from first principles, assume zero knowledge
- Use bullets and short paragraphs`;

// INTERMEDIATE: ~130 tokens
const INTERMEDIATE_PROMPT = `You teach developers who know basics but want depth. Bridge syntax to understanding.

Rules:
- Skip basic definitions
- Focus on "why", not just "what"
- Explain tradeoffs, edge cases, when NOT to use
- Code: 20-40 lines, real-world patterns
- Include "under the hood" explanations
- Add "Common pitfalls" with wrong vs right code
- Compare to alternatives ("use this over X when...")
- Note performance/best practices
- Tone: peer-to-peer, direct, thorough
- End with a practical mini-challenge`;

// ADVANCED: ~140 tokens
const ADVANCED_PROMPT = `You teach experienced developers seeking mastery. Go beyond documentation.

Rules:
- Assume strong fundamentals, don't over-explain basics
- Dive into internals, runtime, memory, performance
- Code: production-quality, handle edge cases/errors
- Include deep-dive on low-level mechanics (compiler/runtime/OS/network)
- Discuss real-world failure modes and debugging
- Compare implementations with tradeoff analysis
- Reference industry patterns/libraries/examples
- Add "Further reading" section
- Tone: technical, precise, like an internal RFC
- End with a hard synthesis challenge`;

// User template: ~120 tokens
const USER_PROMPT_TEMPLATE = `Generate a lesson:

Topic: {{topic}}
Level: {{level}}
Category: {{category}}
Prior lessons: {{prior_lessons_list}}

Structure exactly:

# {{topic}}

## Overview
[What this is and why it matters - 2-3 paragraphs]

## Core Concepts
[Main theory in labeled subsections]

## Code Walkthrough
[Annotated examples with explanations]

## How It Works Under the Hood
[Internals, runtime, mental model]

## Common Mistakes & Pitfalls
[Wrong vs right with code]

## Practical Exercise
[Hands-on task]

## Quick Recap
[5-7 bullets]

## What to Learn Next
[2-3 follow-up topics]

Start with # heading. No meta-commentary.
IMPORTANT: Follow exact structure. No skipped sections.`;

export const SYSTEM_PROMPTS = {
  beginner: BEGINNER_PROMPT,
  intermediate: INTERMEDIATE_PROMPT,
  advanced: ADVANCED_PROMPT,
};

export function buildUserPrompt(topic: string, level: string, category: string, priorLessons: string[] = []): string {
  return USER_PROMPT_TEMPLATE
    .replace('{{topic}}', topic)
    .replace('{{level}}', level)
    .replace('{{category}}', category)
    .replace('{{prior_lessons_list}}', priorLessons.length > 0 ? priorLessons.join(', ') : 'None');
}

export function getSystemPromptForLevel(level: 'beginner' | 'intermediate' | 'advanced'): string {
  return SYSTEM_PROMPTS[level] || SYSTEM_PROMPTS.beginner;
}

// Legacy export
export const FULL_ELITE_PROMPT = SYSTEM_PROMPTS.intermediate;

// Continuation: ~80 tokens
export const CONTINUATION_PROMPT_TEMPLATE = (
  topic: string,
  difficulty: string,
  completedSections: string[],
  nextIndex: number,
  title: string,
  summary: string
) => {
  const tone = difficulty === 'beginner'
    ? 'Keep friendly tone, define new terms plainly.'
    : difficulty === 'intermediate'
      ? 'Keep peer tone, focus on why and tradeoffs.'
      : 'Keep technical depth, dive into internals.';

  return `Continue lesson: "${topic}" (${difficulty} level). ${tone}

Done: ${completedSections.join(' | ')}
Resume at section ${nextIndex}.

Structure remaining sections:

## Core Concepts
## Code Walkthrough
## How It Works Under the Hood
## Common Mistakes & Pitfalls
## Practical Exercise
## Quick Recap
## What to Learn Next

Rules:
- Only remaining sections, no repeats
- Same tone/depth
- Title: ${JSON.stringify(title)}
- Summary: ${JSON.stringify(summary)}
- Difficulty: "${difficulty}"
- is_complete: true unless more needed`;
};

// Legacy templates
export const TEMPLATES = {
  chat: `# [Topic Title]

**TL;DR:** [One-sentence summary]

## Quick Context
[Brief overview]

## Detailed Breakdown
[Main explanation]

> **Pro Tip**
> [Insight]

**The bottom line:** [Final actionable insight]
`,
  lesson: `# Lesson: [Topic]

**TL;DR:** [One-sentence summary]

## Introduction
[Setting the stage]

## The Core Concept
[Deep dive]

### Practical Examples
[Code blocks or scenarios]

## Key Takeaways
- **Concept A:** [Detail]
- **Concept B:** [Detail]

**Next Steps:** [Actionable items]
`,
  code: `# Implementation: [Feature]

**Prerequisites:** [Requirements]
**Estimated time:** [X mins]

## Step-by-Step Guide

### Step 1: [Action]
\`\`\`[language]
[code]
\`\`\`
**What's happening:** [Explanation]

> **Common Pitfall**
> [Prevention]

### Step 2: [Next Action]
[...]

## Verification
[How to test]
`,
  comparison: `# [Comparison]: A vs B

**Quick verdict:** [Recommendation]

| Feature | Option A | Option B | Winner |
|:---|:---:|:---:|:---:|
| Perf | [X] | [Y] | [W] |

## Detailed Analysis
### Option A
[Strengths/Weaknesses]
### Option B
[Strengths/Weaknesses]

**Recommendation**
[Final guidance]
`,
};

export const LOADING_CATEGORIES = {
  database: [
    "Searching the archives for the cleanest explanation...",
    "Pulling in examples that fit your level...",
    "Checking the lesson structure before we send it...",
    "Assembling the final sections..."
  ],
  absurd: [
    "Negotiating with overly confident robots...",
    "Asking the cloud for one more good metaphor...",
    "Convincing the examples to stay readable...",
    "Keeping the jargon level under control..."
  ],
  tech: [
    "Warming up the lesson pipeline...",
    "Trimming unnecessary tokens for a faster response...",
    "Aligning the sections into a clear sequence...",
    "Packaging the lesson for the viewer..."
  ],
  meta: [
    "Thinking carefully so you do not have to guess...",
    "Balancing speed with depth...",
    "Making the explanation easier to scan...",
    "Turning rough ideas into a structured lesson..."
  ]
};
