import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, MessageSquare, Code2, Video, Flame, Clock, Zap, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';
import { useAuth } from '@/hooks/use-auth';
import { useDashboardStatsQuery } from '@/hooks/use-queries';

const quickActions = [
  { to: '/learn/new', icon: BookOpen, label: 'Generate Lesson', color: 'from-blue-500 to-blue-600' },
  { to: '/chat', icon: MessageSquare, label: 'Chat with AI', color: 'from-purple-500 to-purple-600' },
  { to: '/code', icon: Code2, label: 'Generate Code', color: 'from-green-500 to-green-600' },
  { to: '/videos', icon: Video, label: 'Watch Videos', color: 'from-red-500 to-red-600' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { user } = useAuth();
  const { data: dashboardData, isLoading, error } = useDashboardStatsQuery(user?.id);

  const stats = dashboardData || {
    lessonsCompleted: 0,
    currentStreak: 0,
    timeSpentMinutes: 0,
    codeGenerated: 0,
    recentActivity: [],
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatActivityTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getActivityLabel = (type: string): string => {
    switch (type) {
      case 'lesson_generated': return 'Generated a lesson';
      case 'chat_message': return 'Chatted with AI';
      case 'code_generated': return 'Generated code';
      case 'video_watched': return 'Watched a video';
      default: return 'Activity';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lesson_generated': return BookOpen;
      case 'chat_message': return MessageSquare;
      case 'code_generated': return Code2;
      case 'video_watched': return Video;
      default: return Zap;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    console.error('Error fetching dashboard data:', error);
  }

  const statsData = [
    { icon: BookOpen, label: 'Lessons', value: stats.lessonsCompleted.toString(), subtext: 'completed' },
    { icon: Flame, label: 'Streak', value: stats.currentStreak.toString(), subtext: 'days' },
    { icon: Clock, label: 'Time Spent', value: formatTime(stats.timeSpentMinutes), subtext: 'total' },
    { icon: Zap, label: 'Code Generated', value: stats.codeGenerated.toString(), subtext: 'snippets' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your learning overview.</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.subtext}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to}>
              <Card className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color}`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors text-sm">
                    {action.label}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Recent Activity</h2>
        {stats.recentActivity.length > 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              {stats.recentActivity.map((activity) => {
                const Icon = getActivityIcon(activity.activity_type);
                return (
                  <div key={activity.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{getActivityLabel(activity.activity_type)}</p>
                      <p className="text-xs text-muted-foreground">{formatActivityTime(activity.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <EmptyState
                {...emptyStateConfig.dashboard}
                action={
                  <Link to="/learn/new">
                    <Button className="gradient-bg border-0">Generate Your First Lesson</Button>
                  </Link>
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
