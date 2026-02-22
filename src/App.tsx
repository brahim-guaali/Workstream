import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SignIn } from './components/auth/SignIn';
import { HomePage } from './pages/HomePage';
import { ProjectPage } from './pages/ProjectPage';

function LegacyProjectRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  if (!user || !projectId) return null;
  return <Navigate to={`/project/${user.uid}/${projectId}`} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/project/:ownerId/:projectId" element={<ProjectPage />} />
      <Route path="/project/:projectId" element={<LegacyProjectRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
