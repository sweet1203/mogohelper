/**
 * Google Identity Services (GIS) 클라이언트 사이드 OAuth + Google Docs API
 */

import type { SavedSet } from './question-bank';

const GOOGLE_CLIENT_ID_KEY = 'google_client_id';
const GOOGLE_TOKEN_KEY = 'google_access_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'google_token_expiry';

// ── 설정 ─────────────────────────────────────────────────
export function getGoogleClientId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GOOGLE_CLIENT_ID_KEY) ?? '';
}
export function setGoogleClientId(id: string): void {
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, id.trim());
}
export function clearGoogleClientId(): void {
  localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
}

// ── 토큰 캐시 ─────────────────────────────────────────────
export function getCachedToken(): string | null {
  const token = localStorage.getItem(GOOGLE_TOKEN_KEY);
  const expiry = localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() > parseInt(expiry)) {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
    return null;
  }
  return token;
}
export function cacheToken(token: string, expiresIn: number): void {
  localStorage.setItem(GOOGLE_TOKEN_KEY, token);
  localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000 - 60_000));
}
export function clearToken(): void {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
}

// ── GIS 스크립트 로드 ──────────────────────────────────────
export function loadGISScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'));

    // 이미 로드됐으면 바로 resolve
    const w = window as unknown as { google?: { accounts?: unknown } };
    if (w.google?.accounts) return resolve();

    const existing = document.getElementById('gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS 스크립트 로드 실패')));
      return;
    }
    const s = document.createElement('script');
    s.id = 'gsi-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GIS 스크립트 로드 실패. 네트워크를 확인해주세요.'));
    document.head.appendChild(s);
  });
}

// ── 토큰 클라이언트 타입 ──────────────────────────────────
type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};
type TokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

// ── 토큰 클라이언트 생성 (마운트 시 1회 호출) ────────────
export function createTokenClient(
  onToken: (token: string) => void,
  onError: (msg: string) => void
): TokenClient {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Google Client ID가 없습니다. 설정 페이지에서 입력해주세요.');
  }

  const g = (window as unknown as {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: unknown) => TokenClient;
        };
      };
    };
  }).google;

  return g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
    ].join(' '),
    callback: (resp: TokenResponse) => {
      if (resp.error || !resp.access_token) {
        const reason = resp.error_description || resp.error || '알 수 없는 오류';

        // 사용자에게 친절한 에러 메시지
        if (resp.error === 'popup_blocked_by_browser') {
          onError('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
        } else if (resp.error === 'access_denied') {
          onError('Google 계정 접근이 거부되었습니다. 권한을 허용해주세요.');
        } else if (resp.error === 'invalid_client') {
          onError('Client ID가 올바르지 않습니다. 설정에서 다시 확인해주세요.');
        } else {
          onError(`Google 인증 실패: ${reason}`);
        }
        return;
      }
      cacheToken(resp.access_token, resp.expires_in ?? 3600);
      onToken(resp.access_token);
    },
  });
}

// ── Google Docs 문서 생성 ─────────────────────────────────
async function createDoc(title: string, token: string): Promise<string> {
  const res = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`문서 생성 실패: ${err?.error?.message ?? res.status}`);
  }
  const data = await res.json() as { documentId: string };
  return data.documentId;
}

// ── batchUpdate ───────────────────────────────────────────
async function batchUpdate(docId: string, token: string, requests: unknown[]): Promise<void> {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`내용 삽입 실패: ${err?.error?.message ?? res.status}`);
  }
}

// ── SavedSet → Google Docs 문서 생성 ─────────────────────
export async function buildAndExport(set: SavedSet, token: string): Promise<string> {
  const dateStr = new Date(set.createdAt).toLocaleDateString('ko-KR');
  const title = `[${set.subject}] ${set.pdfFileName} 변형문제 (${dateStr})`;

  const docId = await createDoc(title, token);

  // 텍스트 구성
  const lines: string[] = [];
  lines.push(`${title}\n`);
  lines.push(`과목: ${set.subject}  |  원본: ${set.pdfFileName}  |  생성일: ${dateStr}\n`);
  lines.push('\n');

  set.questions.forEach((q, i) => {
    lines.push(`[문제 ${i + 1}] ${q.variant_type}\n`);
    lines.push(`${q.question}\n\n`);
    q.choices.forEach(c => lines.push(`  ${c}\n`));
    lines.push(`\n정답: ${q.answer}번\n`);
    lines.push(`해설: ${q.explanation}\n`);
    lines.push(`변경 포인트: ${q.change_summary}\n`);
    lines.push('─────────────────────────────────────\n\n');
  });

  await batchUpdate(docId, token, [
    { insertText: { location: { index: 1 }, text: lines.join('') } },
  ]);

  return `https://docs.google.com/document/d/${docId}/edit`;
}
