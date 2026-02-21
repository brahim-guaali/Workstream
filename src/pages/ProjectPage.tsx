import { useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Download, Upload } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { StreamTree } from '../components/visualization/StreamTree';
import { StreamDetail } from '../components/stream/StreamDetail';
import { AddStreamModal } from '../components/stream/AddStreamModal';
import { useStreams } from '../hooks/useStreams';
import { useEvents } from '../hooks/useEvents';
import type { StreamWithChildren, SourceType } from '../types/database';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { streams, streamTree, loading, createStream, updateStream, deleteStream, exportProject, importProject } = useStreams(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedStream, setSelectedStream] = useState<StreamWithChildren | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [branchFromStreamId, setBranchFromStreamId] = useState<string | null>(null);
  const [newSlicePosition, setNewSlicePosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingSlice, setPendingSlice] = useState<{ parentId: string; position: { x: number; y: number } } | null>(null);

  const { events, loading: eventsLoading, createEvent } = useEvents(projectId, selectedStream?.id);

  const handleSelectStream = useCallback((stream: StreamWithChildren) => {
    setSelectedStream(stream);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedStream(null);
  }, []);

  const handleCreateStream = async (
    title: string,
    description: string,
    sourceType: SourceType,
    parentStreamId: string | null
  ) => {
    if (!projectId) return;
    const newStream = await createStream({
      project_id: projectId,
      parent_stream_id: parentStreamId,
      title,
      description: description || null,
      status: 'active',
      source_type: sourceType,
      branched_from_event_id: null,
    });

    // If we have a position from drag-and-drop, save it
    if (newSlicePosition && newStream) {
      await updateStream(newStream.id, {
        position_x: newSlicePosition.x,
        position_y: newSlicePosition.y,
      });
    }

    setBranchFromStreamId(null);
    setNewSlicePosition(null);
    setPendingSlice(null);
  };

  const handleUpdateStream = async (updates: Partial<StreamWithChildren>) => {
    if (!selectedStream) return;
    const updated = await updateStream(selectedStream.id, updates);
    setSelectedStream({ ...selectedStream, ...updated });
  };

  const handleDeleteStream = async () => {
    if (!selectedStream) return;
    await deleteStream(selectedStream.id);
    setSelectedStream(null);
  };

  const handleUpdateStreamPosition = useCallback(async (id: string, x: number, y: number) => {
    await updateStream(id, { position_x: x, position_y: y });
  }, [updateStream]);

  const handleAddEvent = async (content: string) => {
    if (!selectedStream) return;
    await createEvent({
      stream_id: selectedStream.id,
      type: 'note',
      content,
      metadata: null,
    });
  };

  const handleBranch = () => {
    if (!selectedStream) return;
    setBranchFromStreamId(selectedStream.id);
    setIsAddModalOpen(true);
  };

  const handleCreateChildSlice = useCallback((parentId: string, position: { x: number; y: number }) => {
    setBranchFromStreamId(parentId);
    setNewSlicePosition(position);
    setPendingSlice({ parentId, position });
    setIsAddModalOpen(true);
  }, []);

  const handleOpenAddModal = () => {
    setBranchFromStreamId(null);
    setIsAddModalOpen(true);
  };

  const handleExport = async () => {
    try {
      const data = await exportProject();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export project');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.streams) {
        throw new Error('Invalid project file format');
      }

      await importProject(data);
      alert('Project imported successfully');
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Link
            to="/"
            className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />
              Import
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button onClick={handleOpenAddModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Stream
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Visualization */}
          <div className="flex-1 overflow-hidden">
            {streams.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No streams yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
                  Start by creating your first stream to track your project's evolution
                </p>
                <Button onClick={handleOpenAddModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Stream
                </Button>
              </div>
            ) : (
              <StreamTree
                streamTree={streamTree}
                selectedStreamId={selectedStream?.id || null}
                onSelectStream={handleSelectStream}
                onUpdateStreamPosition={handleUpdateStreamPosition}
                onCreateChildSlice={handleCreateChildSlice}
                pendingSlice={pendingSlice}
              />
            )}
          </div>

          {/* Detail sidebar */}
          {selectedStream && (
            <div className="w-96 flex-shrink-0">
              <StreamDetail
                stream={selectedStream}
                events={events}
                eventsLoading={eventsLoading}
                onClose={handleCloseDetail}
                onUpdateStream={handleUpdateStream}
                onDeleteStream={handleDeleteStream}
                onAddEvent={handleAddEvent}
                onBranch={handleBranch}
              />
            </div>
          )}
        </div>
      </div>

      <AddStreamModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setBranchFromStreamId(null);
          setNewSlicePosition(null);
          setPendingSlice(null);
        }}
        onSubmit={handleCreateStream}
        streams={streamTree}
        defaultParentId={branchFromStreamId}
      />
    </Layout>
  );
}
