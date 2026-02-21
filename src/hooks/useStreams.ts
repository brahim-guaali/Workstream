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
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Stream, StreamWithChildren, StreamStatus, SourceType } from '../types/database';
import { buildStreamTree } from '../lib/utils';

type StreamInput = {
  project_id: string;
  parent_stream_id: string | null;
  title: string;
  description: string | null;
  status: StreamStatus;
  source_type: SourceType;
  branched_from_event_id: string | null;
};

export function useStreams(projectId: string | undefined) {
  const { user } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamTree, setStreamTree] = useState<StreamWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId) {
      // Reset state when dependencies are not available
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreams([]);
      setStreamTree([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const streamsRef = collection(db, 'users', user.uid, 'projects', projectId, 'streams');
    const q = query(streamsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const streamList: Stream[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            project_id: projectId,
            parent_stream_id: data.parentStreamId || null,
            title: data.title,
            description: data.description,
            status: data.status,
            source_type: data.sourceType,
            created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updated_at: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            created_by: user.uid,
            branched_from_event_id: data.branchedFromEventId || null,
            position_x: data.positionX ?? undefined,
            position_y: data.positionY ?? undefined,
          };
        });
        setStreams(streamList);
        setStreamTree(buildStreamTree(streamList));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, projectId]);

  const createStream = useCallback(
    async (stream: StreamInput) => {
      if (!user) throw new Error('Not authenticated');

      const streamsRef = collection(db, 'users', user.uid, 'projects', stream.project_id, 'streams');
      const docRef = await addDoc(streamsRef, {
        title: stream.title,
        description: stream.description,
        status: stream.status,
        sourceType: stream.source_type,
        parentStreamId: stream.parent_stream_id,
        branchedFromEventId: stream.branched_from_event_id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        id: docRef.id,
        project_id: stream.project_id,
        parent_stream_id: stream.parent_stream_id,
        title: stream.title,
        description: stream.description,
        status: stream.status,
        source_type: stream.source_type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.uid,
        branched_from_event_id: stream.branched_from_event_id,
      } as Stream;
    },
    [user]
  );

  const updateStream = useCallback(
    async (id: string, updates: Partial<Stream>) => {
      if (!user || !projectId) throw new Error('Not authenticated');

      const streamRef = doc(db, 'users', user.uid, 'projects', projectId, 'streams', id);
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.source_type !== undefined) updateData.sourceType = updates.source_type;
      if (updates.parent_stream_id !== undefined) updateData.parentStreamId = updates.parent_stream_id;
      if (updates.created_at !== undefined) updateData.createdAt = new Date(updates.created_at);
      if (updates.position_x !== undefined) updateData.positionX = updates.position_x;
      if (updates.position_y !== undefined) updateData.positionY = updates.position_y;

      await updateDoc(streamRef, updateData);

      return {
        id,
        ...updates,
        updated_at: new Date().toISOString(),
      } as Stream;
    },
    [user, projectId]
  );

  const deleteStream = useCallback(
    async (id: string) => {
      if (!user || !projectId) throw new Error('Not authenticated');

      const streamRef = doc(db, 'users', user.uid, 'projects', projectId, 'streams', id);
      await deleteDoc(streamRef);
    },
    [user, projectId]
  );

  const fetchStreams = useCallback(() => {
    // No-op - using real-time listener
  }, []);

  type ExportedStream = {
    id: string;
    title: string;
    description: string | null;
    status: StreamStatus;
    source_type: SourceType;
    created_at: string;
    position_x?: number;
    position_y?: number;
    events: Array<{
      type: string;
      content: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;
    children: ExportedStream[];
  };

  const exportProject = useCallback(async () => {
    if (!user || !projectId) throw new Error('Not authenticated');

    // Fetch events for all streams
    const streamEventsMap = new Map<string, Array<{
      type: string;
      content: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>>();

    for (const stream of streams) {
      const eventsRef = collection(
        db,
        'users',
        user.uid,
        'projects',
        projectId,
        'streams',
        stream.id,
        'events'
      );
      const eventsSnapshot = await getDocs(query(eventsRef, orderBy('createdAt', 'asc')));
      const events = eventsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          type: data.type,
          content: data.content,
          metadata: data.metadata || null,
          created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      });
      streamEventsMap.set(stream.id, events);
    }

    // Build nested tree structure
    const buildExportTree = (parentId: string | null): ExportedStream[] => {
      return streams
        .filter((s) => s.parent_stream_id === parentId)
        .map((stream) => ({
          id: stream.id,
          title: stream.title,
          description: stream.description,
          status: stream.status,
          source_type: stream.source_type,
          created_at: stream.created_at,
          position_x: stream.position_x,
          position_y: stream.position_y,
          events: streamEventsMap.get(stream.id) || [],
          children: buildExportTree(stream.id),
        }));
    };

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      streams: buildExportTree(null),
    };
  }, [user, projectId, streams]);

  type ImportedStream = {
    id: string;
    title: string;
    description: string | null;
    status: StreamStatus;
    source_type: SourceType;
    created_at: string;
    position_x?: number;
    position_y?: number;
    events: Array<{
      type: string;
      content: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;
    children: ImportedStream[];
  };

  const importProject = useCallback(
    async (data: {
      version: number;
      streams: ImportedStream[];
    }) => {
      if (!user || !projectId) throw new Error('Not authenticated');

      // Recursively import streams with their children
      const importStreamWithChildren = async (
        stream: ImportedStream,
        parentStreamId: string | null
      ) => {
        const streamsRef = collection(db, 'users', user.uid, 'projects', projectId, 'streams');
        const docRef = await addDoc(streamsRef, {
          title: stream.title,
          description: stream.description,
          status: stream.status,
          sourceType: stream.source_type,
          parentStreamId,
          branchedFromEventId: null,
          createdAt: Timestamp.fromDate(new Date(stream.created_at)),
          updatedAt: serverTimestamp(),
          positionX: stream.position_x,
          positionY: stream.position_y,
        });

        // Create events for this stream
        for (const event of stream.events) {
          const eventsRef = collection(
            db,
            'users',
            user.uid,
            'projects',
            projectId,
            'streams',
            docRef.id,
            'events'
          );
          await addDoc(eventsRef, {
            type: event.type,
            content: event.content,
            metadata: event.metadata,
            createdAt: Timestamp.fromDate(new Date(event.created_at)),
          });
        }

        // Import children with this stream as parent
        for (const child of stream.children) {
          await importStreamWithChildren(child, docRef.id);
        }
      };

      // Import all root streams
      for (const stream of data.streams) {
        await importStreamWithChildren(stream, null);
      }
    },
    [user, projectId]
  );

  return {
    streams,
    streamTree,
    loading,
    error,
    fetchStreams,
    createStream,
    updateStream,
    deleteStream,
    exportProject,
    importProject,
  };
}
