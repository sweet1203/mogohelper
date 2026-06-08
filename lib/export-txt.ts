import type { SavedSet } from './question-bank';

/** 변형문제 세트를 .txt 파일로 다운로드합니다 */
export function exportAsTxt(set: SavedSet): void {
  const dateStr = new Date(set.createdAt).toLocaleDateString('ko-KR');
  const lines: string[] = [];

  lines.push(`■ ${set.subject} 변형문제`);
  lines.push(`원본: ${set.pdfFileName}  |  생성일: ${dateStr}  |  총 ${set.questions.length}문제`);
  lines.push('═'.repeat(50));
  lines.push('');

  set.questions.forEach((q, i) => {
    const answerLabel = ['①', '②', '③', '④', '⑤'][q.answer - 1] ?? `${q.answer}번`;
    lines.push(`[문제 ${i + 1}]  ${q.variant_type}`);
    lines.push('');
    lines.push(q.question);
    lines.push('');
    q.choices.forEach(c => lines.push(`  ${c}`));
    lines.push('');
    lines.push(`▶ 정답: ${answerLabel}`);
    lines.push(`▶ 해설: ${q.explanation}`);
    if (q.change_summary) lines.push(`▶ 변경: ${q.change_summary}`);
    lines.push('─'.repeat(50));
    lines.push('');
  });

  lines.push(`© 변형문제 생성기  ${dateStr}`);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `변형문제_${set.subject}_${set.pdfFileName.replace(/\.[^.]+$/, '')}_${dateStr}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
