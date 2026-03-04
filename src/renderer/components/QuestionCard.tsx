import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle, Circle, CheckSquare, Square, ChevronRight, RotateCcw } from 'lucide-react';
import type { QuestionInfo, QuestionAnswer } from '../../shared/types';
import { useTranslation } from '../i18n';

interface QuestionCardProps {
  questions: QuestionInfo[];
  onSubmit: (answers: QuestionAnswer[]) => void;
  onSkip: () => void;
}

const MAX_OPTIONS_WITHOUT_SCROLL = 5;

export const QuestionCard: React.FC<QuestionCardProps> = ({
  questions,
  onSubmit,
  onSkip,
}) => {
  const isMultiQuestion = questions.length > 1;
  const [currentTab, setCurrentTab] = useState(0);
  const [answers, setAnswers] = useState<QuestionAnswer[]>(() =>
    questions.map(() => [])
  );
  const [customInputs, setCustomInputs] = useState<string[]>(() =>
    questions.map(() => '')
  );
  const [expandedCustom, setExpandedCustom] = useState<number | null>(null);
  const t = useTranslation();

  const currentQuestion = isMultiQuestion
    ? questions[Math.min(currentTab, questions.length - 1)]
    : questions[0];

  const currentAnswer = isMultiQuestion
    ? answers[Math.min(currentTab, questions.length - 1)]
    : answers[0];

  const isConfirmPage = isMultiQuestion && currentTab === questions.length;

  // Use grid for many options
  const useGridLayout = useMemo(() => {
    return currentQuestion.options.length > MAX_OPTIONS_WITHOUT_SCROLL;
  }, [currentQuestion.options.length]);

  const handleSelectOption = useCallback((questionIdx: number, label: string) => {
    const question = questions[questionIdx];
    setAnswers((prev) => {
      const newAnswers = [...prev];
      const current = prev[questionIdx];

      if (question.multiple) {
        if (current.includes(label)) {
          newAnswers[questionIdx] = current.filter((l) => l !== label);
        } else {
          newAnswers[questionIdx] = [...current, label];
        }
      } else {
        newAnswers[questionIdx] = [label];
      }

      return newAnswers;
    });

    // Close custom input if selecting a regular option
    setExpandedCustom(null);
  }, [questions]);

  const handleCustomInputChange = useCallback((questionIdx: number, value: string) => {
    setCustomInputs((prev) => {
      const newInputs = [...prev];
      newInputs[questionIdx] = value;
      return newInputs;
    });
  }, []);

  const handleToggleCustomInput = useCallback((questionIdx: number) => {
    setExpandedCustom((prev) => (prev === questionIdx ? null : questionIdx));
    // Clear selection when opening custom input
    setAnswers((prev) => {
      const newAnswers = [...prev];
      newAnswers[questionIdx] = [];
      return newAnswers;
    });
  }, []);

  const handleCustomInputSubmit = useCallback((questionIdx: number) => {
    const customValue = customInputs[questionIdx].trim();
    if (customValue) {
      setAnswers((prev) => {
        const newAnswers = [...prev];
        newAnswers[questionIdx] = [customValue];
        return newAnswers;
      });
      setExpandedCustom(null);
    }
  }, [customInputs]);

  const canProceed = useCallback(() => {
    if (isConfirmPage) return true;

    const questionIdx = isMultiQuestion ? currentTab : 0;
    const answer = answers[questionIdx];
    return answer.length > 0;
  }, [isConfirmPage, isMultiQuestion, currentTab, answers]);

  const handleSubmit = useCallback(() => {
    if (isConfirmPage) {
      onSubmit(answers);
    } else if (isMultiQuestion) {
      if (currentTab < questions.length - 1) {
        setCurrentTab(currentTab + 1);
      } else {
        setCurrentTab(questions.length);
      }
    } else {
      // Single question - submit directly
      onSubmit(answers);
    }
  }, [isConfirmPage, isMultiQuestion, currentTab, questions.length, answers, onSubmit]);

  const handleGoBack = useCallback(() => {
    if (currentTab > 0) {
      setCurrentTab(currentTab - 1);
    }
  }, [currentTab]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, questionIdx: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCustomInputSubmit(questionIdx);
    }
  }, [handleCustomInputSubmit]);

  // Single question with single-select: click to submit immediately
  const handleSingleSelectSubmit = useCallback((questionIdx: number, label: string) => {
    const question = questions[questionIdx];
    if (!question.multiple && !isMultiQuestion) {
      const newAnswers = [...answers];
      newAnswers[questionIdx] = [label];
      onSubmit(newAnswers);
    } else {
      handleSelectOption(questionIdx, label);
    }
  }, [questions, isMultiQuestion, answers, onSubmit, handleSelectOption]);

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden w-full">
      {/* Tab navigation for multi-question */}
      {isMultiQuestion && (
        <div className="flex border-b border-border bg-surface-hover overflow-x-auto">
          {questions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentTab(idx)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
                currentTab === idx
                  ? 'text-primary border-primary bg-surface'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-hover'
              } ${answers[idx].length > 0 ? 'font-semibold' : ''}`}
            >
              {q.header}
              {answers[idx].length > 0 && (
                <span className="ml-1 text-primary">✓</span>
              )}
            </button>
          ))}
          <button
            onClick={() => setCurrentTab(questions.length)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
              currentTab === questions.length
                ? 'text-primary border-primary bg-surface'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            {t['question.confirm']}
          </button>
        </div>
      )}

      {/* Question content */}
      <div className="p-3">
        {isConfirmPage ? (
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">
              {t['question.confirmChoices']}
            </h3>
            <div className="space-y-1.5">
              {questions.map((q, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-text-secondary min-w-[60px]">{q.header}:</span>
                  <span className="text-text-primary font-medium">
                    {answers[idx].length > 0 ? answers[idx].join(', ') : t['question.notAnswered']}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-medium text-text-primary">
              {currentQuestion.question}
            </h3>
            {currentQuestion.multiple && (
              <p className="text-xs text-text-secondary mt-0.5 mb-2">
                {t['question.multiSelect']}
              </p>
            )}

            {/* Options - grid or list based on count */}
            <div
              className={`mt-2 ${
                useGridLayout
                  ? 'grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1'
                  : 'space-y-1'
              }`}
            >
              {currentQuestion.options.map((option, optIdx) => {
                const isSelected = currentAnswer.includes(option.label);
                const questionIdx = isMultiQuestion ? currentTab : 0;

                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSingleSelectSubmit(questionIdx, option.label)}
                    className={`text-left p-2 rounded-lg transition-all border ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-text-primary'
                        : 'bg-background hover:bg-surface-hover border-border hover:border-primary/50 text-text-primary'
                    } ${useGridLayout ? 'h-full' : 'w-full'}`}
                  >
                    <div className={`flex items-start gap-2 ${useGridLayout ? 'flex-col' : ''}`}>
                      <span className="flex-shrink-0">
                        {currentQuestion.multiple ? (
                          isSelected ? (
                            <CheckSquare size={14} className="text-primary" />
                          ) : (
                            <Square size={14} className="text-text-secondary" />
                          )
                        ) : isSelected ? (
                          <CheckCircle size={14} className="text-primary" />
                        ) : (
                          <Circle size={14} className="text-text-secondary" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs">{option.label}</div>
                        {!useGridLayout && (
                          <div className="text-[10px] text-text-secondary mt-0.5 leading-tight">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Custom input option */}
              <button
                onClick={() => handleToggleCustomInput(isMultiQuestion ? currentTab : 0)}
                className={`text-left p-2 rounded-lg transition-all border ${
                  expandedCustom === (isMultiQuestion ? currentTab : 0)
                    ? 'bg-primary/10 border-primary col-span-2'
                    : 'bg-background hover:bg-surface-hover border-border hover:border-primary/50'
                } ${useGridLayout ? '' : 'w-full mt-1'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0">
                    <Circle size={14} className="text-text-secondary" />
                  </span>
                  <span className="text-xs text-text-secondary">{t['question.other']}</span>
                </div>
              </button>
            </div>

            {/* Custom input expanded */}
            {expandedCustom === (isMultiQuestion ? currentTab : 0) && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={customInputs[isMultiQuestion ? currentTab : 0]}
                  onChange={(e) =>
                    handleCustomInputChange(isMultiQuestion ? currentTab : 0, e.target.value)
                  }
                  onKeyDown={(e) =>
                    handleKeyDown(e, isMultiQuestion ? currentTab : 0)
                  }
                  placeholder={t['question.enterAnswer']}
                  className="flex-1 bg-background text-text-primary rounded px-2 py-1.5 text-xs border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                {customInputs[isMultiQuestion ? currentTab : 0].trim() && (
                  <button
                    onClick={() =>
                      handleCustomInputSubmit(isMultiQuestion ? currentTab : 0)
                    }
                    className="px-2 py-1.5 bg-primary text-on-primary text-xs rounded hover:bg-primary-hover transition-colors whitespace-nowrap"
                  >
                    {t['question.use']}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with buttons */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-hover">
        <button
          onClick={onSkip}
          className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {t['question.skip']}
        </button>

        <div className="flex items-center gap-2">
          {isMultiQuestion && currentTab > 0 && !isConfirmPage && (
            <button
              onClick={handleGoBack}
              className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded transition-colors flex items-center gap-1"
            >
              <RotateCcw size={10} />
              {t['question.back']}
            </button>
          )}

          {isConfirmPage ? (
            <button
              onClick={handleSubmit}
              className="px-3 py-1 bg-primary text-on-primary text-xs rounded hover:bg-primary-hover transition-colors flex items-center gap-1"
            >
              {t['question.confirm']}
              <ChevronRight size={12} />
            </button>
          ) : isMultiQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={!canProceed()}
              className="px-3 py-1 bg-primary text-on-primary text-xs rounded hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {currentTab === questions.length - 1 ? t['question.review'] : t['question.next']}
              <ChevronRight size={12} />
            </button>
          ) : (
            !questions[0].multiple && (
              <span className="text-[10px] text-text-secondary">
                {t['question.clickToSelect']}
              </span>
            )
          )}

          {(!isMultiQuestion && questions[0].multiple) && (
            <button
              onClick={handleSubmit}
              disabled={!canProceed()}
              className="px-3 py-1 bg-primary text-on-primary text-xs rounded hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {t['question.submit']}
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
