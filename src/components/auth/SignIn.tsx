import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';

export function SignIn() {
  const { signIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-stone-900 rounded-lg shadow-lg p-8 text-center">
          {import.meta.env.VITE_LOGO_URL && (
            <img src={import.meta.env.VITE_LOGO_URL} alt="" className="h-12 mx-auto mb-6" />
          )}
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            Workstream
          </h1>
          <p className="text-stone-600 dark:text-stone-400 mb-8">
            Track your project's evolution with streams
          </p>
          <Button onClick={signIn} className="w-full">
            Sign in with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
