export type Subject = '영어' | '수학';

/* ── 영어 변형 유형 ── */
export type EnglishVariantType =
  | '빈칸 채우기'
  | '내용 일치/불일치'
  | '문장 삽입'
  | '글의 순서 배열'
  | '어법 오류 찾기'
  | '어휘 선택'
  | '주제·제목·요지'
  | '요약문 완성'
  | '영작 (조건 제시형)';

export type VariantType = EnglishVariantType;

/* ── 변형문제 ── */
export interface VariantQuestion {
  id: string;
  variant_type: VariantType | string;
  question: string;
  choices: string[];
  answer: number; // 1-5
  explanation: string;
  change_summary: string;
}

/* ── 영어 분석 ── */
export interface GrammarItem {
  element: string;
  explanation: string;
  example: string;
}
export interface VocabItem {
  word: string;
  meaning: string;
  example: string;
}
export interface IdiomItem {
  phrase: string;
  meaning: string;
  usage: string;
}
export interface EnglishAnalysis {
  grammar: GrammarItem[];
  vocabulary: VocabItem[];
  idioms: IdiomItem[];
  passage_summary: string;
}

/* ── 수학 분석 ── */
export interface MathConcept { name: string; description: string }
export interface MathPoint   { title: string; description: string }
export interface MathAnalysis {
  explanation: string;       // 단계별 풀이
  concepts: MathConcept[];   // 핵심 개념
  points: MathPoint[];       // 문제 포인트
}

/* ── 세션 / 저장 ── */
export interface GenerateRequest {
  subject: Subject;
  variantTypes: string[];
  questionRange?: { from: number; to: number };
  pdfText: string;
  pdfFileName: string;
  count: number;
}

export interface WrongAnswer {
  id: string;
  date: string;
  subject: Subject;
  originalPdfName: string;
  variantType: string;
  question: string;
  choices: string[];
  correctAnswer: number;
  myAnswer: number;
  explanation: string;
  drawingData: string;
  reviewCount: number;
  changeSummary: string;
}

export type EnglishMode = 'variant' | 'analysis';

export interface SessionData {
  questions: VariantQuestion[];
  subject: Subject;
  pdfFileName: string;
  analysis?: EnglishAnalysis;
  englishMode?: EnglishMode;
  savedSetId?: string;
}
