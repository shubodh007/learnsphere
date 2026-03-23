import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';

export default function Analytics() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your learning progress</p>
      </motion.div>

      <EmptyState
        {...emptyStateConfig.analytics}
      />
    </div>
  );
}
