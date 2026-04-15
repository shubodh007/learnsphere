-- LearnSphere AI lesson enrichment
-- Migration: 003_lesson_enrichment.sql

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS quiz_questions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_read_time_minutes SMALLINT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS quality_flag TEXT DEFAULT 'ok'
    CHECK (quality_flag IN ('ok', 'below_threshold', 'regenerated')),
  ADD COLUMN IF NOT EXISTS has_code_examples BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_deep_dives BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lessons_dedup_lookup
  ON lessons(user_id, difficulty_level, lower(topic), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lessons_recent_lookup
  ON lessons(user_id, created_at DESC);
