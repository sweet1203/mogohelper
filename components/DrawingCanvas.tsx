'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import { Eraser, Pen, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Point { x: number; y: number; pressure: number }
interface Stroke { points: Point[]; color: string; size: number; isEraser: boolean }

const COLORS = ['#1a1a1a', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'];
const SIZES = [2, 4, 6, 10];

function svgPath(stroke: number[][]): string {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q'] as (string | number)[]
  );
  d.push('Z');
  return d.join(' ');
}

interface DrawingCanvasProps {
  onSave?: (dataUrl: string) => void;
}

export default function DrawingCanvas({ onSave }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI state (React)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [showColors, setShowColors] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0); // undo/clear 트리거용

  // 이벤트 핸들러 내부에서 최신 값을 ref로 읽음 → stale closure 없음
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  // ─── 캔버스 전체 다시 그리기 ───────────────────────────────
  const redraw = useCallback((extra?: Point[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const list: Stroke[] = extra && extra.length
      ? [...strokesRef.current, { points: extra, color: colorRef.current, size: sizeRef.current, isEraser: toolRef.current === 'eraser' }]
      : strokesRef.current;

    for (const s of list) {
      const pts = s.points.map(p => [p.x, p.y, p.pressure]);
      const outline = getStroke(pts, { size: s.size * 2, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: false });
      const path2d = new Path2D(svgPath(outline));
      if (s.isEraser) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fill(path2d);
        ctx.restore();
      } else {
        ctx.fillStyle = s.color;
        ctx.fill(path2d);
      }
    }
  }, []);

  // ─── ResizeObserver: 캔버스 DPR 대응 ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx?.scale(dpr, dpr);
      redraw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  // ─── 포인터 이벤트 (한 번만 등록, ref로 최신 값 참조) ──────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pt = (e: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return {
        x: (e.clientX - rect.left),   // CSS 픽셀 기준 (ctx.scale이 처리)
        y: (e.clientY - rect.top),
        pressure: e.pressure > 0 ? e.pressure : 0.5,
      };
    };

    const onDown = (e: PointerEvent) => {
      // ✅ 핵심: touch는 스크롤 허용, pen/mouse만 그리기
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      currentRef.current = [pt(e)];
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!drawingRef.current) return;
      e.preventDefault();

      // ✅ Apple Pencil 240Hz: 누락된 중간 샘플 모두 수집
      const coalesced = e.getCoalescedEvents?.() ?? [e];
      const newPts = coalesced.map(ce => pt(ce));
      currentRef.current = [...currentRef.current, ...newPts];
      redraw(currentRef.current);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!drawingRef.current) return;
      drawingRef.current = false;

      const pts = currentRef.current;
      if (pts.length > 0) {
        strokesRef.current = [
          ...strokesRef.current,
          { points: pts, color: colorRef.current, size: sizeRef.current, isEraser: toolRef.current === 'eraser' },
        ];
        setStrokeCount(strokesRef.current.length); // UI 트리거
        redraw();
        if (onSave) onSave(canvas.toDataURL('image/png'));
      }
      currentRef.current = [];
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [redraw, onSave]); // 의존성 최소화 — 리스너 재등록 없음

  const handleUndo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    redraw();
  };

  const handleClear = () => {
    strokesRef.current = [];
    currentRef.current = [];
    setStrokeCount(0);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex h-full flex-col select-none">
      {/* ── 툴바 ── */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-gray-100 bg-white/95 px-3 py-2 backdrop-blur">
        {/* 펜 */}
        <button
          onClick={() => setTool('pen')}
          className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition',
            tool === 'pen' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100')}
          aria-label="펜"
        >
          <Pen className="h-5 w-5" />
        </button>

        {/* 지우개 */}
        <button
          onClick={() => setTool('eraser')}
          className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition',
            tool === 'eraser' ? 'bg-orange-100 text-orange-500' : 'text-gray-400 hover:bg-gray-100')}
          aria-label="지우개"
        >
          <Eraser className="h-5 w-5" />
        </button>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* 색상 */}
        <div className="relative">
          <button
            onClick={() => setShowColors(p => !p)}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100"
            aria-label="색상"
          >
            <div className="h-5 w-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
          </button>
          {showColors && (
            <div className="absolute left-0 top-12 z-50 flex gap-2 rounded-2xl bg-white p-3 shadow-xl border border-gray-100">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { setColor(c); colorRef.current = c; setShowColors(false); }}
                  className={cn('h-8 w-8 rounded-full border-2 transition',
                    color === c ? 'border-blue-400 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 굵기 */}
        <div className="flex items-center gap-0.5">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => { setSize(s); sizeRef.current = s; }}
              className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition',
                size === s ? 'bg-blue-50' : 'hover:bg-gray-100')}
              aria-label={`굵기 ${s}`}
            >
              <div className="rounded-full bg-gray-700" style={{ width: s * 2 + 2, height: s * 2 + 2 }} />
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* 되돌리기 */}
        <button
          onClick={handleUndo}
          disabled={strokeCount === 0}
          className="rounded-xl px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-100 disabled:opacity-30"
        >
          되돌리기
        </button>

        {/* 전체삭제 */}
        <button
          onClick={handleClear}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-red-400 transition hover:bg-red-50"
          aria-label="전체 지우기"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* ── 캔버스 영역 ── */}
      <div className="relative flex-1 overflow-hidden bg-white">
        {/* 줄 노트 배경 */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.15]">
          <defs>
            <pattern id="ruled" width="100%" height="32" patternUnits="userSpaceOnUse">
              <line x1="0" y1="31" x2="100%" y2="31" stroke="#93c5fd" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ruled)" />
        </svg>

        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{
            // ✅ 핵심 수정: 'none'으로 설정해야 pen 이벤트가 브라우저에 가로채이지 않음
            // 손가락 스크롤은 이 캔버스 영역이 아닌 문제 영역에서 가능
            touchAction: 'none',
          }}
        />

        {strokeCount === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">
            Apple Pencil 또는 마우스로 풀이를 써보세요
          </p>
        )}
      </div>
    </div>
  );
}
