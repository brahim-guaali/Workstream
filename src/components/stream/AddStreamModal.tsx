import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import type { SourceType, StreamWithChildren } from '../../types/database';
import { sourceTypeOptions } from '../../lib/streamConfig';

interface AddStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    description: string,
    sourceType: SourceType,
    parentStreamId: string | null
  ) => Promise<void>;
  streams: StreamWithChildren[];
  defaultParentId?: string | null;
}

export function AddStreamModal({
  isOpen,
  onClose,
  onSubmit,
  streams,
  defaultParentId = null,
}: AddStreamModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('task');
  const [parentStreamId, setParentStreamId] = useState<string | null>(defaultParentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync parentStreamId when defaultParentId changes (e.g., when branching)
  useEffect(() => {
    setParentStreamId(defaultParentId);
  }, [defaultParentId]);

  const flattenStreams = (
    tree: StreamWithChildren[],
    depth = 0
  ): { id: string; title: string; depth: number }[] => {
    const result: { id: string; title: string; depth: number }[] = [];
    tree.forEach((stream) => {
      result.push({ id: stream.id, title: stream.title, depth });
      result.push(...flattenStreams(stream.children, depth + 1));
    });
    return result;
  };

  const flatStreams = flattenStreams(streams);
  const parentOptions = [
    { value: '', label: 'No parent (root stream)' },
    ...flatStreams.map((s) => ({
      value: s.id,
      label: `${'  '.repeat(s.depth)}${s.title}`,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(
        title.trim(),
        description.trim(),
        sourceType,
        parentStreamId || null
      );
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to create stream. Check Firestore rules.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSourceType('task');
    setParentStreamId(defaultParentId);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Stream">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="stream-title"
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's this stream about?"
          autoFocus
        />
        <Textarea
          id="stream-description"
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add more context..."
          rows={3}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            id="source-type"
            label="Type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            options={sourceTypeOptions}
          />
          <Select
            id="parent-stream"
            label="Parent Stream"
            value={parentStreamId || ''}
            onChange={(e) => setParentStreamId(e.target.value || null)}
            options={parentOptions}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Stream'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
