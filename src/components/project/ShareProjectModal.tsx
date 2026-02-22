import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Copy, Check, Crown, ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { Project, ShareRole } from '../../types/database';
import { useProjectSharing } from '../../hooks/useProjectSharing';
import { useRegisteredUsers, type RegisteredUser } from '../../hooks/useRegisteredUsers';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export function ShareProjectModal({ isOpen, onClose, project }: ShareProjectModalProps) {
  const { addShare, removeShare, updateShareRole } = useProjectSharing(project);
  const sharedWith = project.shared_with || [];

  const excludeEmails = useMemo(
    () => [
      project.owner_email,
      ...sharedWith.map((s) => s.email),
    ],
    [project.owner_email, sharedWith]
  );

  const { users, loading: usersLoading } = useRegisteredUsers(excludeEmails);

  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [role, setRole] = useState<ShareRole>('viewer');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
    );
  }, [users, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: RegisteredUser) => {
    setSelectedUser(user);
    setSearch(user.displayName || user.email);
    setIsDropdownOpen(false);
  };

  const handleInputChange = (value: string) => {
    setSearch(value);
    setSelectedUser(null);
    setIsDropdownOpen(true);
  };

  const handleShare = async () => {
    if (!selectedUser) return;
    setError(null);
    setSuccess(null);
    setIsSharing(true);
    try {
      await addShare(selectedUser, role);
      setSuccess(`Shared with ${selectedUser.displayName || selectedUser.email}`);
      setSelectedUser(null);
      setSearch('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemove = async (shareEmail: string) => {
    try {
      await removeShare(shareEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  const handleRoleChange = async (shareEmail: string, newRole: ShareRole) => {
    try {
      await updateShareRole(shareEmail, newRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const shareUrl = `${window.location.origin}/project/${project.user_id}/${project.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share project" size="md">
      <div className="space-y-5">
        {/* User picker row */}
        <div className="flex gap-2">
          <div className="relative flex-1" ref={dropdownRef}>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder={usersLoading ? 'Loading users...' : 'Search users...'}
                disabled={usersLoading}
                className="w-full px-3 py-2 pr-8 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            </div>
            {isDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 shadow-lg">
                {filteredUsers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-stone-400">
                    {search.trim() ? 'No matching users' : 'No users available'}
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.uid}
                      onClick={() => handleSelectUser(u)}
                      className="w-full px-3 py-2 text-left hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                    >
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                        {u.displayName || u.email}
                      </p>
                      {u.displayName && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {u.email}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ShareRole)}
            className="px-2 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <Button size="sm" onClick={handleShare} disabled={!selectedUser || isSharing}>
            {isSharing ? 'Sharing...' : 'Share'}
          </Button>
        </div>

        {/* Messages */}
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
        )}

        {/* Divider */}
        <div className="border-t border-stone-200 dark:border-stone-700" />

        {/* People with access */}
        <div>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">
            People with access
          </h3>
          <div className="space-y-2">
            {/* Owner row */}
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 text-sm font-medium flex-shrink-0">
                <Crown className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                  {project.owner_email || 'You'}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                Owner
              </span>
            </div>

            {/* Shared users */}
            {sharedWith.map((share) => (
              <div key={share.email} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 text-sm font-medium flex-shrink-0">
                  {share.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 dark:text-stone-100 truncate">
                    {share.email}
                  </p>
                </div>
                <select
                  value={share.role}
                  onChange={(e) => handleRoleChange(share.email, e.target.value as ShareRole)}
                  className="px-2 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  onClick={() => handleRemove(share.email)}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-stone-200 dark:border-stone-700" />

        {/* Copy link */}
        <div>
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
            Project link
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400 focus:outline-none"
            />
            <Button size="sm" variant="secondary" onClick={handleCopyLink}>
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
