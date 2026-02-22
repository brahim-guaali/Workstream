import { useState, useRef, useEffect } from 'react';
import { GitBranch, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function Header() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClose(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setMenuOpen(false);
      } else if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleClose);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleClose);
    };
  }, [menuOpen]);

  const initial = user?.displayName?.charAt(0) ?? user?.email?.charAt(0) ?? '?';

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

          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-stone-300 dark:border-stone-600 hover:border-brand-500 dark:hover:border-brand-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {user.photoURL && !imgError ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex items-center justify-center w-full h-full bg-brand-500 text-white text-sm font-semibold">
                    {initial.toUpperCase()}
                  </span>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-lg py-2">
                  <div className="px-4 py-3 flex items-center gap-3">
                    {user.photoURL && !imgError ? (
                      <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-500 text-white font-medium">
                        {initial.toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      {user.displayName && (
                        <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                          {user.displayName}
                        </p>
                      )}
                      {user.email && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-stone-200 dark:border-stone-700 my-1" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
