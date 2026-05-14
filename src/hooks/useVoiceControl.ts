import { useState, useCallback, useRef, useEffect } from 'react';
import { getGenerativeModel } from 'firebase/ai';
import { ai } from '../lib/firebase';
import type { Stream, StreamWithChildren } from '../types/database';
import type { SourceType, StreamStatus } from '../lib/streamConfig';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceCommand {
  action: string;
  confirmation: string;
  stream_id?: string;
  title?: string;
  description?: string;
  status?: StreamStatus;
  source_type?: SourceType;
  parent_stream_id?: string;
  due_date?: string | null;
  dependency?: string;
  content?: string;
  query?: string;
}

export interface VoiceControlOptions {
  streams: Stream[];
  selectedStream: StreamWithChildren | null;
  focusedStreamId: string | null;
  projectName: string;
  projectDescription: string | null;
  onSelectStream: (stream: StreamWithChildren) => void;
  onCreateStream: (
    title: string,
    description: string,
    sourceType: SourceType,
    parentStreamId: string | null
  ) => Promise<void>;
  onUpdateStreamById: (id: string, updates: Partial<Stream>) => Promise<void>;
  onDeleteStream: () => Promise<void>;
  onSetSelectedStream: (stream: StreamWithChildren | null) => void;
  onAddNote: (content: string) => Promise<void>;
  onBranch: () => void;
  onSearch: (query: string) => void;
  onFocusStream: (id: string) => void;
  onExitFocus: () => void;
  onResetView: () => void;
}

const SYSTEM_INSTRUCTION = `You are a voice command interpreter for a project management board called Workstream. Users speak commands to control the board. Your job is to interpret their intent and return a structured JSON command.

IMPORTANT: You MUST respond with valid JSON matching one of the action schemas below. Always include "action" and "confirmation" fields. The "confirmation" field should be a short, friendly sentence confirming what you did (spoken aloud via TTS).

Available actions:

1. select_stream — Select/open a stream card
   { "action": "select_stream", "stream_id": "<id>", "confirmation": "..." }

2. create_stream — Create a new stream
   { "action": "create_stream", "title": "<title>", "description": "<desc or empty>", "source_type": "task|investigation|meeting|blocker|discovery", "parent_stream_id": "<id or null>", "confirmation": "..." }
   Default source_type to "task" if not specified. Default parent_stream_id to null unless user mentions a parent.

3. branch_stream — Branch from the currently selected stream
   { "action": "branch_stream", "confirmation": "..." }

4. update_status — Change a stream's status
   { "action": "update_status", "stream_id": "<id>", "status": "backlog|active|blocked|done", "confirmation": "..." }

5. update_title — Rename a stream
   { "action": "update_title", "stream_id": "<id>", "title": "<new title>", "confirmation": "..." }

6. update_description — Update a stream's description
   { "action": "update_description", "stream_id": "<id>", "description": "<new description>", "confirmation": "..." }

7. set_due_date — Set or clear a stream's due date
   { "action": "set_due_date", "stream_id": "<id>", "due_date": "YYYY-MM-DD or null", "confirmation": "..." }

8. add_dependency — Add a dependency to a stream
   { "action": "add_dependency", "stream_id": "<id>", "dependency": "<dependency text>", "confirmation": "..." }

9. remove_dependency — Remove a dependency from a stream
   { "action": "remove_dependency", "stream_id": "<id>", "dependency": "<dependency text>", "confirmation": "..." }

10. add_note — Add a note to a stream
    { "action": "add_note", "stream_id": "<id>", "content": "<note content>", "confirmation": "..." }

11. delete_stream — Delete the currently selected stream
    { "action": "delete_stream", "confirmation": "..." }

12. search — Search for streams
    { "action": "search", "query": "<search query>", "confirmation": "..." }

13. focus_stream — Enter focus mode on a stream
    { "action": "focus_stream", "stream_id": "<id>", "confirmation": "..." }

14. unfocus — Exit focus mode
    { "action": "unfocus", "confirmation": "..." }

15. reset_view — Reset canvas zoom/pan to fit all
    { "action": "reset_view", "confirmation": "..." }

16. error — When you can't understand the command
    { "action": "error", "confirmation": "Sorry, I didn't understand that. Try something like 'select auth card' or 'create a task called API integration'." }

Rules:
- When a user says "this" or "the selected one", use the currently selected stream.
- If the user references a stream by name, find the closest match from the provided stream list and use its ID.
- For update actions (status, title, description, due_date, dependencies, notes), if the user doesn't specify which stream, use the currently selected stream's ID.
- If no stream is selected and the command requires one, return an error action.
- Keep confirmations concise (under 15 words) and natural-sounding.
- CONVERSATION CONTEXT: You will receive the conversation history of previous voice commands and your responses. Use this context to resolve pronouns and references like "it", "that one", "the same card", "do it again", "now rename it", etc. The most recent command/response pair is the most relevant for resolving references.`;

