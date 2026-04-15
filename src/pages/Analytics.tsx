import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Loader2, TrendingUp, Calendar, Award, Target, BookOpen, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAnalyticsQuery } from '@/hooks/use-queries';
import { toast } from 'sonner';

export default function Analytics() {
  const { user } = useAuth();
  const { data: analyticsData, isLoading, error } = useAnalyticsQuery(user?.id);

  const streak = analyticsData?.streak;
  const weeklyStats = analyticsData?.dailyStats || [];
  const recentActivity = analyticsData?.recentActivity || [];

  // Calculate totals from last 7 days
  const totals = weeklyStats.reduce(
    (acc, day) => ({
      lessons: acc.lessons + (day.lessons_completed || 0),
      chat: acc.chat + (day.chat_messages || 0),
      code: acc.code + (day.code_generated || 0),
      videos: acc.videos + (day.videos_watched || 0),
    }),
    { lessons: 0, chat: 0, code: 0, videos: 0 }
  );

  const hasData = streak || weeklyStats.length > 0 || recentActivity.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    console.error('Error fetching analytics data:', error);
    return (
      <div className="p-4 md:p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your learning progress</p>
        </motion.div>

        <Card className="bg-card border-border border-destructive/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load Analytics</h3>
            <p className="text-muted-foreground mb-4">
              {error?.message || 'Unable to fetch analytics data. Please try again.'}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your learning progress</p>
        </motion.div>

        <EmptyState
          {...emptyStateConfig.analytics}
          action={
            <Link to="/learn/new">
              <Button className="gradient-bg border-0">Generate Your First Lesson</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your learning progress</p>
      </motion.div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Award className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{streak?.current_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Current Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Target className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{streak?.longest_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Longest Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totals.lessons}</p>
                <p className="text-xs text-muted-foreground">Lessons (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{recentActivity.length}</p>
                <p className="text-xs text-muted-foreground">Recent Activities</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity */}
      {weeklyStats.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              Weekly Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-32">
              {weeklyStats.map((day) => {
                const total = (day.lessons_completed || 0) + (day.chat_messages || 0) + (day.code_generated || 0);
                const height = Math.min(100, Math.max(10, total * 10));
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full bg-primary/80 rounded-t"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{getDayLabel(day.date)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="p-2 rounded-lg bg-muted">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {activity.activity_type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
