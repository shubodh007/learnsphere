import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Copy, Check, Code2 } from 'lucide-react';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';
import { useToast } from '@/hooks/use-toast';

const languages = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Go', 'Rust',
];

export default function CodePage() {
  const [task, setTask] = useState('');
  const [language, setLanguage] = useState('JavaScript');
  const [generatedCode, setGeneratedCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!task.trim()) return;
    setIsGenerating(true);
    toast({
      title: 'Backend not connected',
      description: 'Enable Lovable Cloud to generate code.',
      variant: 'destructive',
    });
    setIsGenerating(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Code Generator</h1>
        <p className="text-muted-foreground mt-1">Generate code with AI explanations</p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              Describe Your Task
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Task Description</Label>
              <Textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g., Write a function that sorts an array using quicksort..."
                rows={6}
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !task.trim()}
              className="w-full gradient-bg border-0"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Code2 className="h-4 w-4 mr-2" /> Generate Code</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Generated Code</CardTitle>
              {generatedCode && (
                <Button variant="ghost" size="sm" onClick={copyCode}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedCode ? (
              <div className="space-y-4">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
                  <code>{generatedCode}</code>
                </pre>
                {explanation && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Explanation</h4>
                    <p className="text-sm text-muted-foreground">{explanation}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                {...emptyStateConfig.code}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
