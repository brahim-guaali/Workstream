import { useCallback } from 'react';
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Project, ProjectShare, ShareRole } from '../types/database';

export function useProjectSharing(project: Project | null) {
  const { user } = useAuth();

  const addShare = useCallback(
    async (
      targetUser: { email: string; uid: string; displayName: string },
      role: ShareRole
    ) => {
      if (!user || !project) throw new Error('Not authenticated');
      if (targetUser.email === user.email) throw new Error('Cannot share with yourself');

      const existing = project.shared_with || [];
      if (existing.some((s) => s.email === targetUser.email)) {
        throw new Error('Already shared with this user');
      }

      const newShare: ProjectShare = {
        email: targetUser.email,
        uid: targetUser.uid,
        role,
        added_at: new Date().toISOString(),
      };

      const updatedSharedWith = [...existing, newShare];
      const sharedWithUids = updatedSharedWith
        .map((s) => s.uid)
        .filter((uid): uid is string => uid !== null);
      const sharedWithEditorUids = updatedSharedWith
        .filter((s) => s.role === 'editor' && s.uid)
        .map((s) => s.uid as string);

      const projectRef = doc(db, 'users', user.uid, 'projects', project.id);
      await updateDoc(projectRef, {
        sharedWith: updatedSharedWith,
        sharedWithUids,
        sharedWithEditorUids,
        updatedAt: serverTimestamp(),
      });

      // Create shared_projects index document
      const indexId = `${user.uid}_${project.id}_${targetUser.uid}`;
      await setDoc(doc(db, 'shared_projects', indexId), {
        owner_uid: user.uid,
        owner_email: user.email,
        owner_display_name: user.displayName || '',
        project_id: project.id,
        project_name: project.name,
        role,
        shared_with_uid: targetUser.uid,
        updatedAt: serverTimestamp(),
      });
    },
    [user, project]
  );

  const removeShare = useCallback(
    async (email: string) => {
      if (!user || !project) throw new Error('Not authenticated');

      const existing = project.shared_with || [];
      const shareToRemove = existing.find((s) => s.email === email);
      if (!shareToRemove) return;

      const updatedSharedWith = existing.filter((s) => s.email !== email);
      const sharedWithUids = updatedSharedWith
        .map((s) => s.uid)
        .filter((uid): uid is string => uid !== null);
      const sharedWithEditorUids = updatedSharedWith
        .filter((s) => s.role === 'editor' && s.uid)
        .map((s) => s.uid as string);

      const projectRef = doc(db, 'users', user.uid, 'projects', project.id);
      await updateDoc(projectRef, {
        sharedWith: updatedSharedWith,
        sharedWithUids,
        sharedWithEditorUids,
        updatedAt: serverTimestamp(),
      });

      // Remove shared_projects index document
      if (shareToRemove.uid) {
        const indexId = `${user.uid}_${project.id}_${shareToRemove.uid}`;
        await deleteDoc(doc(db, 'shared_projects', indexId));
      }
    },
    [user, project]
  );

  const updateShareRole = useCallback(
    async (email: string, newRole: ShareRole) => {
      if (!user || !project) throw new Error('Not authenticated');

      const existing = project.shared_with || [];
      const updatedSharedWith = existing.map((s) =>
        s.email === email ? { ...s, role: newRole } : s
      );
      const sharedWithUids = updatedSharedWith
        .map((s) => s.uid)
        .filter((uid): uid is string => uid !== null);
      const sharedWithEditorUids = updatedSharedWith
        .filter((s) => s.role === 'editor' && s.uid)
        .map((s) => s.uid as string);

      const projectRef = doc(db, 'users', user.uid, 'projects', project.id);
      await updateDoc(projectRef, {
        sharedWith: updatedSharedWith,
        sharedWithUids,
        sharedWithEditorUids,
        updatedAt: serverTimestamp(),
      });

      // Update shared_projects index document
      const share = existing.find((s) => s.email === email);
      if (share?.uid) {
        const indexId = `${user.uid}_${project.id}_${share.uid}`;
        await setDoc(doc(db, 'shared_projects', indexId), {
          role: newRole,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    },
    [user, project]
  );

  return { addShare, removeShare, updateShareRole };
}
