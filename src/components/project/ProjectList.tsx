import { useState } from 'react';
import { Plus, FolderOpen, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Project } from '../../types/database';
import { Button } from '../ui/Button';
import { ProjectCard } from './ProjectCard';
import { CreateProjectModal } from './CreateProjectModal';

interface ProjectListProps {
  projects: Project[];
  loading: boolean;
  onCreateProject: (name: string, description: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
}

export function ProjectList({
  projects,
  loading,
  onCreateProject,
  onDeleteProject,
}: ProjectListProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">
            Projects
          </h1>
          {projects.length > 0 && (
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center mb-5">
            <FolderOpen className="w-8 h-8 text-brand-500" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-1">
            No projects yet
          </h3>
          <p className="text-stone-500 dark:text-stone-400 text-center mb-6 max-w-sm">
            Create your first project to start tracking workstreams and organizing your work.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((project) => (
            <Link key={project.id} to={`/project/${project.user_id}/${project.id}`}>
              <ProjectCard project={project} onDelete={onDeleteProject} />
            </Link>
          ))}
        </div>
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={onCreateProject}
      />
    </div>
  );
}
