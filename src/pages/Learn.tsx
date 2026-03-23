import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';
import { Plus } from 'lucide-react';

export default function Learn() {
  // TODO: fetch lessons from Supabase
  const lessons: unknown[] = [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lessons</h1>
          <p className="text-muted-foreground mt-1">Your AI-generated lessons</p>
        </div>
        <Link to="/learn/new">
          <Button className="gradient-bg border-0">
            <Plus className="h-4 w-4 mr-2" /> New Lesson
          </Button>
        </Link>
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          {...emptyStateConfig.lessons}
          action={
            <Link to="/learn/new">
              <Button className="gradient-bg border-0">Generate Your First Lesson</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Lesson cards will go here */}
        </div>
      )}
    </div>
  );
}
