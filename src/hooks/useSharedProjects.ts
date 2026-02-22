import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { SharedProjectRef } from '../types/database';

export function useSharedProjects() {
  const { user } = useAuth();
  const [sharedProjects, setSharedProjects] = useState<SharedProjectRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSharedProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'shared_projects'),
      where('shared_with_uid', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const projects: SharedProjectRef[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            owner_uid: data.owner_uid,
            owner_email: data.owner_email,
            owner_display_name: data.owner_display_name,
            project_id: data.project_id,
            project_name: data.project_name,
            role: data.role,
            shared_with_uid: data.shared_with_uid,
            updatedAt: data.updatedAt,
          };
        });
        setSharedProjects(projects);
        setLoading(false);
      },
      () => {
        setSharedProjects([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { sharedProjects, loading };
}
