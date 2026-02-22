import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Download, Upload, Crosshair, Pencil, X, Check, BarChart3, ChevronDown, FileText, FileDown, FileJson } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { StreamTree, type StreamTreeHandle } from '../components/visualization/StreamTree';
import { StreamDetail } from '../components/stream/StreamDetail';
import { AddStreamModal } from '../components/stream/AddStreamModal';
import { useStreams } from '../hooks/useStreams';
import { useEvents } from '../hooks/useEvents';
import { useProject } from '../hooks/useProjects';
import { statusHexColors, sourceTypeHexColors, buildFocusedTree } from '../lib/utils';
import { generateMarkdown, generatePrintHTML } from '../lib/exportDocument';
import type { ExportData } from '../lib/exportDocument';
import type { StreamWithChildren, SourceType, StreamStatus, ProjectMetric } from '../types/database';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, updateProject } = useProject(projectId);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { streams, streamTree, loading, createStream, updateStream, deleteStream, exportProject, importProject } = useStreams(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamTreeRef = useRef<StreamTreeHandle>(null);
  const [selectedStream, setSelectedStream] = useState<StreamWithChildren | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [branchFromStreamId, setBranchFromStreamId] = useState<string | null>(null);
  const [newSlicePosition, setNewSlicePosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingSlice, setPendingSlice] = useState<{ parentId: string; position: { x: number; y: number } } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAddingMetric, setIsAddingMetric] = useState(false);
  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricValue, setNewMetricValue] = useState('');
  const [newMetricTarget, setNewMetricTarget] = useState('');
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [editMetricName, setEditMetricName] = useState('');
  const [editMetricValue, setEditMetricValue] = useState('');
  const [editMetricTarget, setEditMetricTarget] = useState('');
  const [metricsPromptOpen, setMetricsPromptOpen] = useState(false);
  const [metricsPromptStreamName, setMetricsPromptStreamName] = useState('');
  const [promptMetrics, setPromptMetrics] = useState<ProjectMetric[]>([]);
  const [promptNewName, setPromptNewName] = useState('');
  const [promptNewValue, setPromptNewValue] = useState('');
  const [promptNewTarget, setPromptNewTarget] = useState('');
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);

  const { events, loading: eventsLoading, createEvent, deleteEvent } = useEvents(projectId, selectedStream?.id);

  // Compute display tree for focus mode
  const displayTree = useMemo(
    () => focusedStreamId ? buildFocusedTree(streamTree, focusedStreamId) : streamTree,
    [streamTree, focusedStreamId]
  );

  // Clear focus if focused stream is deleted
  useEffect(() => {
    if (!focusedStreamId) return;
    const exists = streams.some(s => s.id === focusedStreamId);
    if (!exists) setFocusedStreamId(null);
  }, [streams, focusedStreamId]);

  // Clear selection if selected stream got collapsed
  useEffect(() => {
    if (!selectedStream || !focusedStreamId) return;
    const isCollapsed = (nodes: StreamWithChildren[]): boolean => {
      for (const node of nodes) {
        if (node._collapsed && node._collapsed.originalIds.includes(selectedStream.id)) return true;
        if (isCollapsed(node.children)) return true;
      }
      return false;
    };
    if (isCollapsed(displayTree)) setSelectedStream(null);
  }, [displayTree, selectedStream, focusedStreamId]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportDropdownOpen]);

  // Compute stream statistics (count leaf nodes - streams with no children)
  const stats = useMemo(() => {
    const byStatus: Record<StreamStatus, number> = { backlog: 0, active: 0, blocked: 0, done: 0 };
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

    // When a stream is marked done, prompt user to update metrics
    if (updates.status === 'done' && selectedStream.status !== 'done') {
      setMetricsPromptStreamName(selectedStream.title);
      setPromptMetrics((project?.metrics ?? []).map((m) => ({ ...m })));
      setMetricsPromptOpen(true);
    }
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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = async () => {
    setExportDropdownOpen(false);
    try {
      const data = await exportProject();
      const exportPayload = { ...data, metrics: project?.metrics ?? [] };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `project-export-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export project');
    }
  };

  const handleExportMarkdown = async () => {
    setExportDropdownOpen(false);
    if (!project) return;
    try {
      const data = await exportProject() as ExportData;
      const md = generateMarkdown(project, data);
      const blob = new Blob([md], { type: 'text/markdown' });
      downloadBlob(blob, `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-export.md`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export project');
    }
  };

  const handleExportPDF = async () => {
    setExportDropdownOpen(false);
    if (!project) return;
    try {
      const data = await exportProject() as ExportData;
      const html = generatePrintHTML(project, data);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to export as PDF');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
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

      // Restore metrics if present in the import file
      if (Array.isArray(data.metrics) && data.metrics.length > 0) {
        await updateProject({ metrics: data.metrics });
      }
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

  const handleAddMetric = () => {
    if (!newMetricName.trim() || !newMetricValue.trim()) return;
    const metrics = [...(project?.metrics ?? [])];
    const val = Number(newMetricValue);
    const metric: ProjectMetric = {
      id: crypto.randomUUID(),
      name: newMetricName.trim(),
      value: val,
      initialValue: val,
      ...(newMetricTarget.trim() ? { target: Number(newMetricTarget) } : {}),
    };
    metrics.push(metric);
    updateProject({ metrics });
    setNewMetricName('');
    setNewMetricValue('');
    setNewMetricTarget('');
    setIsAddingMetric(false);
  };

  const handleUpdateMetric = (id: string) => {
    if (!editMetricName.trim() || !editMetricValue.trim()) return;
    const metrics = (project?.metrics ?? []).map((m) =>
      m.id === id
        ? {
            ...m,
            name: editMetricName.trim(),
            value: Number(editMetricValue),
            ...(editMetricTarget.trim() ? { target: Number(editMetricTarget) } : { target: undefined }),
          }
        : m
    );
    updateProject({ metrics });
    setEditingMetricId(null);
  };

  const handleRemoveMetric = (id: string) => {
    const metrics = (project?.metrics ?? []).filter((m) => m.id !== id);
    updateProject({ metrics });
  };

  const handlePromptSave = () => {
    updateProject({ metrics: promptMetrics });
    setMetricsPromptOpen(false);
  };

  const handlePromptAddMetric = () => {
    if (!promptNewName.trim() || !promptNewValue.trim()) return;
    const val = Number(promptNewValue);
    setPromptMetrics((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: promptNewName.trim(),
        value: val,
        initialValue: val,
        ...(promptNewTarget.trim() ? { target: Number(promptNewTarget) } : {}),
      },
    ]);
    setPromptNewName('');
    setPromptNewValue('');
    setPromptNewTarget('');
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
        <div className="flex-shrink-0 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          {/* Top row: nav + title + actions */}
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/"
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2 group min-w-0">
                <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
                  {project?.name || 'Project'}
                </h1>
                <button
                  onClick={() => {
                    setEditName(project?.name || '');
                    setEditDescription(project?.description || '');
                    setIsEditingProject(true);
                  }}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="w-4 h-4 text-stone-400" />
                </button>
              </div>
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
              <div className="relative" ref={exportDropdownRef}>
                <Button variant="secondary" size="sm" onClick={() => setExportDropdownOpen(!exportDropdownOpen)}>
                  <Download className="w-4 h-4 mr-1" />
                  Export
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
                {exportDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={handleExportJSON}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                    >
                      <FileJson className="w-4 h-4 text-stone-400" />
                      JSON (Data)
                    </button>
                    <button
                      onClick={handleExportMarkdown}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-stone-400" />
                      Markdown
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                    >
                      <FileDown className="w-4 h-4 text-stone-400" />
                      PDF (Print)
                    </button>
                  </div>
                )}
              </div>
              <Button onClick={handleOpenAddModal}>
                <Plus className="w-4 h-4 mr-2" />
                Add Stream
              </Button>
            </div>
          </div>

          {/* Bottom row: description + stats */}
          {(project?.description || streams.length > 0) && (
            <div className="px-4 pb-2.5 flex flex-wrap items-start gap-4 text-sm">
              {project?.description && (
                <p className="text-stone-500 dark:text-stone-400">
                  {project.description}
                </p>
              )}
              {streams.length > 0 && (
                <div className="flex items-center gap-3 ml-auto">
                  <span className="font-medium text-stone-700 dark:text-stone-300">
                    {stats.total} stream{stats.total !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(Object.entries(stats.byStatus) as [StreamStatus, number][])
                      .filter(([, count]) => count > 0)
                      .map(([status, count]) => (
                        <span
                          key={status}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${statusHexColors[status]}20`, color: statusHexColors[status] }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: statusHexColors[status] }}
                          />
                          {count} {status}
                        </span>
                      ))}
                  </div>
                  <div className="flex items-center gap-1.5">
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
          )}

          {/* Metrics row */}
          <div className="px-4 pb-2.5 flex flex-wrap items-center gap-2 text-sm">
            {(project?.metrics ?? []).map((m) =>
              editingMetricId === m.id ? (
                <div key={m.id} className="flex items-center gap-1.5">
                  <input
                    className="w-24 px-2 py-1 text-xs rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    value={editMetricName}
                    onChange={(e) => setEditMetricName(e.target.value)}
                    placeholder="Name"
                    autoFocus
                  />
                  <input
                    type="number"
                    className="w-16 px-2 py-1 text-xs rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    value={editMetricValue}
                    onChange={(e) => setEditMetricValue(e.target.value)}
                    placeholder="Value"
                  />
                  <input
                    type="number"
                    className="w-16 px-2 py-1 text-xs rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    value={editMetricTarget}
                    onChange={(e) => setEditMetricTarget(e.target.value)}
                    placeholder="Target"
                  />
                  <button
                    onClick={() => handleUpdateMetric(m.id)}
                    className="p-1 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-cyan-600"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingMetricId(null)}
                    className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 cursor-pointer hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors group/metric"
                  onClick={() => {
                    setEditingMetricId(m.id);
                    setEditMetricName(m.name);
                    setEditMetricValue(String(m.value));
                    setEditMetricTarget(m.target != null ? String(m.target) : '');
                  }}
                >
                  {m.name}: {m.value}{m.target != null ? ` / ${m.target}` : ''}
                  {m.initialValue != null && m.initialValue !== 0 && m.value !== m.initialValue && (() => {
                    const pct = Math.round(((m.value - m.initialValue) / Math.abs(m.initialValue)) * 100);
                    return (
                      <span
                        className={`ml-0.5 text-[10px] font-semibold ${
                          pct > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-500 dark:text-red-400'
                        }`}
                      >
                        {pct > 0 ? '+' : ''}{pct}%
                      </span>
                    );
                  })()}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMetric(m.id);
                    }}
                    className="ml-0.5 p-0.5 rounded hover:bg-cyan-200 dark:hover:bg-cyan-800 opacity-0 group-hover/metric:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            )}

            {isAddingMetric ? (
              <div className="flex items-center gap-1.5">
                <input
                  className="w-24 px-2 py-1 text-xs rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  placeholder="Name"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMetric()}
                />
                <input
                  type="number"
                  className="w-16 px-2 py-1 text-xs rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={newMetricValue}
                  onChange={(e) => setNewMetricValue(e.target.value)}
                  placeholder="Value"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMetric()}
                />
                <input
                  type="number"
                  className="w-16 px-2 py-1 text-xs rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={newMetricTarget}
                  onChange={(e) => setNewMetricTarget(e.target.value)}
                  placeholder="Target"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMetric()}
                />
                <button
                  onClick={handleAddMetric}
                  disabled={!newMetricName.trim() || !newMetricValue.trim()}
                  className="p-1 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-cyan-600 disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setIsAddingMetric(false);
                    setNewMetricName('');
                    setNewMetricValue('');
                    setNewMetricTarget('');
                  }}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingMetric(true)}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-dashed border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
              >
                <BarChart3 className="w-3 h-3" />
                Add Metric
              </button>
            )}
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
                <Button onClick={handleOpenAddModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Stream
                </Button>
              </div>
            ) : (
              <StreamTree
                ref={streamTreeRef}
                streamTree={displayTree}
                selectedStreamId={selectedStream?.id || null}
                onSelectStream={handleSelectStream}
                onUpdateStreamPosition={handleUpdateStreamPosition}
                onCreateChildSlice={handleCreateChildSlice}
                pendingSlice={pendingSlice}
                focusedStreamId={focusedStreamId}
                onFocusStream={setFocusedStreamId}
                onExitFocus={() => setFocusedStreamId(null)}
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
                onDeleteEvent={deleteEvent}
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

      {/* Update Metrics Prompt (shown when a stream is marked done) */}
      <Modal
        isOpen={metricsPromptOpen}
        onClose={() => setMetricsPromptOpen(false)}
        title="Update Metrics"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            <span className="font-medium text-stone-700 dark:text-stone-300">{metricsPromptStreamName}</span> is done. Would you like to update project metrics?
          </p>

          {promptMetrics.length > 0 && (
            <div className="space-y-2">
              {promptMetrics.map((m, idx) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300 w-28 truncate" title={m.name}>
                    {m.name}
                  </span>
                  <input
                    type="number"
                    className="w-20 px-2 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    value={m.value}
                    onChange={(e) => {
                      setPromptMetrics((prev) =>
                        prev.map((pm, i) => (i === idx ? { ...pm, value: Number(e.target.value) } : pm))
                      );
                    }}
                  />
                  {m.target != null && (
                    <span className="text-sm text-stone-400">/ {m.target}</span>
                  )}
                  <button
                    onClick={() => setPromptMetrics((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              className="w-28 px-2 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={promptNewName}
              onChange={(e) => setPromptNewName(e.target.value)}
              placeholder="Name"
              onKeyDown={(e) => e.key === 'Enter' && handlePromptAddMetric()}
            />
            <input
              type="number"
              className="w-20 px-2 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={promptNewValue}
              onChange={(e) => setPromptNewValue(e.target.value)}
              placeholder="Value"
              onKeyDown={(e) => e.key === 'Enter' && handlePromptAddMetric()}
            />
            <input
              type="number"
              className="w-20 px-2 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={promptNewTarget}
              onChange={(e) => setPromptNewTarget(e.target.value)}
              placeholder="Target"
              onKeyDown={(e) => e.key === 'Enter' && handlePromptAddMetric()}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePromptAddMetric}
              disabled={!promptNewName.trim() || !promptNewValue.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setMetricsPromptOpen(false)}>
              Skip
            </Button>
            <Button onClick={handlePromptSave}>
              Save Metrics
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Project Modal */}
      <Modal isOpen={isEditingProject} onClose={() => setIsEditingProject(false)} title="Edit Project">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editName.trim()) return;
            updateProject({ name: editName.trim(), description: editDescription.trim() || null });
            setIsEditingProject(false);
          }}
          className="space-y-4"
        >
          <Input
            id="edit-project-name"
            label="Project Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Enter project name"
            autoFocus
          />
          <Textarea
            id="edit-project-description"
            label="Description (optional)"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="What is this project about?"
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsEditingProject(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!editName.trim()}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
