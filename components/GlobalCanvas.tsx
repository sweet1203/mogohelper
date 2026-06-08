'use client';

/**
 * 어떤 화면에서든 띄울 수 있는 전체 화면 펜슬 오버레이.
 * layout.tsx에서 렌더링되며, 우하단 FAB(Floating Action Button)으로 토글합니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PenLine, PenOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStroke } from 'perfect-freehand';

type Point = [number, number, number]; // x, y, pressure

function getSvgPathFromStroke(stroke: number[][]): string {
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

export default function GlobalCanvas() {
  const [open, setOpen] = useState(false);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[]>([]);
  const isDrawing = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDrawing.current = true;
    const p: Point = [e.clientX, e.clientY, e.pressure || 0.5];
    setCurrent([p]);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    const events = e.nativeEvent instanceof PointerEvent && 'getCoalescedEvents' in e.nativeEvent
      ? (e.nativeEvent as PointerEvent).getCoalescedEvents()
      : [e.nativeEvent];
    setCurrent(prev => [
      ...prev,
      ...events.map(ev => [ev.clientX, ev.clientY, (ev as PointerEvent).pressure || 0.5] as Point),
    ]);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    setCurrent(prev => {
      if (prev.length > 0) setStrokes(s => [...s, prev]);
      return [];
    });
  }, []);

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const allStrokes = [...strokes, ...(current.length ? [current] : [])];

  return (
    <>
      {/* 전체 화면 캔버스 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* 반투명 배경 */}
          <div className="absolute inset-0 bg-white/10" />

          {/* SVG 스트로크 */}
          <svg
            ref={svgRef}
            className="absolute inset-0 h-full w-full"
            style={{ touchAction: 'none' }}
          >
            {allStrokes.map((pts, i) => {
              const stroke = getStroke(pts, {
                size: 4,
                thinning: 0.6,
                smoothing: 0.5,
                streamline: 0.5,
              });
              return (
                <path
                  key={i}
                  d={getSvgPathFromStroke(stroke)}
                  fill="rgba(30,80,200,0.85)"
                />
              );
            })}
          </svg>

          {/* 상단 도구 */}
          <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white/90 px-4 py-2 shadow-lg backdrop-blur">
            <span className="text-sm font-semibold text-gray-700">필기 오버레이</span>
            <button
              onClick={(e) => { e.stopPropagation(); setStrokes([]); setCurrent([]); }}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="flex h-8 items-center gap-1 rounded-xl bg-gray-800 px-3 text-xs font-bold text-white hover:bg-gray-700"
            >
              <PenOff className="h-3.5 w-3.5" />닫기
            </button>
          </div>
        </div>
      )}

      {/* FAB - 우하단 */}
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          'fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all active:scale-95',
          open
            ? 'bg-blue-600 text-white shadow-blue-300'
            : 'bg-white text-gray-600 shadow-gray-300 hover:bg-blue-50 hover:text-blue-600'
        )}
        aria-label={open ? '필기 닫기' : '필기 열기'}
        title={open ? '필기 닫기 (ESC)' : '어디서든 필기하기'}
      >
        {open ? <PenOff className="h-6 w-6" /> : <PenLine className="h-6 w-6" />}
      </button>
    </>
  );
}
