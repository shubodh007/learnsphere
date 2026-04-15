-- LearnSphere backend consistency fix
-- Aligns activity_log allowed activity types with youtube-search edge function usage.

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_activity_type_check;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_activity_type_check
  CHECK (
    activity_type IN (
      'lesson_generated',
      'chat_message',
      'code_generated',
      'video_watched',
      'video_searched'
    )
  );

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
        CASE WHEN NEW.activity_type IN ('video_watched', 'video_searched') THEN 1 ELSE 0 END
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