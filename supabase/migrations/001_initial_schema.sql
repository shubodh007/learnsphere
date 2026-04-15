-- LearnSphere AI Initial Schema
-- Migration: 001_initial_schema.sql

-- No extensions needed - using built-in gen_random_uuid()

-- ============================================
-- HELPER FUNCTION: updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLE: profiles
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    learning_goals TEXT[],
    preferred_topics TEXT[],
    settings JSONB DEFAULT '{"tts_voice_preference": null, "tts_speed": 1.0, "theme": "dark"}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
    ON profiles FOR DELETE
    USING (auth.uid() = id);

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================
-- TABLE: lessons
-- ============================================
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    summary TEXT,
    key_takeaways TEXT[],
    examples JSONB,
    questions JSONB,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    category_id UUID,
    is_public BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    ai_model_used TEXT,
    generation_time_ms INTEGER,
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lessons_user_id ON lessons(user_id);
CREATE INDEX idx_lessons_slug ON lessons(slug);
CREATE INDEX idx_lessons_created_at ON lessons(created_at DESC);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lessons"
    ON lessons FOR SELECT
    USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can insert own lessons"
    ON lessons FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lessons"
    ON lessons FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lessons"
    ON lessons FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: code_snippets
-- ============================================
CREATE TABLE code_snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    explanation TEXT,
    execution_instructions TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    ai_model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_code_snippets_user_id ON code_snippets(user_id);
CREATE INDEX idx_code_snippets_language ON code_snippets(language);

ALTER TABLE code_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own code snippets"
    ON code_snippets FOR SELECT
    USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can insert own code snippets"
    ON code_snippets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own code snippets"
    ON code_snippets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own code snippets"
    ON code_snippets FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER code_snippets_updated_at
    BEFORE UPDATE ON code_snippets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: conversations
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
    ON conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
    ON conversations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
    ON conversations FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: messages
-- ============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    ai_model_used TEXT,
    tokens_used INTEGER,
    response_time_ms INTEGER,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in own conversations"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- ============================================
-- TABLE: saved_videos
-- ============================================
CREATE TABLE saved_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_title TEXT,
    thumbnail_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_videos_user_id ON saved_videos(user_id);
CREATE UNIQUE INDEX idx_saved_videos_user_video ON saved_videos(user_id, youtube_video_id);

ALTER TABLE saved_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved videos"
    ON saved_videos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved videos"
    ON saved_videos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved videos"
    ON saved_videos FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TABLE: daily_stats
-- ============================================
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    lessons_completed INTEGER DEFAULT 0,
    code_generated INTEGER DEFAULT 0,
    chat_messages INTEGER DEFAULT 0,
    videos_watched INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, date DESC);

ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily stats"
    ON daily_stats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own daily stats"
    ON daily_stats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily stats"
    ON daily_stats FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- TABLE: learning_streaks
-- ============================================
CREATE TABLE learning_streaks (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak"
    ON learning_streaks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streak"
    ON learning_streaks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streak"
    ON learning_streaks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE TRIGGER learning_streaks_updated_at
    BEFORE UPDATE ON learning_streaks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: topic_mastery
-- ============================================
CREATE TABLE topic_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
    lessons_completed INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, topic)
);

CREATE INDEX idx_topic_mastery_user_id ON topic_mastery(user_id);

ALTER TABLE topic_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topic mastery"
    ON topic_mastery FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topic mastery"
    ON topic_mastery FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic mastery"
    ON topic_mastery FOR UPDATE
    USING (auth.uid() = user_id);

CREATE TRIGGER topic_mastery_updated_at
    BEFORE UPDATE ON topic_mastery
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: activity_log (for rate limiting + activity tracking)
-- ============================================
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('lesson_generated', 'chat_message', 'code_generated', 'video_watched')),
    resource_type TEXT,
    resource_id UUID,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_type_date ON activity_log(user_id, activity_type, created_at);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity"
    ON activity_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
    ON activity_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTION: Log activity and update stats
-- ============================================
CREATE OR REPLACE FUNCTION log_activity_and_update_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update daily stats based on activity type
    INSERT INTO daily_stats (user_id, date, lessons_completed, code_generated, chat_messages, videos_watched)
    VALUES (
        NEW.user_id,
        CURRENT_DATE,
        CASE WHEN NEW.activity_type = 'lesson_generated' THEN 1 ELSE 0 END,
        CASE WHEN NEW.activity_type = 'code_generated' THEN 1 ELSE 0 END,
        CASE WHEN NEW.activity_type = 'chat_message' THEN 1 ELSE 0 END,
        CASE WHEN NEW.activity_type = 'video_watched' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        lessons_completed = daily_stats.lessons_completed + EXCLUDED.lessons_completed,
        code_generated = daily_stats.code_generated + EXCLUDED.code_generated,
        chat_messages = daily_stats.chat_messages + EXCLUDED.chat_messages,
        videos_watched = daily_stats.videos_watched + EXCLUDED.videos_watched;

    -- Update learning streak
    INSERT INTO learning_streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (NEW.user_id, 1, 1, CURRENT_DATE)
    ON CONFLICT (user_id)
    DO UPDATE SET
        current_streak = CASE
            WHEN learning_streaks.last_activity_date = CURRENT_DATE THEN learning_streaks.current_streak
            WHEN learning_streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN learning_streaks.current_streak + 1
            ELSE 1
        END,
        longest_streak = GREATEST(
            learning_streaks.longest_streak,
            CASE
                WHEN learning_streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN learning_streaks.current_streak + 1
                ELSE learning_streaks.current_streak
            END
        ),
        last_activity_date = CURRENT_DATE,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_activity_logged
    AFTER INSERT ON activity_log
    FOR EACH ROW
    EXECUTE FUNCTION log_activity_and_update_stats();

-- ============================================
-- HELPER FUNCTION: Search lessons by keywords
-- ============================================
CREATE OR REPLACE FUNCTION search_lessons(
    p_user_id UUID,
    p_query TEXT
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    topic TEXT,
    slug TEXT,
    content TEXT,
    summary TEXT,
    difficulty_level TEXT,
    view_count INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.user_id,
        l.topic,
        l.slug,
        l.content,
        l.summary,
        l.difficulty_level,
        l.view_count,
        l.created_at
    FROM lessons l
    WHERE l.user_id = p_user_id
    AND l.is_deleted = FALSE
    AND (
        l.topic ILIKE '%' || p_query || '%'
        OR l.content ILIKE '%' || p_query || '%'
        OR l.summary ILIKE '%' || p_query || '%'
    )
    ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Increment lesson view count
-- ============================================
CREATE OR REPLACE FUNCTION increment_lesson_views(
    p_lesson_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE lessons
    SET view_count = view_count + 1
    WHERE id = p_lesson_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Increment conversation message count
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
