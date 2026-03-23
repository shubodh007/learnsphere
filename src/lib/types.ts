export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  learning_goals: string[] | null;
  preferred_topics: string[] | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  user_id: string;
  topic: string;
  slug: string;
  content: string;
  summary: string | null;
  key_takeaways: string[] | null;
  examples: unknown[] | null;
  questions: unknown[] | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  category_id: string | null;
  is_public: boolean;
  view_count: number;
  like_count: number;
  ai_model_used: string | null;
  generation_time_ms: number | null;
  version: number;
  metadata: Record<string, unknown>;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CodeSnippet {
  id: string;
  user_id: string;
  topic: string;
  code: string;
  language: string;
  explanation: string | null;
  execution_instructions: string | null;
  is_public: boolean;
  ai_model_used: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  last_message_at: string | null;
  message_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  ai_model_used: string | null;
  tokens_used: number | null;
  response_time_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SavedVideo {
  id: string;
  user_id: string;
  youtube_video_id: string;
  title: string;
  channel_title: string | null;
  thumbnail_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface VideoSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
  publishedAt: string;
}

export interface DailyStats {
  id: string;
  user_id: string;
  date: string;
  lessons_completed: number;
  code_generated: number;
  chat_messages: number;
  videos_watched: number;
  time_spent_minutes: number;
}

export interface LearningStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  updated_at: string;
}

export interface TopicMastery {
  id: string;
  user_id: string;
  topic: string;
  mastery_level: number;
  lessons_completed: number;
  last_practiced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: 'lesson_generated' | 'chat_message' | 'code_generated' | 'video_watched';
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GenerateLessonResponse {
  title: string;
  slug: string;
  summary: string;
  content: string;
  key_takeaways: string[];
  examples: string[];
  questions: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface GenerateCodeResponse {
  code: string;
  language: string;
  explanation: string;
}
