import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Project, ProjectMetric, ShareRole } from '../types/database';

type ProjectInput = {
  name: string;
  description: string | null;
};

type ProjectUpdates = Partial<Project> & { metrics?: ProjectMetric[] };

export function useProject(projectId: string | undefined, ownerId?: string) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const resolvedOwnerId = ownerId || user?.uid;

  const userRole: 'owner' | ShareRole = resolvedOwnerId === user?.uid ? 'owner' : (() => {
    if (!project?.shared_with || !user) return 'viewer' as ShareRole;
    const share = project.shared_with.find(s => s.uid === user.uid);
    return share?.role ?? 'viewer' as ShareRole;
  })();

  useEffect(() => {
    if (!user || !projectId || !resolvedOwnerId) {
      setProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const projectRef = doc(db, 'users', resolvedOwnerId, 'projects', projectId);
    const unsubscribe = onSnapshot(projectRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProject({
          id: snap.id,
          name: data.name,
          description: data.description,
          metrics: (data.metrics ?? []).map((m: Record<string, unknown>) => ({
            ...m,
            initialValue: m.initialValue ?? m.value,
          })),
          user_id: resolvedOwnerId,
          created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updated_at: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          shared_with: data.sharedWith ?? [],
          owner_email: data.ownerEmail ?? '',
        });
      } else {
        setProject(null);
      }
      setLoading(false);
    }, () => {
      setProject(null);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, projectId, resolvedOwnerId]);

  const updateProject = useCallback(
    async (updates: ProjectUpdates) => {
      if (!user || !projectId || !resolvedOwnerId) throw new Error('Not authenticated');

      const projectRef = doc(db, 'users', resolvedOwnerId, 'projects', projectId);
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.metrics !== undefined) updateData.metrics = updates.metrics;

      await updateDoc(projectRef, updateData);
    },
    [user, projectId, resolvedOwnerId]
  );

  return { project, loading, updateProject, userRole };
}

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      // Reset state when user is not available
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const projectsRef = collection(db, 'users', user.uid, 'projects');
    const q = query(projectsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const projectList: Project[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            metrics: (data.metrics ?? []).map((m: Record<string, unknown>) => ({
              ...m,
              initialValue: m.initialValue ?? m.value,
            })),
            user_id: user.uid,
            created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updated_at: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            shared_with: data.sharedWith ?? [],
            owner_email: data.ownerEmail ?? '',
          };
        });
        setProjects(projectList);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const createProject = useCallback(
    async (project: ProjectInput) => {
      if (!user) throw new Error('Not authenticated');

      const projectsRef = collection(db, 'users', user.uid, 'projects');
      const docRef = await addDoc(projectsRef, {
        name: project.name,
        description: project.description,
        metrics: [],
        sharedWith: [],
        sharedWithUids: [],
        sharedWithEditorUids: [],
        ownerEmail: user.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        id: docRef.id,
        name: project.name,
        description: project.description,
        metrics: [],
        user_id: user.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        shared_with: [],
        owner_email: user.email || '',
      } as Project;
    },
    [user]
  );

  const updateProject = useCallback(
    async (id: string, updates: ProjectUpdates) => {
      if (!user) throw new Error('Not authenticated');

      const projectRef = doc(db, 'users', user.uid, 'projects', id);
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.metrics !== undefined) updateData.metrics = updates.metrics;

      await updateDoc(projectRef, updateData);

      return {
        id,
        ...updates,
        updated_at: new Date().toISOString(),
      } as Project;
    },
    [user]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not authenticated');

      const projectRef = doc(db, 'users', user.uid, 'projects', id);
      await deleteDoc(projectRef);
    },
    [user]
  );

  const fetchProjects = useCallback(() => {
    // No-op - using real-time listener
  }, []);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}
