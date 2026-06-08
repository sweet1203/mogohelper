'use client';

import type { WrongAnswer, Subject } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const SUBJECT_COLORS: Record<Subject, string> = {
  영어: 'bg-purple-100 text-purple-700',
  수학: 'bg-orange-100 text-orange-700',
};

interface WrongNoteCardProps {
  item: WrongAnswer;
  onDelete: (id: string) => void;
  onReview: (item: WrongAnswer) => void;
}

export default function WrongNoteCard({ item, onDelete, onReview }: WrongNoteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <Card className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge className={cn('rounded-full text-xs', SUBJECT_COLORS[item.subject])}>
              {item.subject}
            </Badge>
            <Badge variant="secondary" className="rounded-full text-xs">
              {item.variantType}
            </Badge>
            {item.reviewCount > 0 && (
              <Badge variant="outline" className="rounded-full text-xs text-blue-600">
                복습 {item.reviewCount}회
              </Badge>
            )}
          </div>
          <p className="line-clamp-2 text-sm text-gray-700">{item.question}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            <span>{formatDate(item.date)}</span>
            <span>{item.originalPdfName}</span>
          </div>
        </div>
      </div>

      {/* 확장 내용 */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {/* 선택지 */}
          <div className="mt-3 flex flex-col gap-1.5">
            {item.choices.map((c, i) => {
              const num = i + 1;
              const isCorrect = num === item.correctAnswer;
              const isMy = num === item.myAnswer;
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm',
                    isCorrect && 'bg-green-50 text-green-700 font-medium',
                    isMy && !isCorrect && 'bg-red-50 text-red-700',
                    !isCorrect && !isMy && 'text-gray-500'
                  )}
                >
                  {isCorrect && '✓ '}
                  {isMy && !isCorrect && '✗ '}
                  {c}
                </div>
              );
            })}
          </div>

          {/* 해설 */}
          <div className="mt-3 rounded-xl bg-yellow-50 p-3 text-sm text-gray-700">
            <p className="mb-1 font-medium text-yellow-700">해설</p>
            <p className="whitespace-pre-wrap leading-relaxed">{item.explanation}</p>
          </div>

          {/* 내 풀이 이미지 */}
          {item.drawingData && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-gray-500">내 풀이</p>
              <img
                src={item.drawingData}
                alt="내 풀이"
                className="w-full rounded-xl border border-gray-100"
              />
            </div>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center border-t border-gray-100">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm text-gray-500 transition hover:bg-gray-50"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? '접기' : '상세보기'}
        </button>
        <div className="w-px h-8 bg-gray-100" />
        <button
          onClick={() => onReview(item)}
          className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm text-blue-600 transition hover:bg-blue-50"
        >
          <RotateCcw className="h-4 w-4" />
          재풀이
        </button>
        <div className="w-px h-8 bg-gray-100" />
        <button
          onClick={() => onDelete(item.id)}
          className="flex items-center justify-center px-4 py-3 text-red-400 transition hover:bg-red-50"
          aria-label="삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
