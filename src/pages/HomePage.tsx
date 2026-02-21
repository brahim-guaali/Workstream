import { Layout } from '../components/layout/Layout';
import { ProjectList } from '../components/project/ProjectList';
import { useProjects } from '../hooks/useProjects';

export function HomePage() {
  const { projects, loading, createProject, deleteProject } = useProjects();

  const handleCreateProject = async (name: string, description: string) => {
    await createProject({
      name,
      description: description || null,
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <ProjectList
          projects={projects}
          loading={loading}
          onCreateProject={handleCreateProject}
          onDeleteProject={deleteProject}
        />
      </div>
    </Layout>
  );
}
