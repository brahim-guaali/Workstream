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
      setStreamCount(snapshot.size);
      const counts: Record<string, number> = {};
      snapshot.docs.forEach((doc) => {
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

  return (
    <div className="relative group p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 truncate">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4 text-stone-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-36 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg z-10">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stream stats */}
      <div className="mt-3 flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
          <GitBranch className="w-3.5 h-3.5" />
          {streamCount} stream{streamCount !== 1 ? 's' : ''}
        </span>
        {statusCounts.active > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {statusCounts.active} active
          </span>
        )}
        {statusCounts.blocked > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            {statusCounts.blocked} blocked
          </span>
        )}
        {statusCounts.done > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            {statusCounts.done} done
          </span>
        )}
      </div>

      {/* Dates */}
      <div className="mt-2 flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Created {formatDate(project.created_at)}
        </span>
        <span>Updated {getRelativeTime(project.updated_at)}</span>
      </div>
    </div>
  );
}
