import { CheckCircle2, AlertCircle } from 'lucide-react';

interface VoiceToastProps {
  message: string;
  isError: boolean;
}

export function VoiceToast({ message, isError }: VoiceToastProps) {
  if (!message) return null;

  return (
    <div
      className={`animate-slideUp flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm max-w-xs ${
        isError
          ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
      }`}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}
