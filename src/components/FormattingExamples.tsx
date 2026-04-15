import {
  DifficultyBadge,
  CalloutBox,
  ProgressBar,
  StepItem,
  StatCard,
  Achievement,
  TimeEstimate,
  CodeComparison,
} from '@/components/EducationalFormatter';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { BookOpen, Code, Trophy, Zap } from 'lucide-react';

/**
 * Educational Formatting Examples
 *
 * This file demonstrates how to use the educational components
 * in your LearnSphere application.
 */

export function FormattingExamples() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-12">

      {/* Example 1: Course Header with Metadata */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 1: Course Header</h2>
        <div className="p-6 bg-card rounded-lg border space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-xl font-semibold">Introduction to React Hooks</h3>
            <div className="flex gap-2">
              <DifficultyBadge level="intermediate" />
              <TimeEstimate minutes={25} />
            </div>
          </div>
          <p className="text-muted-foreground">
            Learn how to use React Hooks to manage state and side effects in functional components.
          </p>
        </div>
      </section>

      {/* Example 2: Callout Boxes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 2: Learning Callouts</h2>
        <div className="space-y-3">
          <CalloutBox type="concept">
            <strong>Hooks</strong> are functions that let you "hook into" React features
            from function components. They're the modern way to write React applications.
          </CalloutBox>

          <CalloutBox type="tip">
            Start with <code>useState</code> and <code>useEffect</code>.
            They cover 90% of common scenarios!
          </CalloutBox>

          <CalloutBox type="warning" title="Common Mistake">
            Never call hooks inside loops, conditions, or nested functions.
            They must be called at the top level of your component.
          </CalloutBox>

          <CalloutBox type="success">
            You've mastered the basics! You can now build complex React applications
            with hooks.
          </CalloutBox>

          <CalloutBox type="exercise" title="Try This Challenge">
            Create a counter component using useState that increments and decrements
            the count when buttons are clicked.
          </CalloutBox>
        </div>
      </section>

      {/* Example 3: Progress Tracking */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 3: Progress Indicators</h2>
        <div className="space-y-4">
          <ProgressBar progress={75} label="Course Completion" />
          <ProgressBar progress={45} label="JavaScript Fundamentals" />
          <ProgressBar progress={90} label="React Basics" showPercentage />
          <ProgressBar progress={30} label="Advanced Patterns" showPercentage={false} />
        </div>
      </section>

      {/* Example 4: Step-by-Step Tutorial */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 4: Tutorial Steps</h2>
        <div className="space-y-0">
          <StepItem number={1} title="Install Dependencies" isCompleted>
            <p>First, install React in your project:</p>
            <code className="block mt-2 p-2 bg-muted rounded">
              npm install react react-dom
            </code>
          </StepItem>

          <StepItem number={2} title="Create Component">
            <p>Create a new functional component using hooks:</p>
            <code className="block mt-2 p-2 bg-muted rounded text-xs">
              {`function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}`}
            </code>
          </StepItem>

          <StepItem number={3} title="Import and Use">
            <p>Import your component and render it in your app.</p>
          </StepItem>
        </div>
      </section>

      {/* Example 5: Learning Stats */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 5: Learning Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            label="Lessons Completed"
            value={24}
            trend="up"
          />
          <StatCard
            icon={<Code className="h-5 w-5" />}
            label="Code Exercises"
            value={15}
            trend="up"
          />
          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            label="Achievements"
            value={8}
            trend="neutral"
          />
          <StatCard
            icon={<Zap className="h-5 w-5" />}
            label="Learning Streak"
            value="7 days"
            trend="up"
          />
        </div>
      </section>

      {/* Example 6: Achievements */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 6: Achievement Badges</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Achievement
            title="First Steps"
            description="Completed your first lesson"
            earned={true}
          />
          <Achievement
            title="Code Master"
            description="Solved 50 coding challenges"
            earned={true}
          />
          <Achievement
            title="React Expert"
            description="Master all React concepts"
            earned={false}
          />
        </div>
      </section>

      {/* Example 7: Code Comparison */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 7: Before/After Code</h2>
        <CodeComparison
          before={`function OldCounter() {
  var count = 0;

  function increment() {
    count = count + 1;
  }

  return <button onClick={increment}>{count}</button>;
}`}
          after={`function ModernCounter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}`}
          language="javascript"
        />
      </section>

      {/* Example 8: Complete Lesson Format */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 8: Complete Lesson Format</h2>
        <div className="p-6 bg-card rounded-lg border space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-xl font-semibold">Understanding Array Map</h3>
              <div className="flex gap-2">
                <DifficultyBadge level="beginner" />
                <TimeEstimate minutes={15} />
              </div>
            </div>
            <ProgressBar progress={60} label="Lesson Progress" />
          </div>

          {/* Content */}
          <div className="space-y-4">
            <CalloutBox type="concept">
              The <code>map()</code> method creates a new array by applying a function
              to each element of an existing array.
            </CalloutBox>

            <MarkdownRenderer content={`
## Why Use Map?

The \`map()\` method is **essential** for transforming data in React and modern JavaScript.

### Key Benefits:
- Creates new arrays without mutating originals
- Cleaner, more readable code
- Perfect for rendering lists in React
            `} />

            <CodeComparison
              before="const doubled = [];\nnumbers.forEach(n => {\n  doubled.push(n * 2);\n});"
              after="const doubled = numbers.map(n => n * 2);"
              language="javascript"
            />

            <CalloutBox type="tip">
              Remember: <code>map()</code> always returns a new array.
              It never modifies the original!
            </CalloutBox>

            <CalloutBox type="exercise" title="Practice Challenge">
              Given an array <code>[1, 2, 3, 4, 5]</code>, create a new array where
              each number is squared. Try using <code>map()</code>!
            </CalloutBox>
          </div>

          {/* Achievement on completion */}
          <Achievement
            title="Array Master"
            description="Completed the Array Map lesson"
            earned={true}
          />
        </div>
      </section>

      {/* Example 9: Mixed Content with Markdown */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Example 9: Rich Markdown Content</h2>
        <div className="p-6 bg-card rounded-lg border">
          <MarkdownRenderer content={`
# JavaScript Promises 🎯

## What is a Promise?

A **Promise** is an object representing the eventual completion or failure of an asynchronous operation.

### States of a Promise

| State | Description |
|-------|-------------|
| Pending | Initial state, neither fulfilled nor rejected |
| Fulfilled | Operation completed successfully |
| Rejected | Operation failed |

### Basic Syntax

\`\`\`javascript
const promise = new Promise((resolve, reject) => {
  // Async operation here
  if (success) {
    resolve(result);
  } else {
    reject(error);
  }
});

promise
  .then(result => console.log(result))
  .catch(error => console.error(error));
\`\`\`

### Real-World Example

\`\`\`javascript
fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
\`\`\`

> 💡 **Pro Tip:** Modern JavaScript uses \`async/await\` which is built on top of Promises but with cleaner syntax!

---

**Next Steps:** Learn about async/await for even cleaner asynchronous code.
          `} />
        </div>
      </section>

    </div>
  );
}

export default FormattingExamples;
