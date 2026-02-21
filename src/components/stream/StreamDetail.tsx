import { useState } from 'react';
import { X, Plus, Trash2, MessageSquare, GitBranch, Pencil, Check } from 'lucide-react';
import type { Stream, StreamEvent, StreamStatus, SourceType } from '../../types/database';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { formatDateTime, getRelativeTime } from '../../lib/utils';

interface StreamDetailProps {
  stream: Stream;
  events: StreamEvent[];
  eventsLoading: boolean;
  onClose: () => void;
  onUpdateStream: (updates: Partial<Stream>) => Promise<void>;
  onDeleteStream: () => Promise<void>;
  onAddEvent: (content: string) => Promise<void>;
  onBranch: () => void;
}

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

const sourceTypeOptions = [
  { value: 'task', label: 'Task' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'discovery', label: 'Discovery' },
];

export function StreamDetail({
  stream,
  events,
  eventsLoading,
  onClose,
  onUpdateStream,
  onDeleteStream,
  onAddEvent,
  onBranch,
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
    if (!confirm('Delete this slice and all its branches? This cannot be undone.')) return;
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
        return <span className="w-4 h-4 rounded-full bg-blue-500" />;
      default:
        return <span className="w-4 h-4 rounded-full bg-slate-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') handleCancelEditTitle();
                  }}
                  className="flex-1 px-2 py-1 text-lg font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {stream.title}
                </h2>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            )}
            {isEditingDate ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={editedDate}
                  onChange={(e) => setEditedDate(e.target.value)}
                  className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveDate}
                  className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 text-green-600"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEditDate}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 group">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Created {formatDateTime(stream.created_at)}
                </p>
                <button
                  onClick={() => setIsEditingDate(true)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status and Type */}
        <div className="grid grid-cols-2 gap-4">
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
        </div>

        {/* Description */}
        {stream.description && (
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Description
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {stream.description}
            </p>
          </div>
        )}

        {/* Actions */}
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

        {/* Add Note */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
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

        {/* Event History */}
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            History
          </h3>
          {eventsLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No history yet</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-3 text-sm"
                >
                  <div className="flex-shrink-0 mt-0.5 text-slate-400">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {event.content}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {getRelativeTime(event.created_at)}
                    </p>
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
