'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WrongNoteCard from '@/components/WrongNoteCard';
import { deleteWrongAnswer, getWrongAnswers, clearAllWrongAnswers, incrementReviewCount } from '@/lib/wrong-note';
import type { WrongAnswer, Subject } from '@/lib/types';
import { ChevronLeft, BookX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SUBJECTS: (Subject | '전체')[] = ['전체', '영어', '수학'];

export default function WrongNotePage() {
  const router = useRouter();
  const [items, setItems] = useState<WrongAnswer[]>([]);
  const [filter, setFilter] = useState<Subject | '전체'>('전체');

  useEffect(() => {
    setItems(getWrongAnswers());
  }, []);

  const filtered = filter === '전체' ? items : items.filter((i) => i.subject === filter);

  const handleDelete = (id: string) => {
    deleteWrongAnswer(id);
    setItems(getWrongAnswers());
    toast.success('삭제되었습니다.');
  };

  const handleClearAll = () => {
    if (!confirm('모든 오답노트를 삭제하시겠습니까?')) return;
    clearAllWrongAnswers();
    setItems([]);
    toast.success('전체 삭제되었습니다.');
  };

  const handleReview = (item: WrongAnswer) => {
    // 재풀이: 해당 문제만 새 세션으로 practice 페이지로 이동
    incrementReviewCount(item.id);
    const session = {
      questions: [
        {
          id: item.id,
          variant_type: item.variantType,
          question: item.question,
          choices: item.choices,
          answer: item.correctAnswer,
          explanation: item.explanation,
          change_summary: item.changeSummary,
        },
      ],
      subject: item.subject,
      pdfFileName: item.originalPdfName + ' (재풀이)',
    };
    sessionStorage.setItem('examSession', JSON.stringify(session));
    setItems(getWrongAnswers()); // reviewCount 반영
    router.push('/practice');
  };

  const SUBJECT_COLORS: Record<string, string> = {
    전체: 'border-gray-300 data-[selected=true]:bg-gray-700 data-[selected=true]:text-white',
    영어: 'border-purple-300 data-[selected=true]:bg-purple-500 data-[selected=true]:text-white',
    수학: 'border-orange-300 data-[selected=true]:bg-orange-500 data-[selected=true]:text-white',
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/80"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">오답노트</h1>
            <p className="text-sm text-gray-500">총 {items.length}개</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              전체 삭제
            </button>
          )}
        </div>

        {/* 과목 필터 */}
        <div className="mb-4 flex gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              data-selected={filter === s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-full border-2 px-4 py-2 text-sm font-medium transition',
                SUBJECT_COLORS[s],
                filter !== s && 'text-gray-600 hover:border-gray-400'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white py-20 shadow-sm">
            <BookX className="h-12 w-12 text-gray-200" />
            <p className="text-gray-400">
              {items.length === 0 ? '오답이 없습니다!' : '해당 과목의 오답이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((item) => (
              <WrongNoteCard
                key={item.id}
                item={item}
                onDelete={handleDelete}
                onReview={handleReview}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
