'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, FileText, Trash2, ExternalLink,
  BookMarked, Loader2, ChevronDown, ChevronUp,
  RotateCcw, AlertCircle, ImageDown, FileDown, ScrollText,
  BookOpen, Shuffle,
} from 'lucide-react';
import {
  getBankSets, deleteBankSet, updateBankSet, type SavedSet,
} from '@/lib/question-bank';
import { saveSession } from '@/lib/local-storage';
import { exportAsImage } from '@/lib/export-image';
import { exportAsTxt } from '@/lib/export-txt';
import { getAppsScriptUrl, exportViaAppsScript } from '@/lib/apps-script';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Subject } from '@/lib/types';

const MATH_RESULT_KEY = 'app_math_result';

const SUBJECT_COLORS: Record<Subject, string> = {
  영어: 'bg-purple-100 text-purple-700',
  수학: 'bg-orange-100 text-orange-700',
};

export default function SavedPage() {
  const router = useRouter();
  const [sets, setSets] = useState<SavedSet[]>([]);
  const [imgSavingId, setImgSavingId] = useState<string | null>(null);
  const [scriptExportingId, setScriptExportingId] = useState<string | null>(null);
  const [hasScriptUrl, setHasScriptUrl] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setSets(getBankSets());
    setHasScriptUrl(!!getAppsScriptUrl());
  }, []);

  const handleImageExport = async (set: SavedSet) => {
    setImgSavingId(set.id);
    try {
      await exportAsImage(set);
      toast.success('이미지로 저장되었습니다!');
    } catch (err) {
      console.error(err);
      toast.error('이미지 저장에 실패했습니다.');
    } finally {
      setImgSavingId(null);
    }
  };

  const handleTxtExport = (set: SavedSet) => {
    try {
      exportAsTxt(set);
      toast.success('텍스트 파일로 저장되었습니다!');
    } catch {
      toast.error('파일 저장에 실패했습니다.');
    }
  };

  const handleScriptExport = async (set: SavedSet) => {
    const url = getAppsScriptUrl();
    if (!url) {
      toast.error('설정에서 Apps Script URL을 먼저 입력해주세요.');
      router.push('/settings');
      return;
    }
    setScriptExportingId(set.id);
    try {
      const docUrl = await exportViaAppsScript(set);
      updateBankSet(set.id, { googleDocUrl: docUrl });
      setSets(getBankSets());
      toast.success('구글 문서에 저장되었습니다!');
      window.open(docUrl, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패. 다시 시도해주세요.');
    } finally {
      setScriptExportingId(null);
    }
  };

  const handleDelete = (id: string) => {
    deleteBankSet(id);
    setSets(getBankSets());
    toast.success('삭제되었습니다.');
  };

  const handleReopen = (set: SavedSet) => {
    if (set.subject === '수학' && set.mathAnalysis) {
      localStorage.setItem(MATH_RESULT_KEY, JSON.stringify({ result: set.mathAnalysis, fileName: set.pdfFileName }));
      router.push('/math');
    } else {
      saveSession({
        questions: set.questions,
        subject: set.subject,
        pdfFileName: set.pdfFileName,
        analysis: set.analysis ?? null,
        englishMode: set.englishMode ?? 'variant',
      });
      router.push('/practice');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/80">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">문제 보관함</h1>
            <p className="text-sm text-gray-500">총 {sets.length}세트 저장됨</p>
          </div>
        </div>

        {/* Apps Script 미설정 배너 */}
        {!hasScriptUrl && sets.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-bold text-amber-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              구글 문서 저장을 설정하면 더 편리합니다
            </div>
            <p className="mb-3 text-amber-700">
              설정 페이지에서 <strong>Apps Script URL</strong>을 등록하면
              어떤 기기에서도 로그인 없이 구글 문서에 바로 저장됩니다.
            </p>
            <button
              onClick={() => router.push('/settings')}
              className="rounded-xl bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600">
              설정하러 가기 →
            </button>
          </div>
        )}

        {/* 목록 */}
        {sets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white py-20 shadow-sm">
            <BookMarked className="h-12 w-12 text-gray-200" />
            <p className="text-gray-400">저장된 문제가 없습니다.</p>
            <button onClick={() => router.push('/')}
              className="mt-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600">
              문제 생성하러 가기
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sets.map(set => {
              const isExpanded = expanded === set.id;
              const isScriptExporting = scriptExportingId === set.id;
              const dateStr = new Date(set.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'short', day: 'numeric',
              });

              return (
                <div key={set.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  {/* 카드 헤더 */}
                  <div className="flex items-start gap-3 p-4">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      set.subject === '수학' ? 'bg-orange-50' :
                      set.englishMode === 'analysis' ? 'bg-teal-50' : 'bg-purple-50'
                    )}>
                      {set.subject === '수학'
                        ? <span className="text-xl">📐</span>
                        : set.englishMode === 'analysis'
                          ? <BookOpen className="h-5 w-5 text-teal-500" />
                          : <Shuffle className="h-5 w-5 text-purple-500" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge className={cn('rounded-full text-xs', SUBJECT_COLORS[set.subject])}>
                          {set.subject}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full text-xs">
                          {set.subject === '수학'
                            ? '수학 해설'
                            : set.englishMode === 'analysis'
                              ? '영어 해설'
                              : `변형문제 ${set.questions.length}개`}
                        </Badge>
                        {set.googleDocUrl && (
                          <Badge className="rounded-full bg-green-100 text-xs text-green-700">
                            구글 문서 저장됨
                          </Badge>
                        )}
                      </div>
                      <p className="truncate font-medium text-gray-900">{set.pdfFileName || set.title}</p>
                      <p className="text-xs text-gray-400">{dateStr}</p>
                    </div>
                  </div>

                  {/* 내용 펼치기 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      {set.questions.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                          {set.questions.map((q, i) => (
                            <div key={q.id} className="rounded-xl bg-gray-50 p-3">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                                  {i + 1}
                                </span>
                                <Badge variant="secondary" className="rounded-full text-xs">{q.variant_type}</Badge>
                              </div>
                              <p className="line-clamp-2 text-sm text-gray-700">{q.question}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {set.englishMode === 'analysis' && set.analysis && (
                        <div className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
                          <p className="font-semibold mb-1">저장된 해설 내용</p>
                          <p>문법 {set.analysis.grammar?.length ?? 0}개 · 어휘 {set.analysis.vocabulary?.length ?? 0}개 · 숙어 {set.analysis.idioms?.length ?? 0}개</p>
                          {set.analysis.passage_summary && (
                            <p className="mt-1 text-xs line-clamp-2 text-teal-700">{set.analysis.passage_summary}</p>
                          )}
                        </div>
                      )}
                      {set.subject === '수학' && set.mathAnalysis && (
                        <div className="mt-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-800">
                          <p className="font-semibold mb-1">저장된 수학 해설</p>
                          <p>개념 {set.mathAnalysis.concepts?.length ?? 0}개 · 포인트 {set.mathAnalysis.points?.length ?? 0}개</p>
                          <p className="mt-1 text-xs line-clamp-2 text-orange-700">{set.mathAnalysis.explanation?.slice(0, 80)}...</p>
                        </div>
                      )}
                      {set.googleDocUrl && (
                        <a href={set.googleDocUrl} target="_blank" rel="noopener noreferrer"
                          className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700 hover:bg-green-100">
                          <ExternalLink className="h-4 w-4" />
                          구글 문서에서 열기
                        </a>
                      )}
                    </div>
                  )}

                  {/* 액션 버튼 - 1행 */}
                  <div className="flex items-center border-t border-gray-100">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : set.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm text-gray-500 hover:bg-gray-50">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isExpanded ? '접기' : '내용 보기'}
                    </button>
                    <div className="h-8 w-px bg-gray-100" />
                    <button
                      onClick={() => handleReopen(set)}
                      className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm text-blue-600 hover:bg-blue-50">
                      <RotateCcw className="h-4 w-4" />
                      {set.questions.length > 0 ? '다시 풀기' : '해설 보기'}
                    </button>
                    <div className="h-8 w-px bg-gray-100" />
                    <button
                      onClick={() => handleDelete(set.id)}
                      className="flex items-center justify-center px-5 py-3 text-red-400 hover:bg-red-50"
                      aria-label="삭제">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 액션 버튼 - 2행: 저장 */}
                  <div className="flex items-center border-t border-gray-100 bg-gray-50/60">
                    <button
                      onClick={() => handleTxtExport(set)}
                      className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs text-gray-600 hover:bg-gray-100">
                      <FileDown className="h-3.5 w-3.5" />
                      TXT
                    </button>
                    <div className="h-6 w-px bg-gray-200" />
                    <button
                      onClick={() => handleImageExport(set)}
                      disabled={imgSavingId === set.id}
                      className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                      {imgSavingId === set.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <ImageDown className="h-3.5 w-3.5" />}
                      이미지
                    </button>
                    <div className="h-6 w-px bg-gray-200" />
                    <button
                      onClick={() => handleScriptExport(set)}
                      disabled={isScriptExporting}
                      className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50">
                      {isScriptExporting
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <ScrollText className="h-3.5 w-3.5" />}
                      {hasScriptUrl ? '구글 문서' : '구글 문서*'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
