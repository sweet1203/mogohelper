'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ChevronLeft, Loader2, Camera, ChevronDown, ChevronUp, Lightbulb, Target, BookOpen } from 'lucide-react';
import { getApiKey } from '@/lib/local-storage';
import { getProviderConfig } from '@/lib/ai-provider';
import { saveBankSet, updateBankSet } from '@/lib/question-bank';
import { getAppsScriptUrl, exportViaAppsScript, buildDocTitle } from '@/lib/apps-script';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MathAnalysis } from '@/lib/types';

const DrawingCanvas = dynamic(() => import('@/components/DrawingCanvas'), { ssr: false });

type ImageFile = { file: File; preview: string };

const MATH_RESULT_KEY = 'app_math_result';

function loadMathResult(): { result: MathAnalysis; fileName: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MATH_RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveMathResult(result: MathAnalysis, fileName: string) {
  localStorage.setItem(MATH_RESULT_KEY, JSON.stringify({ result, fileName }));
}

export default function MathPage() {
  const router = useRouter();
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<MathAnalysis | null>(null);
  const [fileName, setFileName] = useState('');
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [openSection, setOpenSection] = useState<'explanation' | 'concepts' | 'points'>('explanation');

  // 이전 결과 복원
  useEffect(() => {
    const saved = loadMathResult();
    if (saved && !result) {
      setResult(saved.result);
      setFileName(saved.fileName);
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.slice(0, 3 - images.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages(prev => [...prev, ...newImages].slice(0, 3));
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAnalyze = async () => {
    if (images.length === 0) { toast.error('문제 사진을 업로드해주세요.'); return; }
    const { provider, apiKey } = getProviderConfig();
    if (!apiKey) {
      toast.error('설정에서 AI API 키를 먼저 입력해주세요.');
      router.push('/settings');
      return;
    }

    setLoading(true);
    setProgress('문제 분석 중...');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('subject', '수학');
      formData.append('inputMode', 'image');
      formData.append('variantTypes', '[]');
      formData.append('count', '0');
      images.forEach((img, i) => formData.append(`image_${i}`, img.file));

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'x-provider': provider },
        body: formData,
      });

      if (!res.ok || !res.body) {
        let msg = `오류 ${res.status}`;
        try { const j = await res.json() as { error?: string }; if (j.error) msg = j.error; } catch { /* noop */ }
        toast.error(msg); return;
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
          const json = JSON.parse(line.slice(6)) as {
            chunk?: string; done?: boolean; mode?: string;
            math?: MathAnalysis; fileName?: string; error?: string;
          };
          if (json.chunk) setProgress('분석 중...');
          else if (json.done && json.math) {
            setResult(json.math);
            setFileName(json.fileName ?? '');
            setOpenSection('explanation');
            // 로컬 저장 (영구)
            saveMathResult(json.math, json.fileName ?? '');
            const docTitle = buildDocTitle('수학');
            const savedSet = saveBankSet({
              title: docTitle,
              subject: '수학',
              pdfFileName: json.fileName ?? '',
              questions: [],
              mathAnalysis: json.math,
            });
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
          } else if (json.error) {
            toast.error(json.error);
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
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-50 landscape:flex-row">

      {/* ── 좌측/상단: 입력 & 결과 ── */}
      <div className={cn(
        'flex flex-col overflow-y-auto',
        'landscape:flex-1 landscape:border-r landscape:border-gray-200',
        canvasOpen ? 'portrait:h-[45%]' : 'portrait:flex-1',
      )}>
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
          <button onClick={() => router.push('/')}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">수학 해설</h1>
            <p className="text-xs text-gray-400">문제 사진을 올리면 AI가 풀어드려요</p>
          </div>
          <button
            onClick={() => setCanvasOpen(p => !p)}
            className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition',
              canvasOpen ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'
            )}
            title={canvasOpen ? '연습장 닫기' : '연습장 열기'}
          >
            ✏️
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* 이미지 업로드 */}
          {!result && (
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700">문제 사진 (최대 3장)</p>
              <p className="mb-3 mt-0.5 text-xs text-amber-600">⚠️ 한 사진에 한 문제씩 올려주세요. 여러 문제가 있으면 정확도가 떨어집니다.</p>
              <div className="flex flex-wrap gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative h-24 w-24 overflow-hidden rounded-xl border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                      ×
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-400">
                    <Camera className="h-6 w-6" />
                    <span className="text-xs">사진 추가</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>

              <button
                onClick={handleAnalyze}
                disabled={loading || images.length === 0}
                className={cn(
                  'mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition',
                  loading || images.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
                )}
              >
                {loading ? <><Loader2 className="h-5 w-5 animate-spin" />{progress}</> : '해설 분석하기'}
              </button>
            </section>
          )}

          {/* 결과 */}
          {result && (
            <>
              <div className="flex items-center gap-3">
                <p className="flex-1 truncate text-sm text-gray-500">{fileName}</p>
                <button onClick={() => { setResult(null); setImages([]); }}
                  className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200">
                  새 문제
                </button>
              </div>

              {/* 단계별 풀이 */}
              <ResultSection
                icon={<BookOpen className="h-5 w-5 text-blue-500" />}
                title="단계별 풀이"
                color="blue"
                open={openSection === 'explanation'}
                onToggle={() => setOpenSection(openSection === 'explanation' ? 'concepts' : 'explanation')}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{result.explanation}</p>
              </ResultSection>

              {/* 핵심 개념 */}
              <ResultSection
                icon={<Lightbulb className="h-5 w-5 text-yellow-500" />}
                title="핵심 개념"
                color="yellow"
                open={openSection === 'concepts'}
                onToggle={() => setOpenSection(openSection === 'concepts' ? 'explanation' : 'concepts')}
              >
                <div className="flex flex-col gap-3">
                  {result.concepts.map((c, i) => (
                    <div key={i} className="rounded-xl bg-yellow-50 p-3">
                      <p className="font-semibold text-yellow-900">{c.name}</p>
                      <p className="mt-1 text-sm text-yellow-800">{c.description}</p>
                    </div>
                  ))}
                </div>
              </ResultSection>

              {/* 문제 포인트 */}
              <ResultSection
                icon={<Target className="h-5 w-5 text-red-500" />}
                title="문제 포인트"
                color="red"
                open={openSection === 'points'}
                onToggle={() => setOpenSection(openSection === 'points' ? 'explanation' : 'points')}
              >
                <div className="flex flex-col gap-3">
                  {result.points.map((p, i) => (
                    <div key={i} className="rounded-xl bg-red-50 p-3">
                      <p className="font-semibold text-red-900">⚡ {p.title}</p>
                      <p className="mt-1 text-sm text-red-800">{p.description}</p>
                    </div>
                  ))}
                </div>
              </ResultSection>
            </>
          )}
        </div>
      </div>

      {/* ── 연습장 ── */}
      {canvasOpen && (
        <div className={cn('overflow-hidden', 'landscape:w-1/2', 'portrait:flex-1')}>
          <DrawingCanvas onSave={() => {}} />
        </div>
      )}
    </div>
  );
}

function ResultSection({
  icon, title, color, open, onToggle, children,
}: {
  icon: React.ReactNode;
  title: string;
  color: 'blue' | 'yellow' | 'red';
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const borderColor = { blue: 'border-blue-200', yellow: 'border-yellow-200', red: 'border-red-200' }[color];
  const bgColor = { blue: 'bg-blue-50/50', yellow: 'bg-yellow-50/50', red: 'bg-red-50/50' }[color];

  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-white shadow-sm', open && borderColor)}>
      <button
        onClick={onToggle}
        className={cn('flex w-full items-center gap-3 p-4 text-left', open && bgColor)}
      >
        {icon}
        <span className="flex-1 font-bold text-gray-900">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 p-4">{children}</div>}
    </div>
  );
}
