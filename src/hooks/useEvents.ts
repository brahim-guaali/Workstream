import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { StreamEvent, EventType } from '../types/database';

type EventInput = {
  stream_id: string;
  type: EventType;
  content: string;
  metadata: Record<string, unknown> | null;
};

export function useEvents(projectId: string | undefined, streamId: string | undefined) {
  const { user } = useAuth();
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId || !streamId) {
      // Reset state when dependencies are not available
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const eventsRef = collection(
      db,
      'users',
      user.uid,
      'projects',
      projectId,
      'streams',
      streamId,
      'events'
    );
    const q = query(eventsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const eventList: StreamEvent[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            stream_id: streamId,
            type: data.type,
            content: data.content,
            metadata: data.metadata || null,
            created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            created_by: user.uid,
          };
        });
        setEvents(eventList);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, projectId, streamId]);

  const createEvent = useCallback(
    async (event: EventInput) => {
      if (!user || !projectId) throw new Error('Not authenticated');

      const eventsRef = collection(
        db,
        'users',
        user.uid,
        'projects',
        projectId,
        'streams',
        event.stream_id,
        'events'
      );
      const docRef = await addDoc(eventsRef, {
        type: event.type,
        content: event.content,
        metadata: event.metadata,
        createdAt: serverTimestamp(),
      });

      return {
        id: docRef.id,
        stream_id: event.stream_id,
        type: event.type,
        content: event.content,
        metadata: event.metadata,
        created_at: new Date().toISOString(),
        created_by: user.uid,
      } as StreamEvent;
    },
    [user, projectId]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      if (!user || !projectId || !streamId) throw new Error('Not authenticated');

      const eventRef = doc(
        db,
        'users',
        user.uid,
        'projects',
        projectId,
        'streams',
        streamId,
        'events',
        id
      );
      await deleteDoc(eventRef);
    },
    [user, projectId, streamId]
  );

  const fetchEvents = useCallback(() => {
    // No-op - using real-time listener
  }, []);

  return {
    events,
    loading,
    error,
    fetchEvents,
    createEvent,
    deleteEvent,
  };
}