function buildUserPrompt(
  transcript: string,
  options: Pick<VoiceControlOptions, 'streams' | 'selectedStream' | 'focusedStreamId' | 'projectName' | 'projectDescription'>
): string {
  const { streams, selectedStream, focusedStreamId, projectName, projectDescription } = options;

  const streamList = streams.map(s => ({
    id: s.id,
    title: s.title,
    status: s.status,
    source_type: s.source_type,
    parent_stream_id: s.parent_stream_id,
    dependencies: s.dependencies,
    due_date: s.due_date,
    description: s.description ? s.description.slice(0, 100) : null,
  }));

  return `Project: ${projectName}${projectDescription ? ` — ${projectDescription}` : ''}
Selected stream: ${selectedStream ? `${selectedStream.id} "${selectedStream.title}" (${selectedStream.status})` : 'None'}
Focus mode: ${focusedStreamId ? `focused on ${focusedStreamId}` : 'off'}
Streams: ${JSON.stringify(streamList)}

Voice command: "${transcript}"`;
}

const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

interface ConversationTurn {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

const MAX_HISTORY_TURNS = 20; // 10 exchanges (user + model each)

export function useVoiceControl(options: VoiceControlOptions) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const conversationHistoryRef = useRef<ConversationTurn[]>([]);
  const sessionActiveRef = useRef(false);

  const isSupported = SpeechRecognitionImpl != null;

  // Auto-clear toast after 4 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const speak = useCallback((text: string, onDone: () => void) => {
    if (!('speechSynthesis' in window)) {
      onDone();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.onend = onDone;
    utterance.onerror = onDone;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Start a single recognition cycle (one utterance).
  // Called both on initial session start and after each command completes.
  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionImpl || !sessionActiveRef.current) return;

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setState('listening');
      setTranscript('');
      setErrorMessage('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setTranscript(final || interim);

      if (final) {
        // Will be processed — don't let onend restart yet
        processTranscript(final);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        // No speech detected — restart listening if session is still active
        if (sessionActiveRef.current) {
          // Small delay to avoid tight restart loops
          setTimeout(() => startRecognition(), 300);
        } else {
          setState('idle');
          setTranscript('');
        }
        return;
      }

      if (event.error === 'aborted') {
        // Intentional abort (e.g. user toggled off) — don't treat as error
        return;
      }

      if (event.error === 'not-allowed') {
        setToastMessage('Microphone access denied');
        setErrorMessage('Microphone access denied');
      } else {
        setToastMessage('Something went wrong');
        setErrorMessage('Something went wrong');
      }
      // Fatal errors end the session
      sessionActiveRef.current = false;
      setState('error');
      // Auto-clear error after 3s
      setTimeout(() => {
        setState(prev => (prev === 'error' ? 'idle' : prev));
        setErrorMessage('');
      }, 3000);
    };

    recognition.onend = () => {
      // recognition.onend fires after every cycle.
      // If we're still in "listening" state (no final result captured),
      // restart if session is active. Otherwise the processTranscript
      // pipeline handles the restart.
      setState(prev => {
        if (prev === 'listening' && sessionActiveRef.current) {
          // Restart recognition for the next utterance
          setTimeout(() => startRecognition(), 300);
        }
        return prev;
      });
    };

