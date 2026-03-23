import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, BookOpen, MessageSquare, Code2, Video, Sparkles, ArrowRight, Zap, Brain, Users } from 'lucide-react';

const features = [
  {
    icon: BookOpen,
    title: 'AI Lessons',
    description: 'Generate comprehensive lessons on any topic with AI-powered content.',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat Tutor',
    description: 'Chat with an AI tutor that adapts to your learning style.',
  },
  {
    icon: Code2,
    title: 'Code Generation',
    description: 'Generate, explain, and run code in multiple programming languages.',
  },
  {
    icon: Video,
    title: 'Video Tutorials',
    description: 'Discover and save the best video tutorials from YouTube.',
  },
];

const stats = [
  { value: '10+', label: 'Topics Available' },
  { value: '7+', label: 'Languages Supported' },
  { value: 'Free', label: 'AI Models' },
  { value: '∞', label: 'Text-to-Speech' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-bg">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">LearnSphere AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="gradient-bg border-0">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary">Powered by Free AI Models</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Learn Anything with{' '}
              <span className="gradient-text">AI</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Generate lessons, chat with AI tutors, explore code, and watch curated tutorials —
              all powered by cutting-edge AI models, completely free.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="gradient-bg border-0 text-lg px-8">
                  Start Learning <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="text-lg px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Learn</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete AI-powered learning platform with all the tools you need.
            </p>
          </div>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={item}>
                <Card className="bg-card border-border hover:border-primary/50 transition-colors h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg gradient-bg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Why LearnSphere */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: 'Lightning Fast', description: 'Generate lessons in seconds with free AI models.' },
              { icon: Brain, title: 'Adaptive Learning', description: 'AI adapts to your skill level and learning pace.' },
              { icon: Users, title: 'Community Driven', description: 'Share lessons and learn from others in the community.' },
            ].map((item) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-full gradient-bg-accent flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Learn?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Join LearnSphere AI and start your learning journey today.
          </p>
          <Link to="/register">
            <Button size="lg" className="gradient-bg border-0 text-lg px-8">
              Get Started — It's Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span>LearnSphere AI</span>
          </div>
          <p>© {new Date().getFullYear()} LearnSphere AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
