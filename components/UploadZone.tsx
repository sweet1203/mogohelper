'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image as ImageIcon, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type UploadMode = 'pdf' | 'image';

export interface UploadedFiles {
  mode: UploadMode;
  pdf: File | null;
  images: File[];
}

interface UploadZoneProps {
  value: UploadedFiles;
  onChange: (v: UploadedFiles) => void;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
const MAX_IMAGES = 5;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({ value, onChange }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const hasImage = files.some((f) => IMAGE_TYPES.includes(f.type));
      const hasPdf = files.some((f) => f.type === 'application/pdf');

      if (hasImage) {
        const imgs = files.filter((f) => IMAGE_TYPES.includes(f.type)).slice(0, MAX_IMAGES);
        onChange({ mode: 'image', pdf: null, images: imgs });
      } else if (hasPdf) {
        onChange({ mode: 'pdf', pdf: files[0], images: [] });
      }
    },
    [onChange]
  );

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        alert(`PDF가 ${(file.size / 1024 / 1024).toFixed(1)}MB로 너무 큽니다.\n\n4MB 이하로 줄이거나,\n원하는 페이지만 스크린샷 찍어 "사진 캡처" 모드로 올려주세요.\n(이미지 모드가 수식·그림도 더 정확하게 읽습니다)`);
        e.target.value = '';
        return;
      }
      onChange({ mode: 'pdf', pdf: file, images: [] });
    }
    e.target.value = '';
  };

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    const combined = [...value.images, ...incoming].slice(0, MAX_IMAGES);
    onChange({ mode: 'image', pdf: null, images: combined });
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    const updated = value.images.filter((_, i) => i !== idx);
    onChange({ mode: 'image', pdf: null, images: updated });
  };

  const hasFiles = value.pdf !== null || value.images.length > 0;

  /* ---- 선택된 파일 표시 ---- */
  if (hasFiles) {
    if (value.mode === 'pdf' && value.pdf) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-gray-900">{value.pdf.name}</p>
            <p className={`text-sm ${value.pdf.size > 4 * 1024 * 1024 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
              {formatSize(value.pdf.size)}
              {value.pdf.size > 4 * 1024 * 1024 && ' ⚠ 4MB 초과 — 오류 발생 가능'}
            </p>
          </div>
          <button
            onClick={() => onChange({ mode: 'pdf', pdf: null, images: [] })}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-500"
            aria-label="파일 제거"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      );
    }

    if (value.mode === 'image') {
      return (
        <div className="flex flex-col gap-3">
          {/* 이미지 미리보기 그리드 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {value.images.map((img, i) => (
              <div key={i} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <img
                  src={URL.createObjectURL(img)}
                  alt={`문제 ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent opacity-0 transition group-hover:opacity-100">
                  <span className="p-2 text-xs text-white">{img.name}</span>
                </div>
                <button
                  onClick={() => removeImage(i)}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow transition hover:bg-red-50 hover:text-red-500"
                  aria-label="이미지 제거"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                  {i + 1}
                </span>
              </div>
            ))}

            {/* 이미지 추가 버튼 */}
            {value.images.length < MAX_IMAGES && (
              <button
                onClick={() => imgRef.current?.click()}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 transition hover:border-blue-300 hover:text-blue-500"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs">추가</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {value.images.length}/{MAX_IMAGES}장 · 탭하여 추가
            </p>
            <button
              onClick={() => onChange({ mode: 'image', pdf: null, images: [] })}
              className="text-xs text-red-400 hover:text-red-600"
            >
              전체 삭제
            </button>
          </div>

          <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImgChange} />
        </div>
      );
    }
  }

  /* ---- 초기 업로드 UI ---- */
  return (
    <div className="flex flex-col gap-3">
      {/* 탭 버튼 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => pdfRef.current?.click()}
          className={cn(
            'flex flex-col items-center gap-2 rounded-2xl border-2 py-5 transition',
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <FileText className="h-6 w-6 text-blue-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800">PDF 시험지</p>
            <p className="text-xs text-gray-400">전체 or 한 장</p>
          </div>
        </button>

        <button
          onClick={() => imgRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 border-gray-200 bg-gray-50 py-5 transition hover:border-purple-300 hover:bg-purple-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
            <ImageIcon className="h-6 w-6 text-purple-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-800">사진 캡처</p>
            <p className="text-xs text-gray-400">스크린샷 최대 5장</p>
          </div>
        </button>
      </div>

      {/* 드래그앤드롭 영역 */}
      <div
        className={cn(
          'flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4 text-sm transition-colors',
          dragging
            ? 'border-blue-400 bg-blue-50 text-blue-600'
            : 'border-gray-200 text-gray-400'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-4 w-4" />
        PDF 또는 이미지를 여기에 드래그하세요
      </div>

      <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfChange} />
      <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImgChange} />
    </div>
  );
}
