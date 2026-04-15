import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, TypingIndicator } from './ChatMessage';
import { MessageActions } from './MessageActions';
import {
  ConceptTemplate,
  TutorialTemplate,
  ComparisonTemplate,
  TroubleshootingTemplate,
  CodeImprovementTemplate,
} from './ResponseTemplates';
import { QuizComponent, QuizSet } from './QuizComponent';
import { RelatedTopics, LearningPath, NextStep } from './RelatedTopics';
import { CodePlayground, InlineCodeEditor } from './CodePlayground';

/**
 * Component Showcase for all supporting components
 * Demonstrates usage and capabilities
 */

export default function ComponentShowcase() {
  const [quizScore, setQuizScore] = useState<{ score: number; total: number } | null>(null);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="space-y-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold">LearnSphere Component Library</h1>
          <p className="text-muted-foreground mt-2">
            Supporting components for enhanced learning experiences
          </p>
        </div>
      </div>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        {/* ChatMessage Examples */}
        <TabsContent value="messages" className="space-y-6 mt-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Chat Messages</h2>
            <p className="text-sm text-muted-foreground">
              Enhanced message components with actions, metadata, and beautiful formatting
            </p>

            <div className="space-y-4 p-6 bg-muted/20 rounded-lg">
              <ChatMessage
                id="1"
                role="user"
                content="Can you explain React hooks?"
                timestamp={new Date()}
              />

              <ChatMessage
                id="2"
                role="assistant"
                content="React Hooks are **functions** that let you use state and other React features without writing a class. They were introduced in React 16.8 and include `useState`, `useEffect`, and more."
                difficulty="intermediate"
                timeEstimate={10}
                timestamp={new Date()}
                onRegenerate={() => alert('Regenerate clicked')}
                onFeedback={(type) => alert(`Feedback: ${type}`)}
                onBookmark={() => alert('Bookmarked')}
              />

              <TypingIndicator />
            </div>
          </div>
        </TabsContent>

        {/* Response Templates */}
        <TabsContent value="templates" className="space-y-8 mt-6">
          <h2 className="text-2xl font-semibold">Response Templates</h2>

          <div className="space-y-8">
            {/* Concept Template */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">1. Concept Template</h3>
              <div className="p-6 bg-card border rounded-lg">
                <ConceptTemplate
                  title="Understanding Closures"
                  difficulty="intermediate"
                  timeEstimate={12}
                  overview="A closure is a function that has access to variables in its outer (enclosing) lexical scope, even after the outer function has returned."
                  keyPoints={[
                    'Closures allow data privacy and encapsulation',
                    'They remember the environment in which they were created',
                    'Commonly used in callbacks and event handlers',
                  ]}
                  example="Think of a closure like a backpack - the function carries its environment with it wherever it goes."
                  codeExample={{
                    language: 'javascript',
                    code: `function outer() {
  let count = 0;
  return function inner() {
    count++;
    return count;
  };
}

const counter = outer();
console.log(counter()); // 1
console.log(counter()); // 2`,
                  }}
                  tipContent="Closures are powerful but can cause memory leaks if not used carefully!"
                />
              </div>
            </div>

            {/* Tutorial Template */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">2. Tutorial Template</h3>
              <div className="p-6 bg-card border rounded-lg">
                <TutorialTemplate
                  title="Building Your First React App"
                  difficulty="beginner"
                  timeEstimate={20}
                  prerequisites={[
                    'Node.js installed (v14+)',
                    'Basic JavaScript knowledge',
                    'Code editor (VS Code recommended)',
                  ]}
                  steps={[
                    {
                      title: 'Create New Project',
                      content: 'Use Create React App to set up your project:',
                      code: 'npx create-react-app my-app\ncd my-app',
                      language: 'bash',
                    },
                    {
                      title: 'Start Development Server',
                      content: 'Run the development server to see your app:',
                      code: 'npm start',
                      language: 'bash',
                    },
                    {
                      title: 'Edit Your First Component',
                      content: 'Open src/App.js and make changes to see them live!',
                    },
                  ]}
                  successTip="Your React app is now running! Open http://localhost:3000 to see it."
                  nextSteps={[
                    'Learn about JSX syntax',
                    'Explore React components',
                    'Add styling with CSS',
                  ]}
                />
              </div>
            </div>

            {/* Comparison Template */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">3. Comparison Template</h3>
              <div className="p-6 bg-card border rounded-lg">
                <ComparisonTemplate
                  title="SQL vs NoSQL Databases"
                  difficulty="intermediate"
                  timeEstimate={15}
                  options={[
                    {
                      name: 'SQL (Relational)',
                      description: 'Structured databases with predefined schemas',
                      pros: [
                        'ACID compliance ensures data integrity',
                        'Powerful query language (SQL)',
                        'Great for complex relationships',
                      ],
                      cons: [
                        'Less flexible schema',
                        'Harder to scale horizontally',
                        'Can be slower with large datasets',
                      ],
                      bestFor: 'Financial systems, data warehouses, CRM',
                    },
                    {
                      name: 'NoSQL (Document/Key-Value)',
                      description: 'Flexible, schema-less databases',
                      pros: [
                        'Highly scalable horizontally',
                        'Flexible schema evolution',
                        'Fast for simple queries',
                      ],
                      cons: [
                        'No ACID guarantees by default',
                        'Less powerful query capabilities',
                        'Can lead to data inconsistency',
                      ],
                      bestFor: 'Social media, real-time apps, IoT',
                    },
                  ]}
                  recommendation="Choose SQL for structured data with complex relationships. Choose NoSQL for rapid development and massive scale."
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Quiz Components */}
        <TabsContent value="quiz" className="space-y-6 mt-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Interactive Quizzes</h2>

            <div className="space-y-6">
              {/* Single Question */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Single Question Quiz</h3>
                <QuizComponent
                  question={{
                    question: 'What does the useState hook return?',
                    options: [
                      {
                        id: '1',
                        text: 'A single state value',
                        isCorrect: false,
                        explanation: 'useState returns an array, not just a value',
                      },
                      {
                        id: '2',
                        text: 'An array with [state, setState]',
                        isCorrect: true,
                        explanation: 'Correct! useState returns an array with the current state and a setter function',
                      },
                      {
                        id: '3',
                        text: 'An object with state properties',
                        isCorrect: false,
                        explanation: 'useState returns an array, not an object',
                      },
                    ],
                    hint: 'Think about array destructuring syntax',
                  }}
                  onComplete={(correct, selections) =>
                    console.log('Quiz completed:', { correct, selections })
                  }
                />
              </div>

              {/* Multi-Question Quiz */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Multi-Question Quiz Set</h3>
                {!quizScore ? (
                  <QuizSet
                    title="React Fundamentals Quiz"
                    questions={[
                      {
                        question: 'What is JSX?',
                        options: [
                          { id: '1', text: 'A JavaScript extension', isCorrect: false },
                          { id: '2', text: 'A syntax extension for JavaScript', isCorrect: true },
                          { id: '3', text: 'A new programming language', isCorrect: false },
                        ],
                      },
                      {
                        question: 'Which are valid React hooks?',
                        multipleChoice: true,
                        options: [
                          { id: '1', text: 'useState', isCorrect: true },
                          { id: '2', text: 'useEffect', isCorrect: true },
                          { id: '3', text: 'useRun', isCorrect: false },
                          { id: '4', text: 'useContext', isCorrect: true },
                        ],
                      },
                    ]}
                    onComplete={(score, total) => setQuizScore({ score, total })}
                  />
                ) : (
                  <div className="p-6 bg-card border rounded-lg text-center space-y-3">
                    <div className="text-4xl">
                      {quizScore.score === quizScore.total ? '🎉' : '👍'}
                    </div>
                    <h3 className="text-xl font-semibold">
                      Quiz Complete!
                    </h3>
                    <p className="text-muted-foreground">
                      You scored {quizScore.score} out of {quizScore.total}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Related Topics */}
        <TabsContent value="topics" className="space-y-6 mt-6">
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold">Related Topics & Learning Paths</h2>
            </div>

            <div className="space-y-6">
              {/* Related Topics - Detailed */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Related Topics (Detailed)</h3>
                <RelatedTopics
                  topics={[
                    {
                      title: 'Advanced React Hooks',
                      description: 'Learn useCallback, useMemo, and custom hooks',
                      type: 'lesson',
                      difficulty: 'advanced',
                      timeEstimate: 30,
                      onClick: () => alert('Navigate to lesson'),
                    },
                    {
                      title: 'State Management with Redux',
                      description: 'Manage complex application state effectively',
                      type: 'tutorial',
                      difficulty: 'intermediate',
                      timeEstimate: 45,
                      onClick: () => alert('Navigate to tutorial'),
                    },
                    {
                      title: 'React Performance Optimization',
                      description: 'Make your React apps blazingly fast',
                      type: 'video',
                      difficulty: 'advanced',
                      timeEstimate: 25,
                      onClick: () => alert('Navigate to video'),
                    },
                  ]}
                  onTopicClick={(topic) => console.log('Topic clicked:', topic)}
                />
              </div>

              {/* Related Topics - Compact */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Related Topics (Compact)</h3>
                <RelatedTopics
                  variant="compact"
                  title="Quick Links"
                  topics={[
                    { title: 'useEffect Guide', type: 'lesson' },
                    { title: 'Context API', type: 'tutorial' },
                    { title: 'React Router', type: 'article' },
                  ]}
                />
              </div>

              {/* Learning Path */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Learning Path</h3>
                <LearningPath
                  currentIndex={2}
                  topics={[
                    {
                      title: 'React Basics',
                      description: 'Components, props, and JSX',
                      timeEstimate: 30,
                    },
                    {
                      title: 'React Hooks',
                      description: 'useState and useEffect',
                      timeEstimate: 45,
                    },
                    {
                      title: 'State Management',
                      description: 'Context API and Redux basics',
                      timeEstimate: 60,
                    },
                    {
                      title: 'Advanced Patterns',
                      description: 'Custom hooks and optimization',
                      timeEstimate: 50,
                    },
                  ]}
                  onTopicClick={(topic, idx) =>
                    console.log(`Topic ${idx} clicked:`, topic)
                  }
                />
              </div>

              {/* Next Step */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Next Step Suggestion</h3>
                <NextStep
                  title="Ready for the next challenge?"
                  description="Now that you understand React hooks, it's time to learn about state management patterns and the Context API."
                  action="Start Learning"
                  onAction={() => alert('Navigate to next lesson')}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Code Playground */}
        <TabsContent value="code" className="space-y-6 mt-6">
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Code Playground</h2>

            <div className="space-y-6">
              {/* Full Playground */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Interactive Code Editor</h3>
                <CodePlayground
                  title="Try useState Hook"
                  description="Edit and run this code to see useState in action"
                  defaultCode={`import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}`}
                  language="javascript"
                  onRun={async (code) => {
                    return `// Simulated output\nComponent rendered successfully!\nInitial count: 0`;
                  }}
                />
              </div>

              {/* Inline Editor */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Inline Code Editor</h3>
                <InlineCodeEditor
                  code={`const greeting = "Hello, World!";
console.log(greeting);`}
                  language="javascript"
                  onChange={(code) => console.log('Code changed:', code)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Message Actions */}
        <TabsContent value="actions" className="space-y-6 mt-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Message Actions</h2>
            <p className="text-sm text-muted-foreground">
              Interactive actions for chat messages (hover to see)
            </p>

            <div className="p-6 bg-muted/20 rounded-lg group">
              <div className="space-y-4">
                <p className="text-sm">
                  This is a sample message with actions. Hover over this area to see the action buttons.
                </p>

                <MessageActions
                  content="This is a sample message with actions. Hover over this area to see the action buttons."
                  onRegenerate={() => alert('Regenerate clicked')}
                  onFeedback={(type) => alert(`Feedback: ${type}`)}
                  onBookmark={() => alert('Bookmarked')}
                  className="opacity-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold">Available Actions:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6 list-disc">
                <li>Copy to clipboard</li>
                <li>Thumbs up/down feedback</li>
                <li>Bookmark message</li>
                <li>Text-to-speech (read aloud)</li>
                <li>Regenerate response</li>
                <li>Share message</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
