import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, MessageSquare, Code2, Video, Flame, Clock, Trophy, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';

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
  // Placeholder stats - will be fetched from Supabase
  const hasActivity = false;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your learning overview.</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, label: 'Lessons', value: '0', subtext: 'completed' },
          { icon: Flame, label: 'Streak', value: '0', subtext: 'days' },
          { icon: Clock, label: 'Time Spent', value: '0h', subtext: 'total' },
          { icon: Zap, label: 'Code Generated', value: '0', subtext: 'snippets' },
        ].map((stat) => (
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
        {hasActivity ? (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              {/* Activity items will go here */}
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
