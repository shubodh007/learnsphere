import { EmptyState, emptyStateConfig } from '@/components/EmptyState';

export default function LessonViewer() {
  // TODO: fetch lesson by slug from route params
  return (
    <div className="p-4 md:p-6">
      <EmptyState
        {...emptyStateConfig.lessons}
        title="Lesson not found"
        description="This lesson doesn't exist or hasn't been generated yet."
      />
    </div>
  );
}
