import type { SavedSet } from './question-bank';

/**
 * 저장 세트를 .txt 파일로 다운로드합니다.
 * 구글 문서(Apps Script)와 동일하게 3가지 유형을 모두 지원:
 *  - 영어 변형문제 (questions)
 *  - 영어 해설 (analysis)
 *  - 수학·과학 해설 (mathAnalysis)
 */
export function exportAsTxt(set: SavedSet): void {
  const dateStr = new Date(set.createdAt).toLocaleDateString('ko-KR');
  const lines: string[] = [];
  const HR = '═'.repeat(50);
  const hr = '─'.repeat(50);

  const title = set.title || set.pdfFileName || `${set.subject} 자료`;

  /* ── 수학·과학 해설 ── */
  if (set.subject === '수학' && set.mathAnalysis) {
    const m = set.mathAnalysis;
    lines.push(`■ ${set.subject} 문제 해설`);
    lines.push(`원본: ${set.pdfFileName}  |  생성일: ${dateStr}`);
    lines.push(HR);
    lines.push('');
    if (m.explanation) {
      lines.push('📐 단계별 풀이');
      lines.push('');
      lines.push(m.explanation);
      lines.push('');
    }
    if (m.concepts?.length) {
      lines.push('💡 핵심 개념');
      lines.push('');
      m.concepts.forEach(c => {
        lines.push(`▶ ${c.name}`);
        lines.push(`  ${c.description}`);
        lines.push('');
      });
    }
    if (m.points?.length) {
      lines.push('🎯 문제 포인트');
      lines.push('');
      m.points.forEach(p => {
        lines.push(`▶ ${p.title}`);
        lines.push(`  ${p.description}`);
        lines.push('');
      });
    }
  }

  /* ── 영어 해설 ── */
  else if (set.englishMode === 'analysis' && set.analysis) {
    const a = set.analysis;
    lines.push('■ 영어 지문 해설');
    lines.push(`원본: ${set.pdfFileName}  |  생성일: ${dateStr}`);
    lines.push(HR);
    lines.push('');
    if (a.grammar?.length) {
      lines.push('📌 중요 문법');
      lines.push('');
      a.grammar.forEach(g => {
        lines.push(`▶ ${g.element}`);
        lines.push(`  ${g.explanation}`);
        if (g.example) lines.push(`  예: ${g.example}`);
        lines.push('');
      });
    }
    if (a.vocabulary?.length) {
      lines.push('📖 핵심 어휘');
      lines.push('');
      a.vocabulary.forEach(v => {
        lines.push(`▶ ${v.word} — ${v.meaning}`);
        if (v.example) lines.push(`  ${v.example}`);
      });
      lines.push('');
    }
    if (a.idioms?.length) {
      lines.push('🔖 숙어 & 표현');
      lines.push('');
      a.idioms.forEach(id => {
        lines.push(`▶ ${id.phrase} — ${id.meaning}`);
        if (id.usage) lines.push(`  활용: ${id.usage}`);
      });
      lines.push('');
    }
    if (a.passage_summary) {
      lines.push('📝 지문 해설');
      lines.push('');
      lines.push(a.passage_summary);
      lines.push('');
    }
  }

  /* ── 영어 변형문제 ── */
  else {
    lines.push(`■ ${set.subject} 변형문제`);
    lines.push(`원본: ${set.pdfFileName}  |  생성일: ${dateStr}  |  총 ${set.questions.length}문제`);
    lines.push(HR);
    lines.push('');

    // 문제부
    lines.push('[ 문 제 ]');
    lines.push('');
    set.questions.forEach((q, i) => {
      lines.push(`${i + 1}. [${q.variant_type}]`);
      lines.push('');
      lines.push(q.question);
      lines.push('');
      q.choices.forEach(c => lines.push(`  ${c}`));
      lines.push('');
      lines.push('');
    });

    // 정답·해설부
    lines.push(hr);
    lines.push('[ 정답 및 해설 ]');
    lines.push('');
    set.questions.forEach((q, i) => {
      const answerLabel = ['①', '②', '③', '④', '⑤'][q.answer - 1] ?? `${q.answer}번`;
      lines.push(`${i + 1}. 정답: ${answerLabel}  (${q.variant_type})`);
      lines.push(`해설: ${q.explanation}`);
      if (q.change_summary) lines.push(`변경 포인트: ${q.change_summary}`);
      lines.push('');
    });
  }

  lines.push(hr);
  lines.push(`© 모고헬퍼  ${dateStr}`);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\.[^.]+$/, '')}_${dateStr}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
