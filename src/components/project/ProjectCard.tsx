import { Trash2, MoreVertical, GitBranch, Calendar } from 'lucide-react';
import type { Project } from '../../types/database';
import { formatDate, getRelativeTime } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => Promise<void>;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const streamsRef = collection(db, 'users', user.uid, 'projects', project.id, 'streams');
    const unsubscribe = onSnapshot(query(streamsRef), (snapshot) => {
      // Find parent IDs to identify leaf nodes (streams with no children)
      const parentIds = new Set(
        snapshot.docs
          .map((doc) => doc.data().parentStreamId as string | null)
          .filter(Boolean)
      );
      const leafDocs = snapshot.docs.filter((doc) => !parentIds.has(doc.id));
      setStreamCount(leafDocs.length);
      const counts: Record<string, number> = {};
      leafDocs.forEach((doc) => {
        const status = doc.data().status as string;
        counts[status] = (counts[status] || 0) + 1;
      });
      setStatusCounts(counts);
    });
    return unsubscribe;
  }, [user, project.id]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleting) return;

    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      setIsDeleting(true);
      try {
        await onDelete(project.id);
      } finally {
        setIsDeleting(false);
      }
    }
    setShowMenu(false);
  };

  const totalWithStatus = (statusCounts.active || 0) + (statusCounts.blocked || 0) + (statusCounts.done || 0);
  const donePercent = totalWithStatus > 0 ? Math.round(((statusCounts.done || 0) / totalWithStatus) * 100) : 0;

  return (
    <div className="relative group h-full flex flex-col p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 truncate text-base">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
              {project.description}
            </p>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4 text-stone-400" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-36 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl z-10">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Spacer to push stats/dates to bottom */}
      <div className="flex-1" />

      {/* Progress bar */}
      {totalWithStatus > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Progress</span>
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">{donePercent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden flex">
            {statusCounts.done > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(statusCounts.done / totalWithStatus) * 100}%` }}
              />
            )}
            {statusCounts.active > 0 && (
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(statusCounts.active / totalWithStatus) * 100}%` }}
              />
            )}
            {statusCounts.blocked > 0 && (
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${(statusCounts.blocked / totalWithStatus) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}

      {/* Stream stats */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-lg">
          <GitBranch className="w-3 h-3" />
          {streamCount} stream{streamCount !== 1 ? 's' : ''}
        </span>
        {statusCounts.active > 0 && (
          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {statusCounts.active} active
          </span>
        )}
        {statusCounts.blocked > 0 && (
          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            {statusCounts.blocked} blocked
          </span>
        )}
        {statusCounts.done > 0 && (
          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            {statusCounts.done} done
          </span>
        )}
      </div>

      {/* Metrics */}
      {project.metrics && project.metrics.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {project.metrics.slice(0, 3).map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
            >
              {m.name}: {m.value}{m.target != null ? `/${m.target}` : ''}
              {m.initialValue != null && m.initialValue !== 0 && m.value !== m.initialValue && (() => {
                const pct = Math.round(((m.value - m.initialValue) / Math.abs(m.initialValue)) * 100);
                return (
                  <span
                    className={`text-[10px] font-semibold ${
                      pct > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {pct > 0 ? '+' : ''}{pct}%
                  </span>
                );
              })()}
            </span>
          ))}
          {project.metrics.length > 3 && (
            <span className="text-xs text-stone-400 dark:text-stone-500">
              +{project.metrics.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Divider + Dates */}
      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(project.created_at)}
        </span>
        <span>Updated {getRelativeTime(project.updated_at)}</span>
      </div>
    </div>
  );
}
