import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import type { VoiceState } from '../../hooks/useVoiceControl';
import { VoiceToast } from './VoiceToast';

interface VoiceControlButtonProps {
  state: VoiceState;
  transcript: string;
  toastMessage: string;
  errorMessage: string;
  isSupported: boolean;
  onToggle: () => void;
}

export function VoiceControlButton({
  state,
  transcript,
  toastMessage,
  errorMessage,
  isSupported,
  onToggle,
}: VoiceControlButtonProps) {
  if (!isSupported) return null;

  const isIdle = state === 'idle';
  const isError = state === 'error';
  const isListening = state === 'listening';
  const isProcessing = state === 'processing';
  const isSpeaking = state === 'speaking';
  const isSessionActive = !isIdle; // any non-idle state means session is live

  return (
    <div className="absolute bottom-4 left-4 z-30 flex flex-col items-start gap-2">
      {/* Toast notification */}
      <VoiceToast
        message={toastMessage}
        isError={isError || !!errorMessage}
      />

      {/* Transcript bubble */}
      {isListening && transcript && (
        <div className="animate-fadeIn bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg px-3 py-2 text-sm text-stone-700 dark:text-stone-300 max-w-xs">
          {transcript}
        </div>
      )}

      {/* Mic button — always clickable so user can stop the session at any point */}
      <button
        onClick={onToggle}
        className={`relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500 animate-pulse'
            : isProcessing
              ? 'bg-brand-500 hover:bg-brand-600 focus:ring-brand-500'
              : isSpeaking
                ? 'bg-brand-500 hover:bg-brand-600 focus:ring-brand-500'
                : isError
                  ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
                  : 'bg-brand-500 hover:bg-brand-600 focus:ring-brand-500'
        }`}
        title={
          isSessionActive
            ? 'Stop voice session'
            : 'Start voice session'
        }
      >
        {isListening ? (
          <MicOff className="w-5 h-5 text-white" />
        ) : isProcessing ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        ) : isSpeaking ? (
          <Volume2 className="w-5 h-5 text-white" />
        ) : (
          <Mic className="w-5 h-5 text-white" />
        )}

        {/* Active session ring — shows during listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping" />
        )}

        {/* Session-active dot indicator (processing / speaking) */}
        {(isProcessing || isSpeaking) && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-stone-900" />
        )}
      </button>
    </div>
  );
}
