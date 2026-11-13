import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';

interface LightboxModalProps {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  imageUrl,
  title,
  onClose,
}) => {
  const [scale, setScale] = useState<number>(1);

  if (!imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${title.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col"
    >
      {/* Top Bar */}
      <div className="px-4 py-3 bg-[#0F232E] text-white flex items-center justify-between border-b border-slate-800">
        <div className="min-w-0">
          <h3 id="lightbox-title" className="text-sm font-bold truncate">
            {title}
          </h3>
          <p className="text-[11px] text-slate-300">
            Chế độ kiểm tra chứng từ gốc · Có thể phóng to để đối chiếu chữ ký &amp; dấu xác nhận
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1))))}
            aria-label="Thu nhỏ ảnh"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums px-2">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.2, Number((s + 0.2).toFixed(1))))}
            aria-label="Phóng to ảnh"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Tải ảnh giấy phép về máy"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tải chứng từ</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng phóng to ảnh"
            className="p-2 rounded-lg bg-slate-800 hover:bg-red-600 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Canvas */}
      <div
        onClick={onClose}
        className="flex-1 overflow-auto flex items-center justify-center p-6"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="transition-transform duration-150 origin-center"
          style={{ transform: `scale(${scale})` }}
        >
          <img
            src={imageUrl}
            alt={title}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[82vh] rounded-lg shadow-2xl border border-slate-700 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
