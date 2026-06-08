// AI 프로바이더 설정 — 모든 데이터는 이 기기 localStorage에만 저장됩니다.

export type AIProvider = 'claude' | 'openai' | 'gemini';

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
}

export const PROVIDER_INFO: Record<AIProvider, {
  label: string;
  placeholder: string;
  prefix: string;
  model: string;
  color: string;
}> = {
  claude: {
    label: 'Claude (Anthropic)',
    placeholder: 'sk-ant-api03-...',
    prefix: 'sk-ant-',
    model: 'claude-opus-4-5',
    color: 'orange',
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    placeholder: 'sk-proj-... 또는 sk-...',
    prefix: 'sk-',
    model: 'gpt-4o',
    color: 'green',
  },
  gemini: {
    label: 'Gemini (Google)',
    placeholder: 'AIza...',
    prefix: 'AIza',
    model: 'gemini-1.5-pro',
    color: 'blue',
  },
};

const PROVIDER_KEY = 'app_ai_provider';
const API_KEY_PREFIX = 'app_api_key_';

export function getProviderConfig(): ProviderConfig {
  if (typeof window === 'undefined') return { provider: 'claude', apiKey: '' };
  const provider = (localStorage.getItem(PROVIDER_KEY) as AIProvider) || 'claude';
  const apiKey = localStorage.getItem(API_KEY_PREFIX + provider) ?? '';
  return { provider, apiKey };
}

export function saveProviderConfig(provider: AIProvider, apiKey: string): void {
  localStorage.setItem(PROVIDER_KEY, provider);
  localStorage.setItem(API_KEY_PREFIX + provider, apiKey.trim());
}

export function getApiKeyForProvider(provider: AIProvider): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(API_KEY_PREFIX + provider) ?? '';
}

export function clearProviderKey(provider: AIProvider): void {
  localStorage.removeItem(API_KEY_PREFIX + provider);
}

/** 현재 선택된 프로바이더의 API 키 (API 요청 시 사용) */
export function getActiveApiKey(): string {
  const { provider } = getProviderConfig();
  return getApiKeyForProvider(provider);
}
