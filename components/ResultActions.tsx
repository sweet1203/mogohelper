'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, FileDown, ExternalLink, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { getBankSetById, type SavedSet } from '@/lib/question-bank';
import { exportAsTxt } from '@/lib/export-txt';
import { getAppsScriptUrl } from '@/lib/apps-script';
import { toast } from 'sonner';

interface ResultActionsProps {
  /** 보관함에 저장된 세트 id (구글 문서 상태 표시 + TXT 저장에 사용) */
  savedSetId?: string;
  /** id가 없을 때 직접 넘기는 세트 (예: 즉석 결과) */
  fallbackSet?: SavedSet;
  /** "새 문제" 클릭 시 동작. 주어지면 홈 이동 대신 이걸 실행 (예: 사진 업로드 화면으로 리셋) */
  onNew?: () => void;
  /** "새 문제" 버튼 라벨 (기본: "새 문제") */
  newLabel?: string;
}

/**
 * 결과 화면 상단 메뉴.
 * - 구글 문서 저장 상태 표시 (저장됨 → 열기 링크 / 저장 중 / 미설정)
 * - 텍스트로 저장
 * - 새 문제 만들기 (홈)
 */
export default function ResultActions({ savedSetId, fallbackSet, onNew, newLabel = '새 문제' }: ResultActionsProps) {
  const router = useRouter();
  const [set, setSet] = useState<SavedSet | undefined>(fallbackSet);
  const [scriptConfigured, setScriptConfigured] = useState(false);

  useEffect(() => {
    setScriptConfigured(!!getAppsScriptUrl());
    if (!savedSetId) return;

    // 구글 문서 저장은 백그라운드로 진행되므로, 잠시 동안 폴링하여 URL을 갱신
    let tries = 0;
    const load = () => {
      const found = getBankSetById(savedSetId);
      if (found) setSet(found);
      tries++;
      if ((!found || !found.googleDocUrl) && tries < 10) {
        setTimeout(load, 1500);
      }
    };
    load();
  }, [savedSetId]);

  const handleTxt = () => {
    if (!set) { toast.error('저장할 내용을 찾지 못했습니다.'); return; }
    try {
      exportAsTxt(set);
      toast.success('텍스트 파일로 저장되었습니다!');
    } catch {
      toast.error('파일 저장에 실패했습니다.');
    }
  };

  const docUrl = set?.googleDocUrl;
  // 구글 문서 저장 상태: 설정됨 + URL 아직 없음 = 저장 중
  const docSaving = scriptConfigured && !!savedSetId && !docUrl;

  return (
    <div className="border-b border-gray-100 bg-white px-4 py-3">
      {/* 구글 문서 상태 */}
      {docUrl ? (
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">구글 문서에 저장되었습니다 · 열기</span>
          <ExternalLink className="h-4 w-4 shrink-0" />
        </a>
      ) : docSaving ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          구글 문서에 저장 중...
        </div>
      ) : null}

      {/* 액션 버튼들 */}
      <div className="flex gap-2">
        <button
          onClick={() => (onNew ? onNew() : router.push('/'))}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          {newLabel}
        </button>
        <button
          onClick={handleTxt}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FileDown className="h-4 w-4" />
          텍스트 저장
        </button>
        <button
          onClick={() => router.push('/saved')}
          className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          aria-label="보관함"
        >
          <Home className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
