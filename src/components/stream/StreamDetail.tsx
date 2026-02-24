import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { X, Plus, Trash2, MessageSquare, GitBranch, Pencil, Check, Tag, Focus, Eye } from 'lucide-react';
import type { Stream, StreamEvent, StreamStatus, SourceType } from '../../types/database';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { formatDate, formatDateTime, getRelativeTime } from '../../lib/utils';
import { statusOptions, sourceTypeOptions, STATUS_CONFIG, SOURCE_TYPE_CONFIG, EMOJI_TAG_OPTIONS, MAX_EMOJI_TAGS } from '../../lib/streamConfig';

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

function linkify(text: string): ReactNode {
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300 break-all"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

interface StreamDetailProps {
  stream: Stream;
  events: StreamEvent[];
  eventsLoading: boolean;
  onClose: () => void;
  onUpdateStream: (updates: Partial<Stream>) => Promise<void>;
  onDeleteStream: () => Promise<void>;
  onAddEvent: (content: string) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onBranch: () => void;
  isFocused?: boolean;
  onFocusStream?: () => void;
  onExitFocus?: () => void;
  isReadOnly?: boolean;
}

export function StreamDetail({
  stream,
  events,
  eventsLoading,
  onClose,
  onUpdateStream,
  onDeleteStream,
  onAddEvent,
  onDeleteEvent,
  onBranch,
  isFocused,
  onFocusStream,
  onExitFocus,
  isReadOnly,
}: StreamDetailProps) {
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(stream.title);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editedDate, setEditedDate] = useState(
    new Date(stream.created_at).toISOString().slice(0, 16)
  );
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [editedDueDate, setEditedDueDate] = useState(
    stream.due_date ? new Date(stream.due_date).toISOString().slice(0, 10) : ''
  );
  const [newDependency, setNewDependency] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(stream.description || '');

  const handleStatusChange = async (status: StreamStatus) => {
    await onUpdateStream({ status });
  };

  const handleSourceTypeChange = async (sourceType: SourceType) => {
    await onUpdateStream({ source_type: sourceType });
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) return;
    await onUpdateStream({ title: editedTitle.trim() });
    setIsEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setEditedTitle(stream.title);
    setIsEditingTitle(false);
  };

  const handleSaveDate = async () => {
    const newDate = new Date(editedDate).toISOString();
    await onUpdateStream({ created_at: newDate });
    setIsEditingDate(false);
  };

  const handleCancelEditDate = () => {
    setEditedDate(new Date(stream.created_at).toISOString().slice(0, 16));
    setIsEditingDate(false);
  };

  const handleSaveDescription = async () => {
    await onUpdateStream({ description: editedDescription.trim() || null });
    setIsEditingDescription(false);
  };

  const handleCancelEditDescription = () => {
    setEditedDescription(stream.description || '');
    setIsEditingDescription(false);
  };

  const handleSaveDueDate = async () => {
    const newDueDate = editedDueDate ? new Date(editedDueDate).toISOString() : null;
    await onUpdateStream({ due_date: newDueDate });
    setIsEditingDueDate(false);
  };

  const handleCancelEditDueDate = () => {
    setEditedDueDate(stream.due_date ? new Date(stream.due_date).toISOString().slice(0, 10) : '');
    setIsEditingDueDate(false);
  };

  const handleClearDueDate = async () => {
    await onUpdateStream({ due_date: null });
    setEditedDueDate('');
    setIsEditingDueDate(false);
  };

  const handleAddDependency = async () => {
    const tag = newDependency.trim();
    if (!tag) return;
    if (stream.dependencies.includes(tag)) {
      setNewDependency('');
      return;
    }
    await onUpdateStream({ dependencies: [...stream.dependencies, tag] });
    setNewDependency('');
  };

  const handleRemoveDependency = async (tag: string) => {
    await onUpdateStream({ dependencies: stream.dependencies.filter((d) => d !== tag) });
  };

  const handleDependencyKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDependency();
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    try {
      await onAddEvent(newNote.trim());
      setNewNote('');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this stream and all its branches? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await onDeleteStream();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'note':
        return <MessageSquare className="w-4 h-4" />;
      case 'status_change':
        return <span className="w-4 h-4 rounded-full bg-brand-500" />;
      default:
        return <span className="w-4 h-4 rounded-full bg-stone-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditingTitle && !isReadOnly ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') handleCancelEditTitle();
                  }}
                  className="flex-1 px-2 py-1 text-lg font-semibold bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 text-green-600"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCancelEditTitle}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 truncate">
                  {stream.title}
                </h2>
                {!isReadOnly && (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="w-4 h-4 text-stone-400" />
                  </button>
                )}
              </div>
            )}
            {isEditingDate && !isReadOnly ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={editedDate}
                  onChange={(e) => setEditedDate(e.target.value)}
                  className="px-2 py-1 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={handleSaveDate}
                  className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 text-green-600"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEditDate}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 group">
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Created {formatDateTime(stream.created_at)}
                </p>
                {!isReadOnly && (
                  <button
                    onClick={() => setIsEditingDate(true)}
                    className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="w-3 h-3 text-stone-400" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isReadOnly && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-md mr-1">
                <Eye className="w-3 h-3" />
                View only
              </span>
            )}
            {onFocusStream && !isFocused && (
              <button
                onClick={onFocusStream}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                data-tooltip="Focus on this stream"
                data-tooltip-placement="bottom"
              >
                <Focus className="w-5 h-5 text-stone-500" />
              </button>
            )}
            {isFocused && onExitFocus && (
              <button
                onClick={onExitFocus}
                className="p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                data-tooltip="Exit focus"
                data-tooltip-placement="bottom"
              >
                <Focus className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status and Type */}
        <div className="grid grid-cols-2 gap-4">
          {isReadOnly ? (
            <>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Status</label>
                <span className={`inline-flex items-center text-sm font-medium px-2.5 py-1 rounded-lg ${
                  stream.status === 'done' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  stream.status === 'blocked' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {STATUS_CONFIG[stream.status]?.label || stream.status}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Type</label>
                <span className="inline-flex items-center text-sm font-medium px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                  {SOURCE_TYPE_CONFIG[stream.source_type]?.label || stream.source_type}
                </span>
              </div>
            </>
          ) : (
            <>
              <Select
                id="stream-status"
                label="Status"
                value={stream.status}
                onChange={(e) => handleStatusChange(e.target.value as StreamStatus)}
                options={statusOptions}
              />
              <Select
                id="stream-source-type"
                label="Type"
                value={stream.source_type}
                onChange={(e) => handleSourceTypeChange(e.target.value as SourceType)}
                options={sourceTypeOptions}
              />
            </>
          )}
        </div>

        {/* Description */}
        <div>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2 flex items-center gap-2">
            Description
            {!isReadOnly && !isEditingDescription && (
              <button
                onClick={() => {
                  setEditedDescription(stream.description || '');
                  setIsEditingDescription(true);
                }}
                className="p-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="w-3 h-3 text-stone-400" />
              </button>
            )}
          </h3>
          {isEditingDescription && !isReadOnly ? (
            <div className="space-y-2">
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEditDescription();
                }}
                placeholder="Add a description..."
                rows={3}
                autoFocus
                className="w-full px-3 py-2 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDescription}
                  className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 text-green-600"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEditDescription}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : stream.description ? (
            <p
              className={`text-sm text-stone-600 dark:text-stone-400 whitespace-pre-wrap ${!isReadOnly ? 'cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50' : ''} rounded-md px-2 py-1 -mx-2 -my-1 transition-colors`}
              onClick={() => {
                if (isReadOnly) return;
                setEditedDescription(stream.description || '');
                setIsEditingDescription(true);
              }}
            >
              {stream.description}
            </p>
          ) : isReadOnly ? (
            <p className="text-sm text-stone-400 dark:text-stone-500">No description</p>
          ) : (
            <button
              onClick={() => {
                setEditedDescription('');
                setIsEditingDescription(true);
              }}
              className="text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              + Add description
            </button>
          )}
        </div>

        {/* Due Date */}
        <div>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            Due Date
          </h3>
          {isEditingDueDate && !isReadOnly ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={editedDueDate}
                onChange={(e) => setEditedDueDate(e.target.value)}
                className="px-2 py-1 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                autoFocus
              />
              <button
                onClick={handleSaveDueDate}
                className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 text-green-600"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEditDueDate}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
              {stream.due_date && (
                <button
                  onClick={handleClearDueDate}
                  className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          ) : stream.due_date ? (
            <div className="flex items-center gap-2 group">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {formatDate(stream.due_date)}
              </p>
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setEditedDueDate(stream.due_date ? new Date(stream.due_date).toISOString().slice(0, 10) : '');
                    setIsEditingDueDate(true);
                  }}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="w-3 h-3 text-stone-400" />
                </button>
              )}
            </div>
          ) : isReadOnly ? (
            <p className="text-sm text-stone-400 dark:text-stone-500">No due date</p>
          ) : (
            <button
              onClick={() => {
                setEditedDueDate('');
                setIsEditingDueDate(true);
              }}
              className="text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              + Add due date
            </button>
          )}
        </div>

        {/* Dependencies */}
        <div>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            <Tag className="w-4 h-4 inline-block mr-1 -mt-0.5" />
            Dependencies
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {stream.dependencies.length === 0 && (
              <p className="text-sm text-stone-400 dark:text-stone-500">No dependencies</p>
            )}
            {stream.dependencies.map((dep) => (
              <span
                key={dep}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200"
              >
                {dep}
                {!isReadOnly && (
                  <button
                    onClick={() => handleRemoveDependency(dep)}
                    className="ml-0.5 hover:text-stone-900 dark:hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {!isReadOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newDependency}
                onChange={(e) => setNewDependency(e.target.value)}
                onKeyDown={handleDependencyKeyDown}
                placeholder="e.g. Team Backend, QA..."
                className="flex-1 px-3 py-1.5 text-sm bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button size="sm" variant="secondary" onClick={handleAddDependency} disabled={!newDependency.trim()}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onBranch}>
              <GitBranch className="w-4 h-4 mr-1" />
              Branch
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        )}

        {/* Emoji Tags */}
        <div>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            Emoji Tags
          </h3>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {EMOJI_TAG_OPTIONS.map(({ emoji, label }) => {
              const active = (stream.emojis ?? []).includes(emoji);
              const atMax = (stream.emojis ?? []).length >= MAX_EMOJI_TAGS && !active;
              return (
                <button
                  key={emoji}
                  disabled={isReadOnly || atMax}
                  onClick={() => {
                    const current = stream.emojis ?? [];
                    const next = active
                      ? current.filter((e) => e !== emoji)
                      : [...current, emoji];
                    onUpdateStream({ emojis: next });
                  }}
                  className={`text-lg w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors ${
                    active
                      ? 'ring-1.5 ring-brand-500 bg-brand-50 dark:bg-brand-900/30'
                      : atMax
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                  data-tooltip={label}
                  data-tooltip-placement="top"
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Note */}
        {!isReadOnly && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Add Note
            </h3>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write an update..."
              rows={2}
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || isAddingNote}
            >
              <Plus className="w-4 h-4 mr-1" />
              {isAddingNote ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        )}

        {/* Event History */}
        <div>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
            History
          </h3>
          {eventsLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">No history yet</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-3 text-sm group/event"
                >
                  <div className="flex-shrink-0 mt-0.5 text-stone-400">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                      {linkify(event.content)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-xs text-stone-400">
                        {getRelativeTime(event.created_at)}
                      </p>
                      {!isReadOnly && (
                        <button
                          onClick={() => onDeleteEvent(event.id)}
                          className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 opacity-0 group-hover/event:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
