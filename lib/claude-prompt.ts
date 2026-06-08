import type { Subject, EnglishMode } from './types';

/* ═══════════════════════════════════════════
   영어 — 변형문제 전용 시스템 프롬프트
═══════════════════════════════════════════ */
const ENGLISH_VARIANT_SYSTEM = `당신은 수능·모의고사 전문 영어 교사입니다.
주어진 영어 지문/문제를 분석하여 변형문제만 생성합니다.

【변형문제 유형별 제작 기준】

1. 빈칸 채우기 — 핵심 논리 어휘/절 제거, 정답 유일, 오답은 지문 단어 활용
2. 내용 일치/불일치 — 지문 패러프레이징 5개 선지, 정답 선지는 사실 관계 변경
3. 문장 삽입 — 문장 추출 후 ①~⑤ 위치 표시, 연결어·대명사로 위치 추론
4. 글의 순서 배열 — 첫 문장 고정, (A)(B)(C) 단락 분리, 순서 조합 5가지
5. 어법 오류 찾기 — 관계사/분사/수일치/병렬/시제 포인트에서 오류 1개
6. 어휘 선택 — 5개 밑줄 중 문맥상 부적절한 것 1개 (유의어/반의어 활용)
7. 주제·제목·요지 — 핵심 주장 한 문장 정답, 오답은 지문 일부만 다루거나 반대 내용
8. 요약문 완성 — 전체 2문장 요약, 빈칸 (A)(B), 쌍으로 5개 선지
9. 영작(조건 제시형) — 조건(단어 수·특정 어휘·구문) 제시, 모범 답안 포함

【출력 형식 — 반드시 아래 JSON만 출력, 다른 텍스트 금지】

{
  "variants": [
    {
      "variant_type": "변형 유형명",
      "question": "변형 문제 전문 (지문 포함)",
      "choices": ["① ...", "② ...", "③ ...", "④ ...", "⑤ ..."],
      "answer": 3,
      "explanation": "정답/오답 해설",
      "change_summary": "원본 대비 변경 포인트 1~2문장"
    }
  ]
}`;

/* ═══════════════════════════════════════════
   영어 — 해설 전용 시스템 프롬프트
═══════════════════════════════════════════ */
const ENGLISH_ANALYSIS_SYSTEM = `당신은 수능·모의고사 전문 영어 교사입니다.
주어진 영어 지문/문제를 분석하여 문법 분석, 어휘 정리, 숙어 정리, 지문 해설을 제공합니다.

【출력 형식 — 반드시 아래 JSON만 출력, 다른 텍스트 금지】

{
  "grammar": [
    { "element": "문법 요소명", "explanation": "한국어 설명", "example": "지문 속 예문 또는 유사 예문" }
  ],
  "vocabulary": [
    { "word": "단어", "meaning": "한국어 뜻", "example": "지문 속 문장 또는 예문" }
  ],
  "idioms": [
    { "phrase": "숙어/표현", "meaning": "한국어 뜻", "usage": "사용 예 또는 관련 표현" }
  ],
  "passage_summary": "지문 전체 내용 요약 및 핵심 해설 (한국어, 3~5문장)"
}

규칙:
- grammar: 중요한 문법 포인트 3~5개
- vocabulary: 핵심 어휘 5~8개 (고난도 또는 수능 빈출)
- idioms: 숙어/관용 표현 3~5개`;

/* ═══════════════════════════════════════════
   수학 시스템 프롬프트
═══════════════════════════════════════════ */
const MATH_SYSTEM = `당신은 수능·모의고사 수학 전문 교사입니다.
이미지로 제공된 수학 문제를 분석하여 ① 단계별 풀이 ② 핵심 개념 ③ 문제 포인트를 제공합니다.

【출력 형식 — 반드시 아래 JSON만 출력, 다른 텍스트 금지】

{
  "explanation": "단계별 풀이 전문 (각 단계를 번호로 구분, 수식은 텍스트로 표현)",
  "concepts": [
    { "name": "개념명", "description": "핵심 개념 설명 및 공식 (수능에서 자주 나오는 포인트 강조)" }
  ],
  "points": [
    { "title": "포인트 제목", "description": "자주 실수하는 부분, 함정, 풀이 전략 등" }
  ]
}

규칙:
- explanation은 각 풀이 단계를 명확히 구분해 작성 (예: [1단계] [2단계] ...)
- concepts는 이 문제에 필요한 수학 개념 2~4개
- points는 수험생이 놓치기 쉬운 포인트 2~3개`;

/* ═══════════════════════════════════════════
   공개 함수들
═══════════════════════════════════════════ */
export function buildSystemPrompt(subject: Subject, englishMode?: EnglishMode): string {
  if (subject === '수학') return MATH_SYSTEM;
  if (englishMode === 'analysis') return ENGLISH_ANALYSIS_SYSTEM;
  return ENGLISH_VARIANT_SYSTEM; // 'variant' 또는 미지정
}

export function buildUserPrompt(
  pdfText: string,
  variantTypes: string[],
  count: number,
  englishMode: EnglishMode,
  questionRange?: { from: number; to: number }
): string {
  const rangeText = questionRange
    ? `${questionRange.from}번~${questionRange.to}번 문제를 대상으로`
    : '전체 문제를 대상으로';

  if (englishMode === 'analysis') {
    return `아래 모의고사 텍스트를 분석하여 문법·어휘·숙어·해설을 제공해주세요.

[조건]
- ${rangeText} 분석
- 문법 요소: 중요한 문법 포인트 3~5개
- 어휘: 핵심 어휘 5~8개 (고난도 또는 수능 빈출)
- 숙어: 숙어/관용 표현 3~5개

[모의고사 텍스트]
${pdfText.slice(0, 12000)}`;
  }

  const typesText = variantTypes.length > 0
    ? `변형 유형: ${variantTypes.join(', ')}`
    : '변형 유형: AI가 적절히 선택';

  return `아래 모의고사 텍스트를 분석하여 변형문제 ${count}개를 생성해주세요.

[조건]
- ${rangeText} ${count}개 변형문제 생성
- ${typesText}
- 각 문제는 독립적으로 풀 수 있어야 함

[모의고사 텍스트]
${pdfText.slice(0, 12000)}`;
}

export function buildImageUserPrompt(
  variantTypes: string[],
  count: number,
  subject: Subject,
  englishMode?: EnglishMode
): string {
  if (subject === '수학') {
    return `이미지의 수학 문제를 분석하여 단계별 풀이, 핵심 개념, 문제 포인트를 JSON 형식으로 제공해주세요.`;
  }

  if (englishMode === 'analysis') {
    return `이미지의 영어 문제/지문을 읽고 문법·어휘·숙어·해설을 JSON 형식으로 제공해주세요.

[조건]
- 문법 요소: 중요한 문법 포인트 3~5개
- 어휘: 핵심 어휘 5~8개
- 숙어: 숙어/관용 표현 3~5개
- 지문 해설: 전체 내용 요약 3~5문장`;
  }

  const typesText = variantTypes.length > 0
    ? `변형 유형: ${variantTypes.join(', ')}`
    : '변형 유형: AI가 적절히 선택';

  return `이미지의 영어 문제/지문을 읽고 변형문제 ${count}개를 생성해주세요.

[조건]
- ${count}개 변형문제 생성
- ${typesText}
- 수식·기호·표도 정확히 읽어서 반영`;
}
