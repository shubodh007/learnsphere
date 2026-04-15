import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Play,
  RotateCcw,
  Copy,
  Check,
  Download,
  ExternalLink,
  Maximize2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CodePlaygroundProps {
  defaultCode?: string;
  language?: string;
  title?: string;
  description?: string;
  readOnly?: boolean;
  showOutput?: boolean;
  onRun?: (code: string) => Promise<string>;
  className?: string;
}

export function CodePlayground({
  defaultCode = '',
  language = 'javascript',
  title,
  description,
  readOnly = false,
  showOutput = true,
  onRun,
  className,
}: CodePlaygroundProps) {
  const [code, setCode] = useState(defaultCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleRun = async () => {
    if (!onRun) {
      setOutput('// Output will appear here when run\nconsole.log("Code execution not configured")');
      return;
    }

    setIsRunning(true);
    setOutput('Running...');

    try {
      const result = await onRun(code);
      setOutput(result);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCode(defaultCode);
    setOutput('');
    toast({ title: 'Reset', description: 'Code reset to original' });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Code copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy code',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${language}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: 'Code saved to file' });
  };

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden bg-card', className)}>
      {/* Header */}
      {(title || description) && (
        <div className="px-4 py-3 border-b border-border space-y-1">
          {title && (
            <h4 className="text-sm font-semibold">{title}</h4>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground uppercase">
            {language}
          </span>
          {!readOnly && (
            <span className="text-xs text-muted-foreground">
              • Editable
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 text-xs gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs gap-1"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 text-xs gap-1"
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
        </div>
      </div>

      {/* Code/Output Tabs */}
      <Tabs defaultValue="code" className="w-full">
        <div className="px-4 pt-2 bg-muted/10 border-b border-border">
          <TabsList className="h-8">
            <TabsTrigger value="code" className="text-xs">
              Code
            </TabsTrigger>
            {showOutput && (
              <TabsTrigger value="output" className="text-xs">
                Output
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="code" className="m-0">
          <div className="relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              readOnly={readOnly}
              className={cn(
                'w-full p-4 font-mono text-xs leading-relaxed',
                'bg-muted/20 text-foreground',
                'border-0 outline-none resize-none',
                'min-h-[200px] max-h-[400px]',
                readOnly && 'cursor-default'
              )}
              spellCheck={false}
            />

            {!readOnly && (
              <div className="absolute bottom-2 right-2">
                <Button
                  size="sm"
                  onClick={handleRun}
                  disabled={isRunning || !code.trim()}
                  className="gradient-bg border-0 gap-1"
                >
                  <Play className="h-3 w-3" />
                  {isRunning ? 'Running...' : 'Run Code'}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {showOutput && (
          <TabsContent value="output" className="m-0">
            <div className="p-4 font-mono text-xs leading-relaxed bg-muted/10 text-foreground min-h-[200px] max-h-[400px] overflow-y-auto">
              {output || (
                <span className="text-muted-foreground">
                  Click "Run Code" to see output...
                </span>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Footer with actions */}
      {!readOnly && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Press Ctrl+Enter to run
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Open in Editor
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
            >
              <Maximize2 className="h-3 w-3" />
              Fullscreen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Simpler inline code editor for quick examples
interface InlineCodeEditorProps {
  code: string;
  language?: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function InlineCodeEditor({
  code,
  language = 'javascript',
  onChange,
  readOnly = false,
  className,
}: InlineCodeEditorProps) {
  const [localCode, setLocalCode] = useState(code);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleChange = (newCode: string) => {
    setLocalCode(newCode);
    onChange?.(newCode);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={cn('relative group', className)}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 w-6 p-0 bg-muted/80 hover:bg-muted"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      <div className="rounded-md overflow-hidden border border-border">
        <div className="px-3 py-1 bg-muted/50 border-b border-border">
          <span className="text-xs font-mono text-muted-foreground uppercase">
            {language}
          </span>
        </div>
        <textarea
          value={localCode}
          onChange={(e) => handleChange(e.target.value)}
          readOnly={readOnly}
          className={cn(
            'w-full p-3 font-mono text-xs leading-relaxed',
            'bg-muted/20 text-foreground',
            'border-0 outline-none resize-none',
            'min-h-[100px]',
            readOnly && 'cursor-default'
          )}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
