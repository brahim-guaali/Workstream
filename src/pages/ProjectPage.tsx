import { useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Download, Upload, Crosshair } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { StreamTree, type StreamTreeHandle } from '../components/visualization/StreamTree';
import { StreamDetail } from '../components/stream/StreamDetail';
import { AddStreamModal } from '../components/stream/AddStreamModal';
import { useStreams } from '../hooks/useStreams';
import { useEvents } from '../hooks/useEvents';
import { useProject } from '../hooks/useProjects';
import { statusHexColors, sourceTypeHexColors } from '../lib/utils';
import type { StreamWithChildren, SourceType, StreamStatus } from '../types/database';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project } = useProject(projectId);
  const { streams, streamTree, loading, createStream, updateStream, deleteStream, exportProject, importProject } = useStreams(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamTreeRef = useRef<StreamTreeHandle>(null);
  const [selectedStream, setSelectedStream] = useState<StreamWithChildren | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [branchFromStreamId, setBranchFromStreamId] = useState<string | null>(null);
  const [newSlicePosition, setNewSlicePosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingSlice, setPendingSlice] = useState<{ parentId: string; position: { x: number; y: number } } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const { events, loading: eventsLoading, createEvent } = useEvents(projectId, selectedStream?.id);

  // Compute stream statistics (count leaf nodes - streams with no children)
  const stats = useMemo(() => {
    const byStatus: Record<StreamStatus, number> = { active: 0, blocked: 0, done: 0 };
    const byType: Record<SourceType, number> = { task: 0, investigation: 0, meeting: 0, blocker: 0, discovery: 0 };

    // Find IDs of streams that are parents (have children)
    const parentIds = new Set(
      streams.filter((s) => s.parent_stream_id !== null).map((s) => s.parent_stream_id)
    );

    // Leaf nodes = streams that are not parents (no children)
    const leafNodes = streams.filter((s) => !parentIds.has(s.id));

    leafNodes.forEach((s) => {
      byStatus[s.status]++;
      byType[s.source_type]++;
    });

    return { total: leafNodes.length, byStatus, byType };
  }, [streams]);

  const handleRecenter = useCallback(() => {
    streamTreeRef.current?.resetView();
  }, []);

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

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.streams) {
        throw new Error('Invalid project file format');
      }

      await importProject(data);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsImporting(false);
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadExample = async () => {
    setIsImporting(true);
    try {
      // Clear existing streams first
      for (const stream of streams) {
        await deleteStream(stream.id);
      }
      const response = await fetch('/examples/api-migration.json');
      const data = await response.json();
      await importProject(data);
    } catch (err) {
      console.error('Failed to load example:', err);
      alert('Failed to load example: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsImporting(false);
    }
  };

  if (loading || isImporting) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          {isImporting && (
            <p className="text-sm text-stone-500 dark:text-stone-400">Importing streams...</p>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <Link
                to="/"
                className="flex-shrink-0 flex items-center gap-1 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>

              <div className="min-w-0 pl-4 border-l border-stone-200 dark:border-stone-700">
                <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 truncate">
                  {project?.name || 'Project'}
                </h1>
                {project?.description && (
                  <p className="text-sm text-stone-500 dark:text-stone-400 truncate">
                    {project.description}
                  </p>
                )}
              </div>

              {/* Stream Stats */}
              {streams.length > 0 && (
                <div className="flex items-center gap-3 pl-4 border-l border-stone-200 dark:border-stone-700">
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    {stats.total} stream{stats.total !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {(Object.entries(stats.byStatus) as [StreamStatus, number][])
                      .filter(([, count]) => count > 0)
                      .map(([status, count]) => (
                        <span
                          key={status}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${statusHexColors[status]}20`, color: statusHexColors[status] }}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: statusHexColors[status] }}
                          />
                          {count} {status}
                        </span>
                      ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {(Object.entries(stats.byType) as [SourceType, number][])
                      .filter(([, count]) => count > 0)
                      .map(([type, count]) => (
                        <span
                          key={type}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${sourceTypeHexColors[type]}20`, color: sourceTypeHexColors[type] }}
                        >
                          {count} {type}{count !== 1 ? 's' : ''}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {streams.length > 0 && (
                <Button variant="secondary" size="sm" onClick={handleRecenter} title="Recenter view">
                  <Crosshair className="w-4 h-4" />
                </Button>
              )}
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
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Visualization */}
          <div className="flex-1 overflow-hidden">
            {streams.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-stone-400" />
                </div>
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">
                  No streams yet
                </h3>
                <p className="text-stone-500 dark:text-stone-400 mb-4 max-w-sm">
                  Start by creating your first stream to track your project's evolution
                </p>
                <div className="flex items-center gap-3">
                  <Button onClick={handleOpenAddModal}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Stream
                  </Button>
                  <span className="text-stone-400">or</span>
                  <Button variant="secondary" onClick={handleLoadExample}>
                    <Download className="w-4 h-4 mr-2" />
                    Load Example
                  </Button>
                </div>
              </div>
            ) : (
              <StreamTree
                ref={streamTreeRef}
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
