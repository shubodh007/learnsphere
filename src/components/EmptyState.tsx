import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, MessageSquare, Code2, Video, BarChart3, Home, Flame } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      {action}
    </motion.div>
  );
}

export const emptyStateConfig = {
  dashboard: {
    icon: <Home className="h-12 w-12" />,
    title: 'Welcome to LearnSphere AI!',
    description: 'Start your learning journey by generating a lesson, chatting with AI, or exploring code.',
  },
  lessons: {
    icon: <BookOpen className="h-12 w-12" />,
    title: 'No lessons yet',
    description: 'Generate your first AI lesson to start learning any topic.',
  },
  chat: {
    icon: <MessageSquare className="h-12 w-12" />,
    title: 'Start a conversation',
    description: 'Chat with your AI tutor about any topic you want to learn.',
  },
  code: {
    icon: <Code2 className="h-12 w-12" />,
    title: 'Generate code',
    description: 'Describe a coding task to get AI-generated code with explanations.',
  },
  videos: {
    icon: <Video className="h-12 w-12" />,
    title: 'Discover tutorials',
    description: 'Search for video tutorials on any topic.',
  },
  analytics: {
    icon: <BarChart3 className="h-12 w-12" />,
    title: 'No data yet',
    description: 'Complete some lessons to see your learning analytics.',
  },
  streak: {
    icon: <Flame className="h-12 w-12" />,
    title: 'Start your streak',
    description: 'Learn something every day to build your streak.',
  },
};
