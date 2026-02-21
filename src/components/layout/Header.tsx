import { GitBranch } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm">
      <div className="h-full px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-stone-900 dark:text-stone-100">
          <GitBranch className="w-6 h-6 text-brand-500" />
          <span className="font-semibold text-lg">Workstream</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            Projects
          </Link>
        </nav>
      </div>
    </header>
  );
}
