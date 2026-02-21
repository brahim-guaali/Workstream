import { useState } from 'react';
import { Plus, FolderOpen } from 'lucide-react';
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
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Projects</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
          <FolderOpen className="w-12 h-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            No projects yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-4">
            Create your first project to start tracking workstreams
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} to={`/project/${project.id}`}>
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
