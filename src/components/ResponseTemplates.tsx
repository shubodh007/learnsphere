import { ReactNode } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  DifficultyBadge,
  CalloutBox,
  TimeEstimate,
  StepItem,
  CodeComparison,
} from './EducationalFormatter';
import { cn } from '@/lib/utils';
import { BookOpen, Code, Lightbulb, Wrench } from 'lucide-react';

/**
 * Pre-built response templates for common educational patterns
 */

interface BaseTemplateProps {
  title: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  timeEstimate?: number;
  children: ReactNode;
  className?: string;
}

// Base Template Wrapper
function BaseTemplate({ title, difficulty, timeEstimate, children, className }: BaseTemplateProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with metadata */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold">{title}</h2>
          {(difficulty || timeEstimate) && (
            <div className="flex gap-2">
              {difficulty && <DifficultyBadge level={difficulty} />}
              {timeEstimate && <TimeEstimate minutes={timeEstimate} />}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

// 1. Concept Explanation Template
interface ConceptTemplateProps extends BaseTemplateProps {
  overview: string;
  keyPoints: string[];
  example?: string;
  codeExample?: {
    code: string;
    language: string;
  };
  tipContent?: string;
}

export function ConceptTemplate({
  title,
  difficulty,
  timeEstimate,
  overview,
  keyPoints,
  example,
  codeExample,
  tipContent,
  className,
}: ConceptTemplateProps) {
  return (
    <BaseTemplate title={title} difficulty={difficulty} timeEstimate={timeEstimate} className={className}>
      <CalloutBox type="concept" title="What is it?">
        <p>{overview}</p>
      </CalloutBox>

      <div>
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Key Points
        </h3>
        <ul className="space-y-2 ml-6 list-disc marker:text-primary">
          {keyPoints.map((point, idx) => (
            <li key={idx} className="text-sm leading-relaxed">{point}</li>
          ))}
        </ul>
      </div>

      {example && (
        <div>
          <h3 className="text-base font-semibold mb-2">Real-World Example</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{example}</p>
        </div>
      )}

      {codeExample && (
        <div>
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
            <Code className="h-4 w-4" />
            Code Example
          </h3>
          <MarkdownRenderer content={`\`\`\`${codeExample.language}\n${codeExample.code}\n\`\`\``} />
        </div>
      )}

      {tipContent && (
        <CalloutBox type="tip">
          {tipContent}
        </CalloutBox>
      )}
    </BaseTemplate>
  );
}

// 2. Step-by-Step Tutorial Template
interface TutorialStep {
  title: string;
  content: string;
  code?: string;
  language?: string;
}

interface TutorialTemplateProps extends BaseTemplateProps {
  prerequisites?: string[];
  steps: TutorialStep[];
  successTip?: string;
  nextSteps?: string[];
}

export function TutorialTemplate({
  title,
  difficulty,
  timeEstimate,
  prerequisites,
  steps,
  successTip,
  nextSteps,
  className,
}: TutorialTemplateProps) {
  return (
    <BaseTemplate title={title} difficulty={difficulty} timeEstimate={timeEstimate} className={className}>
      {prerequisites && prerequisites.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-2">Prerequisites</h3>
          <ul className="space-y-1 ml-6">
            {prerequisites.map((prereq, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-muted-foreground">☐</span>
                {prereq}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-base font-semibold mb-4">Step-by-Step Guide</h3>
        <div className="space-y-0">
          {steps.map((step, idx) => (
            <StepItem key={idx} number={idx + 1} title={step.title}>
              <p className="mb-2">{step.content}</p>
              {step.code && (
                <MarkdownRenderer content={`\`\`\`${step.language || 'bash'}\n${step.code}\n\`\`\``} />
              )}
            </StepItem>
          ))}
        </div>
      </div>

      {successTip && (
        <CalloutBox type="success">
          {successTip}
        </CalloutBox>
      )}

      {nextSteps && nextSteps.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-2">Next Steps</h3>
          <ul className="space-y-2 ml-6 list-disc marker:text-primary">
            {nextSteps.map((step, idx) => (
              <li key={idx} className="text-sm leading-relaxed">{step}</li>
            ))}
          </ul>
        </div>
      )}
    </BaseTemplate>
  );
}

// 3. Comparison Template
interface ComparisonOption {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  bestFor?: string;
}

interface ComparisonTemplateProps extends BaseTemplateProps {
  options: ComparisonOption[];
  recommendation?: string;
}

export function ComparisonTemplate({
  title,
  difficulty,
  timeEstimate,
  options,
  recommendation,
  className,
}: ComparisonTemplateProps) {
  return (
    <BaseTemplate title={title} difficulty={difficulty} timeEstimate={timeEstimate} className={className}>
      <div className="space-y-6">
        {options.map((option, idx) => (
          <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-base font-semibold">{option.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                  ✓ Strengths
                </h4>
                <ul className="space-y-1">
                  {option.pros.map((pro, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                  ✗ Limitations
                </h4>
                <ul className="space-y-1">
                  {option.cons.map((con, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-red-600 dark:text-red-400 mt-0.5">•</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {option.bestFor && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs">
                  <span className="font-semibold">Best for:</span>{' '}
                  <span className="text-muted-foreground">{option.bestFor}</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {recommendation && (
        <CalloutBox type="tip" title="Recommendation">
          {recommendation}
        </CalloutBox>
      )}
    </BaseTemplate>
  );
}

// 4. Troubleshooting Template
interface TroubleshootingStep {
  check: string;
  solution: string;
}

interface TroubleshootingTemplateProps extends BaseTemplateProps {
  problem: string;
  cause?: string;
  diagnosticSteps: TroubleshootingStep[];
  prevention?: string;
}

export function TroubleshootingTemplate({
  title,
  difficulty,
  timeEstimate,
  problem,
  cause,
  diagnosticSteps,
  prevention,
  className,
}: TroubleshootingTemplateProps) {
  return (
    <BaseTemplate title={title} difficulty={difficulty} timeEstimate={timeEstimate} className={className}>
      <div>
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Problem Description
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{problem}</p>
      </div>

      {cause && (
        <CalloutBox type="info" title="Likely Cause">
          {cause}
        </CalloutBox>
      )}

      <div>
        <h3 className="text-base font-semibold mb-3">Diagnostic & Solutions</h3>
        <div className="space-y-3">
          {diagnosticSteps.map((step, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-sm text-primary">#{idx + 1}</span>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{step.check}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.solution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {prevention && (
        <CalloutBox type="tip" title="How to Prevent This">
          {prevention}
        </CalloutBox>
      )}
    </BaseTemplate>
  );
}

// 5. Code Improvement Template
interface CodeImprovementTemplateProps extends BaseTemplateProps {
  context: string;
  before: string;
  after: string;
  language: string;
  improvements: string[];
  warning?: string;
}

export function CodeImprovementTemplate({
  title,
  difficulty,
  timeEstimate,
  context,
  before,
  after,
  language,
  improvements,
  warning,
  className,
}: CodeImprovementTemplateProps) {
  return (
    <BaseTemplate title={title} difficulty={difficulty} timeEstimate={timeEstimate} className={className}>
      <p className="text-sm text-muted-foreground leading-relaxed">{context}</p>

      <CodeComparison before={before} after={after} language={language} />

      <div>
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Key Improvements
        </h3>
        <ul className="space-y-2 ml-6 list-disc marker:text-primary">
          {improvements.map((improvement, idx) => (
            <li key={idx} className="text-sm leading-relaxed">{improvement}</li>
          ))}
        </ul>
      </div>

      {warning && (
        <CalloutBox type="warning">
          {warning}
        </CalloutBox>
      )}
    </BaseTemplate>
  );
}
