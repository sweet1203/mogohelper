'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { VariantQuestion } from '@/lib/types';
import { Lightbulb, ArrowLeftRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
  question: VariantQuestion;
  index: number;
  showExplanation?: boolean;
}

export default function QuestionCard({ question, index, showExplanation = false }: QuestionCardProps) {
  const [expandExplanation, setExpandExplanation] = useState(false);

  return (
    <Card className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
          {index + 1}
        </span>
        <Badge variant="secondary" className="rounded-full bg-blue-100 text-blue-700">
          {question.variant_type}
        </Badge>
      </div>

      {/* 문제 본문 */}
      <div className="p-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-800">
          {question.question}
        </p>
      </div>

      {/* 변경 포인트 — 채점 후에만 표시 */}
      {showExplanation && question.change_summary && (
        <div className="mx-5 mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{question.change_summary}</span>
        </div>
      )}

      {/* 해설 (채점 후 또는 명시적 열기) */}
      {showExplanation && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setExpandExplanation((p) => !p)}
            className="flex w-full items-center gap-2 px-5 py-3 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
          >
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            해설 {expandExplanation ? '접기' : '보기'}
          </button>
          {expandExplanation && (
            <div className="px-5 pb-5">
              <p className="whitespace-pre-wrap rounded-xl bg-yellow-50 p-4 text-sm leading-relaxed text-gray-700">
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
