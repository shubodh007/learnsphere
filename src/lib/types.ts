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

// Enhanced Lesson Section Types (used in structured lessons)
export interface LessonCodeBlock {
  language: string;
  caption?: string;
  src: string;
}

export interface LessonCommonMistake {
  mistake: string;
  fix: string;
}

export interface LessonBullet {
  label: string;
  detail: string;
}

export interface LessonSection {
  heading: string;
  body: string;
  bullets: LessonBullet[];
  code?: LessonCodeBlock;
  deep_dive?: string;
  common_mistakes?: LessonCommonMistake[];
}

export interface StructuredLessonMetadata {
  generated_title?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  sections?: LessonSection[];
  structured_format?: boolean;
  validation?: {
    isValid: boolean;
    score: number;
    issues: string[];
  };
  generation_strategy?: {
    route?: string;
    timeout_ms?: number;
    continuation_count?: number;
    regeneration_count?: number;
    quiz_provider?: string | null;
  };
  quality_gate?: {
    passed: boolean;
    reasons: string[];
  };
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
  questions: string[] | null;
  quiz_questions: LessonQuizQuestion[] | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  category_id: string | null;
  is_public: boolean;
  view_count: number;
  like_count: number;
  ai_model_used: string | null;
  generation_time_ms: number | null;
  estimated_read_time_minutes: number | null;
  quality_flag: 'ok' | 'below_threshold' | 'regenerated' | null;
  has_code_examples: boolean | null;
  has_deep_dives: boolean | null;
  word_count: number | null;
  version: number;
  metadata: StructuredLessonMetadata | Record<string, unknown>;
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
  id: string | null;
  title: string;
  topic: string;
  slug: string;
  summary: string;
  content: string;
  sections: LessonSection[];
  key_takeaways: string[];
  questions: string[];
  quiz_questions: LessonQuizQuestion[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_read_time_minutes: number;
  section_count: number;
  has_code_examples: boolean;
  has_deep_dives: boolean;
  generation_time_ms: number;
  generationTimeMs?: number;
  model_used: string;
  cached: boolean;
  quality_flag: 'ok' | 'below_threshold' | 'regenerated';
  similar_lesson: { slug: string; topic: string } | null;
  rate_limit_remaining?: number;
  rate_limit_reset?: string | null;
}

export interface LessonQuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  sectionRef?: string;
  sectionHeading?: string;
}

export interface GenerateLessonQuizResponse {
  questions: LessonQuizQuestion[];
  provider: 'anthropic' | 'openrouter';
}

export type OptimizationLevel = 'bruteforce' | 'optimized' | 'highly-optimized';

export type GenerationMode = 'fast' | 'deep';

export interface GenerateCodeRequest {
  topic: string;
  language?: string;
  optimization?: OptimizationLevel;
  mode?: GenerationMode;
}

export interface GenerateCodeResponse {
  code: string;
  language: string;
  summary: string;
  explanation: string;
  complexity: string;
  debuggingTips: string[];
  optimization: OptimizationLevel;
  mode: GenerationMode;
  generationTimeMs: number;
}
