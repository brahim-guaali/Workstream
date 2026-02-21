import { GitBranch } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <div className="h-full px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <GitBranch className="w-6 h-6 text-blue-600" />
          <span className="font-semibold text-lg">Workstream</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Projects
          </Link>
        </nav>
      </div>
    </header>
  );
}
