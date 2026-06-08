import type { SavedSet } from './question-bank';

/**
 * 변형문제 세트를 이미지(PNG)로 내보냅니다.
 * html2canvas로 임시 DOM을 캡처한 뒤 다운로드 또는 새 탭에 엽니다.
 * iPad Safari: 새 탭에서 열려 롱프레스 → "이미지 저장" 가능
 */
export async function exportAsImage(set: SavedSet): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;

  // ── 임시 컨테이너 생성 (화면 밖) ──────────────────────────
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    'width:800px', 'padding:40px',
    'background:#ffffff', 'font-family:system-ui,sans-serif',
    'color:#1a1a1a', 'line-height:1.6',
  ].join(';');

  const dateStr = new Date(set.createdAt).toLocaleDateString('ko-KR');

  // ── 헤더 ──────────────────────────────────────────────────
  container.innerHTML = `
    <div style="margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #3b82f6">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <span style="background:#3b82f6;color:#fff;padding:4px 14px;border-radius:999px;font-size:14px;font-weight:700">
          ${set.subject}
        </span>
        <span style="font-size:14px;color:#6b7280">${set.questions.length}문제</span>
      </div>
      <h1 style="font-size:22px;font-weight:800;margin:0 0 4px">${set.pdfFileName}</h1>
      <p style="font-size:13px;color:#9ca3af;margin:0">생성일: ${dateStr}</p>
    </div>
  `;

  // ── 문제 카드 ──────────────────────────────────────────────
  set.questions.forEach((q, i) => {
    const answerLabel = ['①', '②', '③', '④', '⑤'][q.answer - 1] ?? `${q.answer}번`;

    const choicesHtml = q.choices
      .map((c, ci) => {
        const isAnswer = ci + 1 === q.answer;
        return `
          <div style="
            padding:10px 14px;margin:4px 0;border-radius:10px;font-size:15px;
            background:${isAnswer ? '#dcfce7' : '#f9fafb'};
            color:${isAnswer ? '#15803d' : '#374151'};
            font-weight:${isAnswer ? '700' : '400'};
            border:1.5px solid ${isAnswer ? '#86efac' : '#e5e7eb'};
          ">${isAnswer ? '✓ ' : ''}${c}</div>
        `;
      })
      .join('');

    const card = document.createElement('div');
    card.style.cssText = [
      'margin-bottom:28px', 'padding:20px 24px',
      'border-radius:16px', 'border:1.5px solid #e5e7eb',
      'background:#ffffff', 'box-shadow:0 1px 4px rgba(0,0,0,0.06)',
    ].join(';');

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="
          display:inline-flex;align-items:center;justify-content:center;
          width:28px;height:28px;border-radius:50%;
          background:#3b82f6;color:#fff;font-size:14px;font-weight:800;flex-shrink:0
        ">${i + 1}</span>
        <span style="
          background:#eff6ff;color:#3b82f6;
          padding:3px 10px;border-radius:999px;font-size:13px;font-weight:600
        ">${q.variant_type}</span>
      </div>

      <p style="font-size:15px;white-space:pre-wrap;margin:0 0 16px;color:#1f2937">${q.question}</p>

      <div style="margin-bottom:16px">${choicesHtml}</div>

      <div style="
        background:#fefce8;border:1.5px solid #fde047;
        border-radius:10px;padding:12px 16px;font-size:14px
      ">
        <span style="font-weight:700;color:#854d0e">정답: ${answerLabel}</span>
        <span style="color:#713f12;margin-left:12px">${q.explanation}</span>
      </div>

      ${q.change_summary ? `
        <div style="
          background:#f0f9ff;border:1.5px solid #bae6fd;
          border-radius:10px;padding:10px 14px;font-size:13px;
          color:#0c4a6e;margin-top:10px
        ">↕ ${q.change_summary}</div>
      ` : ''}
    `;

    container.appendChild(card);
  });

  // ── 푸터 ──────────────────────────────────────────────────
  const footer = document.createElement('p');
  footer.style.cssText = 'font-size:12px;color:#d1d5db;text-align:center;margin-top:8px';
  footer.textContent = `변형문제 생성기 · ${dateStr}`;
  container.appendChild(footer);

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,            // 레티나 화질
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const dataUrl = canvas.toDataURL('image/png');
    const filename = `변형문제_${set.subject}_${set.pdfFileName.replace(/\.[^.]+$/, '')}_${dateStr}.png`;

    // ── iPad Safari: <a download> 가 동작 안 할 수 있어 새 탭으로도 대응 ──
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();

    // 다운로드가 안 되는 경우(iOS Safari) 새 탭에서 이미지 열기
    setTimeout(() => {
      const opened = window.open(dataUrl, '_blank');
      if (!opened) {
        // 팝업 차단 시 현재 탭에서 대체
        const img = new Image();
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        const w = window.open('', '_blank');
        if (w) {
          w.document.body.appendChild(img);
          w.document.title = filename;
        }
      }
    }, 500);
  } finally {
    document.body.removeChild(container);
  }
}
