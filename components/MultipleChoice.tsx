'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Circle } from 'lucide-react';

interface MultipleChoiceProps {
  choices: string[];
  selected: number | null;
  correctAnswer: number | null; // null = 미채점
  onSelect: (idx: number) => void;
  disabled?: boolean;
}

export default function MultipleChoice({
  choices,
  selected,
  correctAnswer,
  onSelect,
  disabled = false,
}: MultipleChoiceProps) {
  const isGraded = correctAnswer !== null;

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, i) => {
        const num = i + 1; // 1-based
        const isSelected = selected === num;
        const isCorrect = isGraded && correctAnswer === num;
        const isWrong = isGraded && isSelected && correctAnswer !== num;

        return (
          <button
            key={i}
            onClick={() => !disabled && onSelect(num)}
            disabled={disabled}
            className={cn(
              'flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base transition-all',
              // 기본
              !isGraded && !isSelected && 'border-gray-100 bg-gray-50 hover:border-blue-200 hover:bg-blue-50',
              // 선택됨 (미채점)
              !isGraded && isSelected && 'border-blue-400 bg-blue-50',
              // 정답 (채점 후)
              isGraded && isCorrect && 'border-green-400 bg-green-50',
              // 내가 고른 오답 (채점 후)
              isGraded && isWrong && 'border-red-400 bg-red-50',
              // 나머지 (채점 후, 정답도 내 선택도 아님)
              isGraded && !isCorrect && !isWrong && 'border-gray-100 bg-gray-50 opacity-60',
            )}
          >
            <span className="mt-0.5 shrink-0">
              {isGraded ? (
                isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : isWrong ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )
              ) : (
                <Circle
                  className={cn(
                    'h-5 w-5 transition',
                    isSelected ? 'fill-blue-400 text-blue-400' : 'text-gray-300'
                  )}
                />
              )}
            </span>
            <span className={cn('flex-1', isGraded && isCorrect && 'font-semibold text-green-700')}>
              {choice}
            </span>
          </button>
        );
      })}
    </div>
  );
}
