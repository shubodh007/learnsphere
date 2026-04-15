-- LearnSphere Bug Fixes - Database Verification Script
-- Run this in Supabase SQL Editor to verify all database fixes

-- ============================================
-- TEST 1: Check DELETE policy exists for profiles
-- ============================================
SELECT
    '✅ Fix 1: Profile DELETE Policy' as test_name,
    CASE
        WHEN COUNT(*) > 0 THEN 'PASS: Policy exists'
        ELSE 'FAIL: Policy missing'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can delete own profile'
    AND cmd = 'DELETE';

-- ============================================
-- TEST 2: Check increment_message_count function exists
-- ============================================
SELECT
    '✅ Fix 2: increment_message_count Function' as test_name,
    CASE
        WHEN COUNT(*) > 0 THEN 'PASS: Function exists'
        ELSE 'FAIL: Function missing'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'increment_message_count';

-- ============================================
-- TEST 3: Check handle_new_user function updated
-- ============================================
SELECT
    '✅ Fix 3: handle_new_user Function' as test_name,
    CASE
        WHEN prosrc LIKE '%raw_user_meta_data->>''name''%'
        THEN 'PASS: Function updated for GitHub OAuth'
        ELSE 'FAIL: Function not updated'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user';

-- ============================================
-- TEST 4: Check dead check_rate_limit function removed
-- ============================================
SELECT
    '✅ Fix 4: Dead check_rate_limit Removed' as test_name,
    CASE
        WHEN COUNT(*) = 0 THEN 'PASS: Dead function removed'
        ELSE 'FAIL: Dead function still exists'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'check_rate_limit';

-- ============================================
-- SUMMARY: All Database Fixes
-- ============================================
SELECT
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as divider,
    'DATABASE VERIFICATION COMPLETE' as summary;

-- ============================================
-- BONUS: Check all RLS policies on profiles
-- ============================================
SELECT
    policyname,
    cmd as operation,
    CASE
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_check,
    CASE
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'profiles'
ORDER BY cmd;