    recognitionRef.current = recognition;
    recognition.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dispatchCommand = useCallback(async (command: VoiceCommand) => {
    const opts = optionsRef.current;
    const { action } = command;

    try {
      switch (action) {
        case 'select_stream': {
          const stream = opts.streams.find(s => s.id === command.stream_id);
          if (stream) {
            opts.onSelectStream(stream as StreamWithChildren);
          }
          break;
        }

        case 'create_stream': {
          await opts.onCreateStream(
            command.title || 'Untitled',
            command.description || '',
            (command.source_type as SourceType) || 'task',
            command.parent_stream_id || null
          );
          break;
        }

        case 'branch_stream': {
          opts.onBranch();
          break;
        }

        case 'update_status': {
          if (command.stream_id && command.status) {
            await opts.onUpdateStreamById(command.stream_id, { status: command.status });
            if (opts.selectedStream?.id === command.stream_id) {
              opts.onSetSelectedStream({ ...opts.selectedStream, status: command.status });
            }
          }
          break;
        }

        case 'update_title': {
          if (command.stream_id && command.title) {
            await opts.onUpdateStreamById(command.stream_id, { title: command.title });
            if (opts.selectedStream?.id === command.stream_id) {
              opts.onSetSelectedStream({ ...opts.selectedStream, title: command.title });
            }
          }
          break;
        }

        case 'update_description': {
          if (command.stream_id && command.description !== undefined) {
            await opts.onUpdateStreamById(command.stream_id, { description: command.description });
            if (opts.selectedStream?.id === command.stream_id) {
              opts.onSetSelectedStream({ ...opts.selectedStream, description: command.description });
            }
          }
          break;
        }

        case 'set_due_date': {
          if (command.stream_id) {
            await opts.onUpdateStreamById(command.stream_id, {
              due_date: command.due_date || null,
            });
            if (opts.selectedStream?.id === command.stream_id) {
              opts.onSetSelectedStream({
                ...opts.selectedStream,
                due_date: command.due_date || null,
              });
            }
          }
          break;
        }

        case 'add_dependency': {
          if (command.stream_id && command.dependency) {
            const stream = opts.streams.find(s => s.id === command.stream_id);
            if (stream) {
              const deps = [...(stream.dependencies || []), command.dependency];
              await opts.onUpdateStreamById(command.stream_id, { dependencies: deps });
              if (opts.selectedStream?.id === command.stream_id) {
                opts.onSetSelectedStream({ ...opts.selectedStream, dependencies: deps });
              }
            }
          }
          break;
        }

        case 'remove_dependency': {
          if (command.stream_id && command.dependency) {
            const stream = opts.streams.find(s => s.id === command.stream_id);
            if (stream) {
              const deps = (stream.dependencies || []).filter(
                d => d.toLowerCase() !== command.dependency!.toLowerCase()
              );
              await opts.onUpdateStreamById(command.stream_id, { dependencies: deps });
              if (opts.selectedStream?.id === command.stream_id) {
                opts.onSetSelectedStream({ ...opts.selectedStream, dependencies: deps });
              }
            }
          }
          break;
        }

        case 'add_note': {
          if (command.stream_id && command.content) {
            if (opts.selectedStream?.id !== command.stream_id) {
              const stream = opts.streams.find(s => s.id === command.stream_id);
              if (stream) {
                opts.onSelectStream(stream as StreamWithChildren);
              }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            await opts.onAddNote(command.content);
          }
          break;
        }

        case 'delete_stream': {
          await opts.onDeleteStream();
          break;
        }

        case 'search': {
          if (command.query) {
            opts.onSearch(command.query);
          }
          break;
        }

        case 'focus_stream': {
          if (command.stream_id) {
            opts.onFocusStream(command.stream_id);
          }
          break;
        }

        case 'unfocus': {
          opts.onExitFocus();
          break;
        }

        case 'reset_view': {
          opts.onResetView();
          break;
        }

        case 'error':
        default:
          break;
      }
    } catch (err) {
      console.error('Voice command dispatch error:', err);
    }
  }, []);

  // Resume listening after a command is processed (if session still active)
  const resumeListening = useCallback(() => {
    if (sessionActiveRef.current) {
      startRecognition();
    } else {
      setState('idle');
    }
  }, [startRecognition]);

  const processTranscript = useCallback(async (finalTranscript: string) => {
    setState('processing');
    setTranscript(finalTranscript);

    try {
      const model = getGenerativeModel(ai, {
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const prompt = buildUserPrompt(finalTranscript, optionsRef.current);

      const chat = model.startChat({
        history: conversationHistoryRef.current,
      });

      const result = await chat.sendMessage(prompt);
      const text = result.response.text();
      const command: VoiceCommand = JSON.parse(text);

      // Append this exchange to conversation history
      conversationHistoryRef.current.push(
        { role: 'user', parts: [{ text: prompt }] },
        { role: 'model', parts: [{ text }] },
      );
      if (conversationHistoryRef.current.length > MAX_HISTORY_TURNS) {
        conversationHistoryRef.current = conversationHistoryRef.current.slice(-MAX_HISTORY_TURNS);
      }

      // Dispatch the command
      await dispatchCommand(command);

      // Show confirmation toast
      const confirmation = command.confirmation || 'Done';
      setToastMessage(confirmation);

      if (command.action === 'error') {
        setErrorMessage(confirmation);
        setState('error');
        // Resume listening after a brief error display
        setTimeout(() => {
          setErrorMessage('');
          resumeListening();
        }, 2000);
        return;
      }

      // TTS confirmation, then resume listening
      setState('speaking');
      speak(confirmation, () => {
        resumeListening();
      });
    } catch (err) {
      console.error('Voice processing error:', err);
      const msg = 'Something went wrong. Please try again.';
      setToastMessage(msg);
      setErrorMessage(msg);
      setState('error');
      // Resume listening after error
      setTimeout(() => {
        setErrorMessage('');
        resumeListening();
      }, 2000);
    }
  }, [dispatchCommand, speak, resumeListening]);

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    conversationHistoryRef.current = [];
    setState('idle');
    setTranscript('');
    setErrorMessage('');
  }, []);

  const toggleListening = useCallback(() => {
    if (!SpeechRecognitionImpl) return;

    // If session is active in any state, stop it
    if (sessionActiveRef.current) {
      stopSession();
      return;
    }

    // Start a new session
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    sessionActiveRef.current = true;
    startRecognition();
  }, [startRecognition, stopSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      recognitionRef.current?.abort();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    state,
    transcript,
    toastMessage,
    errorMessage,
    isSupported,
    isSessionActive: sessionActiveRef.current,
    toggleListening,
  };
}
