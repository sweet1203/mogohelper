'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import MultipleChoice from '@/components/MultipleChoice';
import QuestionCard from '@/components/QuestionCard';
import { loadSession } from '@/lib/local-storage';
import { ChevronLeft, ChevronRight, BookOpen, Check, PenLine, PenOff } from 'lucide-react';
import { toast } from 'sonner';
import { saveWrongAnswer } from '@/lib/wrong-note';
import type { SessionData, VariantQuestion, EnglishAnalysis } from '@/lib/types';
import { cn } from '@/lib/utils';

const DrawingCanvas = dynamic(() => import('@/components/DrawingCanvas'), { ssr: false });

type Tab = 'practice' | 'grammar' | 'vocab' | 'idioms' | 'summary';

interface AnswerState {
  selected: number | null;
  graded: boolean;
  drawingData: string;
}

export default function PracticePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [showResult, setShowResult] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('practice');
  const canvasDrawingRef = useRef<string>('');

  useEffect(() => {
    const data = loadSession<SessionData>();
    if (!data) { router.replace('/'); return; }
    setSession(data);
    setAnswers(
      Object.fromEntries(
        data.questions.map((_, i) => [i, { selected: null, graded: false, drawingData: '' }])
      )
    );
    // 해설 모드이거나 문제가 없으면 첫 번째 분석 탭으로 이동
    if (data.englishMode === 'analysis' || data.questions.length === 0) {
      setActiveTab('grammar');
    }
  }, [router]);

  const handleDrawingSave = useCallback((dataUrl: string) => {
    canvasDrawingRef.current = dataUrl;
  }, []);

  const currentQuestion: VariantQuestion | undefined = session?.questions[currentIdx];
  const currentAnswer = answers[currentIdx];
  const analysis: EnglishAnalysis | undefined = session?.analysis;

  const handleSelect = (num: number) => {
    if (currentAnswer?.graded) return;
    setAnswers(prev => ({ ...prev, [currentIdx]: { ...prev[currentIdx], selected: num } }));
  };

  const handleGrade = () => {
    if (!currentAnswer?.selected) { toast.error('답을 선택해주세요.'); return; }
    const isCorrect = currentAnswer.selected === currentQuestion!.answer;
    const drawing = canvasDrawingRef.current;
    setAnswers(prev => ({ ...prev, [currentIdx]: { ...prev[currentIdx], graded: true, drawingData: drawing } }));
    if (!isCorrect && session) {
      saveWrongAnswer({
        subject: session.subject,
        originalPdfName: session.pdfFileName,
        variantType: currentQuestion!.variant_type,
        question: currentQuestion!.question,
        choices: currentQuestion!.choices,
        correctAnswer: currentQuestion!.answer,
        myAnswer: currentAnswer.selected,
        explanation: currentQuestion!.explanation,
        drawingData: drawing,
        changeSummary: currentQuestion!.change_summary,
      });
      toast.error('오답! 오답노트에 저장되었습니다.');
    } else toast.success('정답입니다!');
  };

  const handleNext = () => {
    if (session && currentIdx < session.questions.length - 1) {
      setCurrentIdx(p => p + 1);
      canvasDrawingRef.current = '';
    } else setShowResult(true);
  };

  const handlePrev = () => {
    if (currentIdx > 0) { setCurrentIdx(p => p - 1); canvasDrawingRef.current = ''; }
  };

  const getScore = () => {
    if (!session) return { correct: 0, total: 0 };
    let correct = 0;
    session.questions.forEach((q, i) => {
      if (answers[i]?.graded && answers[i].selected === q.answer) correct++;
    });
    return { correct, total: session.questions.length };
  };

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>;
  }

  /* ── 결과 화면 ── */
  if (showResult) {
    const { correct, total } = getScore();
    const percent = Math.round((correct / total) * 100);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm text-center">
          <div className={cn('mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white',
            percent >= 80 ? 'bg-green-400' : percent >= 60 ? 'bg-yellow-400' : 'bg-red-400')}>
            {percent}%
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{total}문제 중 {correct}개 정답</h2>
          <p className="mt-2 text-gray-500">{session.subject} · {session.pdfFileName}</p>
          <div className="mt-6 flex flex-col gap-3">
            <button onClick={() => { setShowResult(false); setCurrentIdx(0); }}
              className="h-14 w-full rounded-2xl bg-blue-500 font-bold text-white hover:bg-blue-600">다시 풀기</button>
            <button onClick={() => router.push('/wrong-note')}
              className="h-14 w-full rounded-2xl border-2 border-red-200 font-bold text-red-600 hover:bg-red-50">오답노트 확인</button>
            <button onClick={() => router.push('/')}
              className="h-14 w-full rounded-2xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50">처음으로</button>
          </div>
        </div>
      </div>
    );
  }

  const totalCount = session.questions.length;
  const answeredCount = Object.values(answers).filter(a => a.graded).length;
  const hasVariants = totalCount > 0;
  const isAnalysisOnly = !hasVariants;

  const hasAnalysis = !!analysis && (
    (analysis.grammar?.length > 0) ||
    (analysis.vocabulary?.length > 0) ||
    (analysis.idioms?.length > 0) ||
    !!analysis.passage_summary
  );
  const TABS: { id: Tab; label: string }[] = ([
    hasVariants                                              ? { id: 'practice' as Tab, label: '문제풀기' } : null,
    hasAnalysis && (analysis?.grammar?.length ?? 0) > 0     ? { id: 'grammar'  as Tab, label: '문법' }    : null,
    hasAnalysis && (analysis?.vocabulary?.length ?? 0) > 0  ? { id: 'vocab'    as Tab, label: '어휘' }    : null,
    hasAnalysis && (analysis?.idioms?.length ?? 0) > 0      ? { id: 'idioms'   as Tab, label: '숙어' }    : null,
    hasAnalysis && !!analysis?.passage_summary              ? { id: 'summary'  as Tab, label: '해설' }    : null,
  ] as ({ id: Tab; label: string } | null)[]).filter((t): t is { id: Tab; label: string } => t !== null);

  return (
    <div className={cn('flex h-dvh overflow-hidden bg-gray-50', 'flex-col landscape:flex-row')}>

      {/* ── 문제/분석 영역 ── */}
      <div className={cn(
        'flex flex-col overflow-hidden',
        'landscape:flex-1 landscape:border-r landscape:border-gray-200',
        canvasOpen ? 'portrait:h-[45%]' : 'portrait:flex-1',
      )}>
        {/* 상단 네비 */}
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3">
            <button onClick={() => router.push('/')}
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="truncate">{session.subject} · {session.pdfFileName}</span>
                {!isAnalysisOnly && <span className="ml-2 shrink-0">{answeredCount}/{totalCount}</span>}
              </div>
              {!isAnalysisOnly && (
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-blue-400 transition-all"
                    style={{ width: `${((currentIdx + 1) / totalCount) * 100}%` }} />
                </div>
              )}
            </div>
            {!isAnalysisOnly && (
              <span className="shrink-0 text-sm font-bold text-gray-700">{currentIdx + 1}/{totalCount}</span>
            )}
            <button
              onClick={() => setCanvasOpen(p => !p)}
              className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition',
                canvasOpen ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
              )}
            >
              {canvasOpen ? <PenOff className="h-5 w-5" /> : <PenLine className="h-5 w-5" />}
            </button>
          </div>

          {/* 탭 바 */}
          {TABS.length > 1 && (
            <div className="flex overflow-x-auto border-t border-gray-100 px-2">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'shrink-0 px-4 py-2 text-sm font-medium transition border-b-2',
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'practice' && (
            <div className="flex flex-col gap-4 p-4">
              <QuestionCard question={currentQuestion!} index={currentIdx} showExplanation={currentAnswer?.graded} />
              <MultipleChoice
                choices={currentQuestion!.choices}
                selected={currentAnswer?.selected ?? null}
                correctAnswer={currentAnswer?.graded ? currentQuestion!.answer : null}
                onSelect={handleSelect}
                disabled={currentAnswer?.graded}
              />
              <div className="flex gap-3 pb-4">
                <button onClick={handlePrev} disabled={currentIdx === 0}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                {!currentAnswer?.graded ? (
                  <button onClick={handleGrade} disabled={!currentAnswer?.selected}
                    className={cn('flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-bold text-white transition',
                      currentAnswer?.selected ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-200 cursor-not-allowed')}>
                    <Check className="h-5 w-5" />채점하기
                  </button>
                ) : (
                  <button onClick={handleNext}
                    className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-800 font-bold text-white hover:bg-gray-900">
                    {currentIdx < totalCount - 1
                      ? <><span>다음 문제</span><ChevronRight className="h-5 w-5" /></>
                      : <><span>결과 보기</span><BookOpen className="h-5 w-5" /></>}
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'grammar' && analysis && (
            <div className="flex flex-col gap-3 p-4">
              <h3 className="font-bold text-gray-900">중요 문법 요소</h3>
              {analysis.grammar.map((g, i) => (
                <div key={i} className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="font-semibold text-blue-900">{g.element}</p>
                  <p className="mt-1 text-sm text-blue-800">{g.explanation}</p>
                  {g.example && <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs italic text-blue-700">{g.example}</p>}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'vocab' && analysis && (
            <div className="flex flex-col gap-3 p-4">
              <h3 className="font-bold text-gray-900">중요 어휘</h3>
              {analysis.vocabulary.map((v, i) => (
                <div key={i} className="flex gap-3 rounded-2xl border border-purple-100 bg-purple-50 p-4">
                  <div className="flex-1">
                    <span className="font-bold text-purple-900">{v.word}</span>
                    <span className="ml-2 text-sm text-purple-700">{v.meaning}</span>
                    {v.example && <p className="mt-1 text-xs italic text-purple-600">{v.example}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'idioms' && analysis && (
            <div className="flex flex-col gap-3 p-4">
              <h3 className="font-bold text-gray-900">숙어 &amp; 관용 표현</h3>
              {analysis.idioms.map((id, i) => (
                <div key={i} className="rounded-2xl border border-green-100 bg-green-50 p-4">
                  <p className="font-semibold text-green-900">🔖 {id.phrase}</p>
                  <p className="mt-1 text-sm text-green-800">{id.meaning}</p>
                  {id.usage && <p className="mt-2 text-xs text-green-700">{id.usage}</p>}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'summary' && analysis && (
            <div className="p-4">
              <h3 className="mb-3 font-bold text-gray-900">지문 해설</h3>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{analysis.passage_summary}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 연습장 ── */}
      {canvasOpen && (
        <div className={cn('overflow-hidden', 'landscape:w-1/2', 'portrait:flex-1')}>
          <DrawingCanvas onSave={handleDrawingSave} />
        </div>
      )}
    </div>
  );
}
