'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import UploadZone, { type UploadedFiles } from '@/components/UploadZone';
import {
  ChevronRight, Loader2, BookMarked, Settings,
  ChevronDown, ChevronUp, Info, CheckCircle2, XCircle, Camera,
  Shuffle, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Subject, VariantQuestion, EnglishMode } from '@/lib/types';
import { getApiKey, saveSession } from '@/lib/local-storage';
import { getProviderConfig } from '@/lib/ai-provider';
import { saveBankSet, updateBankSet } from '@/lib/question-bank';
import { getAppsScriptUrl, exportViaAppsScript, buildDocTitle } from '@/lib/apps-script';

const VARIANT_TYPES: Record<Subject, string[]> = {
  영어: ['빈칸 채우기', '내용 일치/불일치', '문장 삽입', '글의 순서 배열', '어법 오류 찾기', '어휘 선택', '주제·제목·요지', '요약문 완성'],
  수학: [],
};

const COUNT_OPTIONS = [1, 2, 3, 5, 8, 10];

const EMPTY_FILES: UploadedFiles = { mode: 'pdf', pdf: null, images: [] };

export default function HomePage() {
  const router = useRouter();
  const [englishMode, setEnglishMode] = useState<EnglishMode>('variant');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>(EMPTY_FILES);
  const subject: Subject = '영어';
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [questionFrom, setQuestionFrom] = useState('');
  const [questionTo, setQuestionTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const hasFile =
    (uploadedFiles.mode === 'pdf' && uploadedFiles.pdf !== null) ||
    (uploadedFiles.mode === 'image' && uploadedFiles.images.length > 0);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  /* 모드 전환 시 파일·설정 초기화 */
  const handleModeChange = (mode: EnglishMode) => {
    setEnglishMode(mode);
    setUploadedFiles(EMPTY_FILES);
    setSelectedTypes([]);
  };

  const handleGenerate = async () => {
    if (!hasFile) { toast.error('파일을 업로드해주세요.'); return; }

    const { provider, apiKey } = getProviderConfig();
    if (!apiKey) {
      toast.error('API 키가 없습니다. 설정에서 AI API 키를 먼저 입력해주세요.');
      router.push('/settings');
      return;
    }

    setLoading(true);
    setProgress(uploadedFiles.mode === 'image' ? '이미지 분석 중...' : 'PDF 분석 중...');

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('englishMode', englishMode);
      formData.append('variantTypes', JSON.stringify(selectedTypes));
      formData.append('count', String(count));
      formData.append('inputMode', uploadedFiles.mode);
      if (questionFrom) formData.append('questionFrom', questionFrom);
      if (questionTo) formData.append('questionTo', questionTo);

      if (uploadedFiles.mode === 'pdf' && uploadedFiles.pdf) {
        formData.append('pdf', uploadedFiles.pdf);
      } else if (uploadedFiles.mode === 'image') {
        uploadedFiles.images.forEach((img, i) => {
          formData.append(`image_${i}`, img);
        });
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
        headers: { 'x-api-key': apiKey, 'x-provider': provider },
      });
      if (!res.ok || !res.body) {
        let msg = `오류 ${res.status}`;
        try {
          const json = await res.json() as { error?: string };
          if (json.error) msg = json.error;
        } catch { /* json 파싱 실패 시 기본 메시지 사용 */ }

        if (res.status === 401) msg = 'API 키가 올바르지 않습니다. 설정에서 확인해주세요.';
        else if (res.status === 402 || res.status === 429) msg = 'Claude API 크레딧이 부족하거나 요청 한도를 초과했습니다.';
        else if (res.status === 400) msg = '파일 또는 설정을 다시 확인해주세요.';
        else if (res.status >= 500) msg = `서버 오류(${res.status})가 발생했습니다. 잠시 후 다시 시도해주세요.`;

        toast.error(msg, { duration: 6000 });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = JSON.parse(line.slice(6));

          if (json.chunk) {
            setProgress(
              englishMode === 'analysis'
                ? '문법·어휘·숙어·해설 생성 중...'
                : '변형문제 생성 중...'
            );
          } else if (json.done) {
            const questions: VariantQuestion[] = ((json.questions ?? []) as VariantQuestion[]).map(
              (q) => ({ ...q, id: crypto.randomUUID() })
            );
            const analysis = json.analysis ?? null;
            const docTitle = buildDocTitle(subject, englishMode);
            saveSession({ questions, subject, pdfFileName: json.pdfFileName, analysis, englishMode });
            const savedSet = englishMode === 'variant'
              ? saveBankSet({ title: docTitle, subject, pdfFileName: json.pdfFileName, questions, englishMode })
              : saveBankSet({ title: docTitle, subject, pdfFileName: json.pdfFileName, questions: [], englishMode, analysis });

            router.push('/practice');

            // 구글 문서 자동 저장 (백그라운드)
            const scriptUrl = getAppsScriptUrl();
            if (scriptUrl) {
              exportViaAppsScript(savedSet, docTitle)
                .then(docUrl => {
                  updateBankSet(savedSet.id, { googleDocUrl: docUrl });
                  toast.success(`구글 문서 저장 완료 — ${docTitle}`, { duration: 5000 });
                })
                .catch(() => {
                  toast.warning('구글 문서 자동 저장 실패. 보관함에서 수동 저장 가능합니다.', { duration: 5000 });
                });
            }
            return;
          } else if (json.error) {
            toast.error(json.error);
            return;
          }
        }
      }
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">

        {/* 헤더 */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">모고헬퍼</h1>
            <p className="mt-1 text-sm text-gray-500">수능·모의고사 AI 학습 도우미</p>
          </div>
          <button
            onClick={() => router.push('/settings')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 hover:bg-white hover:text-gray-600"
            aria-label="설정"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* 수학 바로가기 카드 */}
        <button
          onClick={() => router.push('/math')}
          className="mb-4 flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-orange-400 to-orange-500 px-5 py-4 text-left shadow-md shadow-orange-200 hover:from-orange-500 hover:to-orange-600 active:scale-[0.98] transition"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl">
            📐
          </div>
          <div className="flex-1 text-white">
            <p className="text-lg font-bold">수학 해설</p>
            <p className="text-sm text-orange-100">문제 사진 → 풀이 + 개념 + 포인트</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/70" />
        </button>

        {/* 영어 모드 선택 카드 */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleModeChange('variant')}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 text-center transition active:scale-[0.97]',
              englishMode === 'variant'
                ? 'border-purple-400 bg-purple-500 text-white shadow-md shadow-purple-200'
                : 'border-purple-100 bg-white text-purple-700 hover:bg-purple-50'
            )}
          >
            <Shuffle className={cn('h-6 w-6', englishMode === 'variant' ? 'text-white' : 'text-purple-400')} />
            <div>
              <p className="font-bold text-sm">영어 변형문제</p>
              <p className={cn('text-xs mt-0.5', englishMode === 'variant' ? 'text-purple-100' : 'text-gray-400')}>
                다양한 유형 변형 생성
              </p>
            </div>
          </button>
          <button
            onClick={() => handleModeChange('analysis')}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 text-center transition active:scale-[0.97]',
              englishMode === 'analysis'
                ? 'border-teal-400 bg-teal-500 text-white shadow-md shadow-teal-200'
                : 'border-teal-100 bg-white text-teal-700 hover:bg-teal-50'
            )}
          >
            <BookOpen className={cn('h-6 w-6', englishMode === 'analysis' ? 'text-white' : 'text-teal-400')} />
            <div>
              <p className="font-bold text-sm">영어 해설</p>
              <p className={cn('text-xs mt-0.5', englishMode === 'analysis' ? 'text-teal-100' : 'text-gray-400')}>
                문법·어휘·숙어·지문 해설
              </p>
            </div>
          </button>
        </div>

        {/* 바로가기 버튼 */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/saved')}
            className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 transition hover:bg-indigo-100"
          >
            <span className="font-medium text-indigo-700">문제 보관함</span>
            <ChevronRight className="h-5 w-5 text-indigo-400" />
          </button>
          <button
            onClick={() => router.push('/wrong-note')}
            className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 transition hover:bg-red-100"
          >
            <span className="font-medium text-red-700">오답노트</span>
            <ChevronRight className="h-5 w-5 text-red-400" />
          </button>
        </div>

        {/* 사용법 안내 */}
        <UsageGuide />

        <div className="flex flex-col gap-5">
          {/* Step 1: 파일 업로드 */}
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">1. 파일 업로드</h2>
              {uploadedFiles.mode === 'image' && uploadedFiles.images.length > 0 && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                  이미지 {uploadedFiles.images.length}장
                </span>
              )}
              {uploadedFiles.mode === 'pdf' && uploadedFiles.pdf && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  PDF
                </span>
              )}
            </div>
            <UploadZone value={uploadedFiles} onChange={setUploadedFiles} />
          </section>

          {/* Step 2: 변형 유형 선택 — 변형문제 모드에서만 표시 */}
          {englishMode === 'variant' && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">2. 변형 유형 선택</h2>
                <button
                  onClick={() =>
                    setSelectedTypes((p) =>
                      p.length === VARIANT_TYPES[subject].length ? [] : [...VARIANT_TYPES[subject]]
                    )
                  }
                  className="text-sm text-blue-500"
                >
                  {selectedTypes.length === VARIANT_TYPES[subject].length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {VARIANT_TYPES[subject].map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={cn(
                      'rounded-full border-2 px-4 py-2 text-sm font-medium transition',
                      selectedTypes.includes(t)
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-blue-200'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400">선택하지 않으면 AI가 자동으로 유형을 선택합니다.</p>
            </section>
          )}

          {/* Step 3: 생성 설정 — 변형문제 모드에서만 표시 */}
          {englishMode === 'variant' && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-gray-800">3. 생성 설정</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-600">생성할 변형문제 수</p>
                  <div className="flex gap-2">
                    {COUNT_OPTIONS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCount(c)}
                        className={cn(
                          'h-11 w-14 rounded-xl border-2 font-semibold text-sm transition',
                          count === c
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:border-blue-200'
                        )}
                      >
                        {c}개
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-600">문제 번호 범위 (선택)</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="시작"
                      value={questionFrom}
                      onChange={(e) => setQuestionFrom(e.target.value)}
                      className="h-11 w-24 rounded-xl border-2 border-gray-200 px-3 text-center text-sm outline-none focus:border-blue-400"
                      min="1"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                      type="number"
                      placeholder="끝"
                      value={questionTo}
                      onChange={(e) => setQuestionTo(e.target.value)}
                      className="h-11 w-24 rounded-xl border-2 border-gray-200 px-3 text-center text-sm outline-none focus:border-blue-400"
                      min="1"
                    />
                    <span className="text-sm text-gray-400">번</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={loading || !hasFile}
            className={cn(
              'flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-bold text-white shadow-lg transition',
              loading || !hasFile
                ? 'bg-gray-300 shadow-none cursor-not-allowed'
                : englishMode === 'analysis'
                  ? 'bg-teal-500 shadow-teal-200 hover:bg-teal-600 active:scale-[0.98]'
                  : 'bg-purple-500 shadow-purple-200 hover:bg-purple-600 active:scale-[0.98]'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {progress}
              </>
            ) : englishMode === 'analysis' ? (
              <>
                <BookOpen className="h-5 w-5" />
                해설 분석하기
                <ChevronRight className="h-5 w-5" />
              </>
            ) : (
              <>
                <Shuffle className="h-5 w-5" />
                변형문제 생성하기
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

/* ────────────────────────────────────────────
   사용법 안내 컴포넌트 (접기/펼치기)
──────────────────────────────────────────── */
function UsageGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left hover:bg-blue-50/50"
      >
        <Info className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="flex-1 text-sm font-semibold text-blue-700">사용법 및 주의사항</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-400" />
          : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-blue-50 px-4 pb-5 pt-4 text-sm text-gray-700">
          <p className="mb-3 font-bold text-gray-900">📷 문제 올리는 추천 방법</p>
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3 text-emerald-800">
            <Camera className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold">이미지 모드 (강력 추천)</p>
              <p className="mt-0.5 text-emerald-700">
                원하는 문제를 스크린샷으로 찍어 <strong>1문제씩</strong> 올려주세요.
                Claude가 수식·그림까지 직접 읽어서 가장 정확합니다.
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                iPad: 사이드 버튼 + 볼륨 업 → 스크린샷 저장 → 앱에서 "사진 캡처" 탭
              </p>
            </div>
          </div>

          <p className="mb-2 font-bold text-gray-900">✅ 가능한 것</p>
          <ul className="mb-4 space-y-1.5 pl-1">
            {[
              '텍스트 위주의 영어 지문 문제',
              '수식이 간단한 수학 문제 (스크린샷)',
              '객관식 문제 변형 (선택지 교체, 순서 변경 등)',
              '문제 1~2개씩 올려서 변형',
            ].map(t => (
              <li key={t} className="flex items-start gap-2 text-gray-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                {t}
              </li>
            ))}
          </ul>

          <p className="mb-2 font-bold text-gray-900">❌ 안 되는 것 / 어려운 것</p>
          <ul className="mb-4 space-y-1.5 pl-1">
            {[
              '도표·그래프·그림이 포함된 문제 (이미지 추출 불가)',
              'PDF 전체 파일 (5MB+ 오류, 타임아웃)',
              '스캔 이미지 PDF (텍스트 인식 안 됨 → 이미지 모드 사용)',
              '서술형·주관식 문제 자동 채점',
            ].map(t => (
              <li key={t} className="flex items-start gap-2 text-gray-700">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                {t}
              </li>
            ))}
          </ul>

          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">PDF 모드 사용 시 주의</p>
            <p className="mt-1">
              PDF는 <strong>4MB 이하, 텍스트가 포함된 파일</strong>만 지원합니다.
              전체 시험지 대신 원하는 문제 페이지만 잘라서 올리거나,
              스크린샷 이미지 모드를 이용해주세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
