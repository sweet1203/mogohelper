import type { VariantQuestion, Subject, EnglishAnalysis, MathAnalysis, EnglishMode } from './types';

const BANK_KEY = 'questionBank';

export interface SavedSet {
  id: string;
  title: string;
  subject: Subject;
  pdfFileName: string;
  questions: VariantQuestion[];
  createdAt: string;
  googleDocUrl?: string;
  englishMode?: EnglishMode;
  analysis?: EnglishAnalysis;
  mathAnalysis?: MathAnalysis;
}

export function getBankSets(): SavedSet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BANK_KEY);
    return raw ? (JSON.parse(raw) as SavedSet[]) : [];
  } catch {
    return [];
  }
}

export function saveBankSet(
  set: Omit<SavedSet, 'id' | 'createdAt'>
): SavedSet {
  const list = getBankSets();
  const newSet: SavedSet = {
    ...set,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  list.unshift(newSet);
  localStorage.setItem(BANK_KEY, JSON.stringify(list));
  return newSet;
}

export function updateBankSet(id: string, patch: Partial<SavedSet>): void {
  const list = getBankSets();
  const idx = list.findIndex(s => s.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...patch };
    localStorage.setItem(BANK_KEY, JSON.stringify(list));
  }
}

export function deleteBankSet(id: string): void {
  const list = getBankSets().filter(s => s.id !== id);
  localStorage.setItem(BANK_KEY, JSON.stringify(list));
}

export function getBankSetById(id: string): SavedSet | undefined {
  return getBankSets().find(s => s.id === id);
}
