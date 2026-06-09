import type { SavedSet } from './question-bank';
import type { Subject, EnglishMode } from './types';

const APPS_SCRIPT_URL_KEY = 'apps_script_url';
const DOC_COUNTER_KEY = 'app_doc_counter'; // { "20260608": 3 }

export function getAppsScriptUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(APPS_SCRIPT_URL_KEY) ?? '';
}
export function setAppsScriptUrl(url: string): void {
  localStorage.setItem(APPS_SCRIPT_URL_KEY, url.trim());
}

/* 오늘 날짜 일련번호 (1부터 시작, 하루가 바뀌면 리셋) */
function getDailySequence(): number {
  const today = new Date();
  const dateKey =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  let counter: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(DOC_COUNTER_KEY);
    counter = raw ? JSON.parse(raw) : {};
  } catch { /* noop */ }

  const prev = counter[dateKey] ?? 0;
  const next = prev + 1;
  counter[dateKey] = next;
  localStorage.setItem(DOC_COUNTER_KEY, JSON.stringify(counter));
  return next;
}

/* 문서 제목 생성: 20260608_영어변형문제_1 */
export function buildDocTitle(subject: Subject, englishMode?: EnglishMode): string {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  const label =
    subject === '수학' ? '문제해설' :
    englishMode === 'analysis' ? '영어해설' : '영어변형문제';

  const seq = getDailySequence();
  return `${dateStr}_${label}_${seq}`;
}

/**
 * Apps Script 웹앱으로 전체 데이터를 POST하여 구글 문서에 저장합니다.
 * 문서 제목은 buildDocTitle()로 미리 생성해 전달합니다.
 */
export async function exportViaAppsScript(set: SavedSet, docTitle?: string): Promise<string> {
  const webAppUrl = getAppsScriptUrl();
  if (!webAppUrl) throw new Error('Apps Script URL이 설정되지 않았습니다.');

  const title = docTitle || set.title || buildDocTitle(set.subject, set.englishMode);

  const payload = {
    title,
    subject: set.subject,
    englishMode: set.englishMode ?? 'variant',
    pdfFileName: set.pdfFileName || set.title,
    questions: set.questions,
    analysis: set.analysis ?? null,
    mathAnalysis: set.mathAnalysis ?? null,
  };

  const res = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Apps Script 오류: ${res.status}`);

  const text = await res.text();
  try {
    const json = JSON.parse(text) as { url?: string; error?: string };
    if (json.error) throw new Error(json.error);
    if (json.url) return json.url;
  } catch {
    if (text.startsWith('http')) return text.trim();
    throw new Error('Apps Script 응답 오류');
  }
  return text.trim();
}
