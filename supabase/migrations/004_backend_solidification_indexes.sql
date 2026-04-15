-- LearnSphere backend solidification indexes
-- Migration: 004_backend_solidification_indexes.sql

-- Supports exact-match dedup lookups by user + difficulty + recency.
CREATE INDEX IF NOT EXISTS idx_lessons_dedup
  ON lessons(user_id, difficulty_level, created_at DESC)
  WHERE is_deleted = FALSE;

-- Supports case-insensitive topic matching without wildcard behavior.
CREATE INDEX IF NOT EXISTS idx_lessons_topic_ci_lookup
  ON lessons(user_id, difficulty_level, lower(topic), created_at DESC)
  WHERE is_deleted = FALSE;
