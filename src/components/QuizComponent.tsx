import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

interface QuizQuestion {
  question: string;
  options: QuizOption[];
  multipleChoice?: boolean;
  hint?: string;
}

interface QuizComponentProps {
  question: QuizQuestion;
  onComplete?: (correct: boolean, selectedIds: string[]) => void;
  showExplanation?: boolean;
  className?: string;
}

export function QuizComponent({
  question,
  onComplete,
  showExplanation = true,
  className,
}: QuizComponentProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const correctIds = question.options.filter(opt => opt.isCorrect).map(opt => opt.id);

  const handleSingleSelect = (id: string) => {
    if (!submitted) {
      setSelectedIds([id]);
    }
  };

  const handleMultiSelect = (id: string, checked: boolean) => {
    if (!submitted) {
      setSelectedIds(prev =>
        checked ? [...prev, id] : prev.filter(selectedId => selectedId !== id)
      );
    }
  };

  const handleSubmit = () => {
    const isCorrect =
      selectedIds.length === correctIds.length &&
      selectedIds.every(id => correctIds.includes(id));

    setSubmitted(true);
    onComplete?.(isCorrect, selectedIds);
  };

  const handleReset = () => {
    setSelectedIds([]);
    setSubmitted(false);
    setShowHint(false);
  };

  const isCorrect = submitted &&
    selectedIds.length === correctIds.length &&
    selectedIds.every(id => correctIds.includes(id));

  return (
    <div className={cn('space-y-4 p-4 bg-card border border-border rounded-lg', className)}>
      {/* Question */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-bold text-primary">?</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium leading-relaxed">{question.question}</p>
            {question.multipleChoice && (
              <p className="text-xs text-muted-foreground mt-1">(Select all that apply)</p>
            )}
          </div>
        </div>
      </div>

      {/* Options */}
      {question.multipleChoice ? (
        <div className="space-y-2 ml-8">
          {question.options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            const showCorrectness = submitted;
            const optionIsCorrect = option.isCorrect;

            return (
              <div
                key={option.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-md border transition-colors',
                  !submitted && 'hover:bg-muted/50 cursor-pointer',
                  submitted && optionIsCorrect && 'bg-green-500/10 border-green-500/30',
                  submitted && !optionIsCorrect && isSelected && 'bg-red-500/10 border-red-500/30',
                  !submitted && isSelected && 'bg-primary/5 border-primary/50'
                )}
                onClick={() => !submitted && handleMultiSelect(option.id, !isSelected)}
              >
                <Checkbox
                  id={option.id}
                  checked={isSelected}
                  onCheckedChange={(checked) => handleMultiSelect(option.id, checked as boolean)}
                  disabled={submitted}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor={option.id}
                    className={cn(
                      'text-sm cursor-pointer',
                      submitted && !option.isCorrect && 'text-muted-foreground'
                    )}
                  >
                    {option.text}
                  </Label>

                  {/* Show correctness indicator */}
                  {showCorrectness && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1"
                    >
                      {optionIsCorrect ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : isSelected ? (
                        <XCircle className="h-3 w-3 text-red-600" />
                      ) : null}
                      {showExplanation && option.explanation && (
                        <p className="text-xs text-muted-foreground">{option.explanation}</p>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <RadioGroup
          value={selectedIds[0] || ''}
          onValueChange={handleSingleSelect}
          disabled={submitted}
          className="space-y-2 ml-8"
        >
          {question.options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            const showCorrectness = submitted;
            const optionIsCorrect = option.isCorrect;

            return (
              <div
                key={option.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-md border transition-colors',
                  !submitted && 'hover:bg-muted/50 cursor-pointer',
                  submitted && optionIsCorrect && 'bg-green-500/10 border-green-500/30',
                  submitted && !optionIsCorrect && isSelected && 'bg-red-500/10 border-red-500/30',
                  !submitted && isSelected && 'bg-primary/5 border-primary/50'
                )}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor={option.id}
                    className={cn(
                      'text-sm cursor-pointer',
                      submitted && !option.isCorrect && 'text-muted-foreground'
                    )}
                  >
                    {option.text}
                  </Label>

                  {/* Show correctness indicator */}
                  {showCorrectness && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1"
                    >
                      {optionIsCorrect ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : isSelected ? (
                        <XCircle className="h-3 w-3 text-red-600" />
                      ) : null}
                      {showExplanation && option.explanation && (
                        <p className="text-xs text-muted-foreground">{option.explanation}</p>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </RadioGroup>
      )}

      {/* Hint */}
      {question.hint && !submitted && (
        <div className="ml-8">
          {showHint ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md"
            >
              <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{question.hint}</p>
            </motion.div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHint(true)}
              className="text-xs h-7"
            >
              💡 Show hint
            </Button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between ml-8">
        <div>
          {submitted ? (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
                  isCorrect
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                )}
              >
                {isCorrect ? (
                  <>
                    <Trophy className="h-4 w-4" />
                    <span>Correct! Great job! 🎉</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    <span>Not quite right. Try again!</span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        <div className="flex gap-2">
          {submitted ? (
            <Button variant="outline" size="sm" onClick={handleReset}>
              Try Again
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={selectedIds.length === 0}
              className="gradient-bg border-0"
            >
              Submit Answer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Multi-question quiz component
interface QuizSetProps {
  title?: string;
  questions: QuizQuestion[];
  onComplete?: (score: number, total: number) => void;
  className?: string;
}

export function QuizSet({ title, questions, onComplete, className }: QuizSetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState<boolean[]>([]);
  const [score, setScore] = useState(0);

  const handleQuestionComplete = (correct: boolean) => {
    const newCompleted = [...completedQuestions];
    newCompleted[currentIndex] = true;
    setCompletedQuestions(newCompleted);

    if (correct) {
      setScore(score + 1);
    }

    // Auto-advance after a delay
    if (currentIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 1500);
    } else {
      // Quiz complete
      setTimeout(() => {
        onComplete?.(correct ? score + 1 : score, questions.length);
      }, 1500);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {title && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                style={{
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {questions.length}
            </span>
          </div>
        </div>
      )}

      <QuizComponent
        question={questions[currentIndex]}
        onComplete={handleQuestionComplete}
      />
    </div>
  );
}
