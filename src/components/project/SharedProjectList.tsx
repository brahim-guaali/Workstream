import { Link } from 'react-router-dom';
import { Users, Eye, Pencil } from 'lucide-react';
import type { SharedProjectRef } from '../../types/database';

interface SharedProjectListProps {
  projects: SharedProjectRef[];
  loading: boolean;
}

export function SharedProjectList({ projects, loading }: SharedProjectListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (projects.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-stone-400" />
          Shared with me
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/project/${project.owner_uid}/${project.project_id}`}
          >
            <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {project.project_name}
                  </h3>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    by {project.owner_display_name || project.owner_email}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
                  project.role === 'editor'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                }`}>
                  {project.role === 'editor' ? (
                    <Pencil className="w-3 h-3" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                  {project.role === 'editor' ? 'Editor' : 'Viewer'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
