-- LearnSphere AI Bug Fixes Migration
-- Migration: 002_bug_fixes.sql

-- ============================================
-- FIX 1: Add missing DELETE policy for profiles
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND policyname = 'Users can delete own profile'
    ) THEN
        CREATE POLICY "Users can delete own profile"
            ON profiles FOR DELETE
            USING (auth.uid() = id);
    END IF;
END $$;

-- ============================================
-- FIX 2: Update handle_new_user to support GitHub OAuth
-- GitHub uses 'name' instead of 'full_name' in metadata
-- Also returns NULL instead of empty string for proper fallbacks
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        -- Try full_name first (Google/email), then name (GitHub), return NULL if empty
        NULLIF(COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            ''
        ), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIX 3: Add increment_message_count function
-- Properly increments message count instead of setting from capped history
-- ============================================
CREATE OR REPLACE FUNCTION increment_message_count(
    conv_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE conversations
    SET
        message_count = message_count + 1,
        last_message_at = NOW()
    WHERE id = conv_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIX 4: Remove dead check_rate_limit SQL function
-- (TypeScript version in _shared/supabase.ts is used instead)
-- ============================================
DROP FUNCTION IF EXISTS check_rate_limit(UUID, TEXT, INTEGER);
