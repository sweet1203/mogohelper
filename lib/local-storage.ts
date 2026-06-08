// 모든 앱 데이터를 사용자 기기의 localStorage에만 저장됩니다.
// 서버에는 아무 데이터도 전송되지 않습니다.

const KEYS = {
  SESSION: 'app_current_session',
  WRONG_ANSWERS: 'wrongAnswers',
  MATH_RESULT: 'app_math_result',
} as const;

// ── API 키 (하위 호환: ai-provider.ts의 getActiveApiKey 사용 권장) ──
export function getApiKey(): string {
  // ai-provider.ts의 getActiveApiKey()로 위임
  if (typeof window === 'undefined') return '';
  const provider = localStorage.getItem('app_ai_provider') || 'claude';
  return localStorage.getItem('app_api_key_' + provider) ?? '';
}

// ── 현재 시험 세션 ──
export function saveSession(data: unknown): void {
  localStorage.setItem(KEYS.SESSION, JSON.stringify(data));
}

export function loadSession<T>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEYS.SESSION);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function clearSession(): void {
  localStorage.removeItem(KEYS.SESSION);
}
