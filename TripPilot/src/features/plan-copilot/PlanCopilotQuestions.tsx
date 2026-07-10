import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import type { AnalyzeQuestion } from '@/utils/ai-plan-copilot';

interface Props {
  open: boolean;
  questions: AnalyzeQuestion[];
  contextSummary: string;
  onGenerate: (answers: Record<string, string>) => void;
  onManual: () => void;
  onClose: () => void;
}

export function PlanCopilotQuestions({
  open, questions, contextSummary, onGenerate, onManual, onClose,
}: Props) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      if (q.id === 'spending_style') init[q.id] = 'balanced';
    }
    return init;
  });
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});

  const selectOption = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  const handleOtherChange = useCallback((questionId: string, text: string) => {
    setOtherTexts((prev) => ({ ...prev, [questionId]: text }));
    setAnswers((prev) => ({ ...prev, [questionId]: `other:${text}` }));
  }, []);

  const handleSubmit = useCallback(() => {
    onGenerate(answers);
  }, [answers, onGenerate]);

  const sorted = [...questions].sort((a, b) =>
    a.id === 'spending_style' ? -1 : b.id === 'spending_style' ? 1 : 0,
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={t('copilot_questions.title')}>
      <div className="flex flex-col gap-5 pb-4" data-no-sheet-drag>
        {contextSummary && (
          <div className="p-3 rounded-xl bg-surface-high">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-faint mb-1">
              {t('copilot_questions.context_label')}
            </p>
            <p className="text-xs text-on-surface-dim leading-relaxed">{contextSummary}</p>
          </div>
        )}

        {sorted.map((q) => (
          <div key={q.id} className="flex flex-col gap-2">
            <p className="text-sm font-bold text-on-surface">{q.text}</p>
            {q.why && (
              <p className="text-xs text-on-surface-faint leading-relaxed">{q.why}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selectOption(q.id, opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium btn-press min-h-[44px] ${
                      selected
                        ? 'bg-primary text-on-surface ring-1 ring-primary'
                        : 'bg-surface-container text-on-surface-dim'
                    }`}
                    aria-pressed={selected}
                  >
                    {opt.emoji && <span className="text-base">{opt.emoji}</span>}
                    {opt.label}
                  </button>
                );
              })}
              {q.allow_other !== false && (
                <button
                  type="button"
                  onClick={() => selectOption(q.id, `other:${otherTexts[q.id] ?? ''}`)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium btn-press min-h-[44px] ${
                    answers[q.id]?.startsWith('other:')
                      ? 'bg-primary text-on-surface ring-1 ring-primary'
                      : 'bg-surface-container text-on-surface-dim'
                  }`}
                  aria-pressed={answers[q.id]?.startsWith('other:')}
                >
                  <span className="text-base">💬</span>
                  {t('copilot_questions.other')}
                </button>
              )}
            </div>
            {answers[q.id]?.startsWith('other:') && (
              <input
                type="text"
                value={otherTexts[q.id] ?? ''}
                onChange={(e) => handleOtherChange(q.id, e.target.value)}
                placeholder={t('copilot_questions.other_placeholder')}
                className="px-3 py-2.5 rounded-xl bg-surface-high text-sm text-on-surface outline-none"
              />
            )}
          </div>
        ))}

        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSubmit}
            className="btn-press flex-1 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            <Icon name="auto_awesome" size={16} className="inline-block mr-1 align-text-bottom" />
            {t('copilot_questions.generate')}
          </button>
          <button
            onClick={onManual}
            className="btn-press py-3 px-4 rounded-xl text-sm font-bold bg-surface-high text-on-surface-dim"
          >
            {t('copilot_questions.prefer_manual')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
