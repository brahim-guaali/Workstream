import { Layout } from '../components/layout/Layout';
import { ProjectList } from '../components/project/ProjectList';
import { SharedProjectList } from '../components/project/SharedProjectList';
import { useProjects } from '../hooks/useProjects';
import { useSharedProjects } from '../hooks/useSharedProjects';

export function HomePage() {
  const { projects, loading, createProject, deleteProject } = useProjects();
  const { sharedProjects, loading: sharedLoading } = useSharedProjects();

  const handleCreateProject = async (name: string, description: string) => {
    await createProject({
      name,
      description: description || null,
    });
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <ProjectList
          projects={projects}
          loading={loading}
          onCreateProject={handleCreateProject}
          onDeleteProject={deleteProject}
        />
        <SharedProjectList
          projects={sharedProjects}
          loading={sharedLoading}
        />
      </div>
    </Layout>
  );
}
