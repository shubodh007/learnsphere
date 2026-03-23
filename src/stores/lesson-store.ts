import { create } from 'zustand';
import type { Lesson } from '@/lib/types';

interface LessonStore {
  currentLesson: Lesson | null;
  isGenerating: boolean;
  setCurrentLesson: (lesson: Lesson | null) => void;
  setIsGenerating: (generating: boolean) => void;
}

export const useLessonStore = create<LessonStore>((set) => ({
  currentLesson: null,
  isGenerating: false,
  setCurrentLesson: (lesson) => set({ currentLesson: lesson }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
}));
