import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface CodeEditorProps {
  code: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string;
}

function EditorSkeleton() {
  return (
    <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// Map common language names to Monaco language IDs
function getMonacoLanguage(language: string): string {
  const langMap: Record<string, string> = {
    'javascript': 'javascript',
    'typescript': 'typescript',
    'python': 'python',
    'java': 'java',
    'c++': 'cpp',
    'cpp': 'cpp',
    'go': 'go',
    'rust': 'rust',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'sql': 'sql',
    'bash': 'shell',
    'shell': 'shell',
  };
  return langMap[language.toLowerCase()] || 'plaintext';
}

export default function CodeEditor({
  code,
  language,
  onChange,
  readOnly = true,
  height = '300px',
}: CodeEditorProps) {
  const monacoLanguage = getMonacoLanguage(language);

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <div className="rounded-lg overflow-hidden border border-border">
        <MonacoEditor
          height={height}
          language={monacoLanguage}
          value={code}
          onChange={onChange}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            wordWrap: 'on',
          }}
        />
      </div>
    </Suspense>
  );
}
