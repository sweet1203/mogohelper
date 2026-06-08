import type { WrongAnswer } from './types';

const STORAGE_KEY = 'wrongAnswers';

export function getWrongAnswers(): WrongAnswer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WrongAnswer[]) : [];
  } catch {
    return [];
  }
}

export function saveWrongAnswer(item: Omit<WrongAnswer, 'id' | 'date' | 'reviewCount'>): WrongAnswer {
  const list = getWrongAnswers();
  const newItem: WrongAnswer = {
    ...item,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    reviewCount: 0,
  };
  list.unshift(newItem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return newItem;
}

export function incrementReviewCount(id: string): void {
  const list = getWrongAnswers();
  const idx = list.findIndex((w) => w.id === id);
  if (idx !== -1) {
    list[idx].reviewCount += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
}

export function deleteWrongAnswer(id: string): void {
  const list = getWrongAnswers().filter((w) => w.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearAllWrongAnswers(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getWrongAnswerById(id: string): WrongAnswer | undefined {
  return getWrongAnswers().find((w) => w.id === id);
}
