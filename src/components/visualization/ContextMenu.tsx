import { useEffect, useRef } from 'react';
import { Focus, X } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  isFocusMode: boolean;
  onFocus: () => void;
  onExitFocus: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, isFocusMode, onFocus, onExitFocus, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onFocus(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
      >
        <Focus className="w-4 h-4 text-stone-400" />
        Focus on this stream
      </button>
      {isFocusMode && (
        <button
          onClick={() => { onExitFocus(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
        >
          <X className="w-4 h-4 text-stone-400" />
          Exit focus
        </button>
      )}
    </div>
  );
}
