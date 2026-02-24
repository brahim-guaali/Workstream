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
  writeBatch,
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

export function useStreams(projectId: string | undefined, ownerId?: string) {
  const { user } = useAuth();
  const resolvedOwnerId = ownerId || user?.uid;
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamTree, setStreamTree] = useState<StreamWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId || !resolvedOwnerId) {
      // Reset state when dependencies are not available
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreams([]);
      setStreamTree([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const streamsRef = collection(db, 'users', resolvedOwnerId, 'projects', projectId, 'streams');
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
            created_by: resolvedOwnerId,
            branched_from_event_id: data.branchedFromEventId || null,
            position_x: data.positionX ?? undefined,
            position_y: data.positionY ?? undefined,
            dependencies: data.dependencies ?? [],
            due_date: data.dueDate?.toDate?.()?.toISOString() || null,
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
  }, [user, projectId, resolvedOwnerId]);

  const createStream = useCallback(
    async (stream: StreamInput) => {
      if (!user || !resolvedOwnerId) throw new Error('Not authenticated');

      const streamsRef = collection(db, 'users', resolvedOwnerId, 'projects', stream.project_id, 'streams');
      const docRef = await addDoc(streamsRef, {
        title: stream.title,
        description: stream.description,
        status: stream.status,
        sourceType: stream.source_type,
        parentStreamId: stream.parent_stream_id,
        branchedFromEventId: stream.branched_from_event_id,
        dependencies: [],
        dueDate: null,
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
        dependencies: [],
        due_date: null,
      } as Stream;
    },
    [user, resolvedOwnerId]
  );

  const updateStream = useCallback(
    async (id: string, updates: Partial<Stream>) => {
      if (!user || !projectId || !resolvedOwnerId) throw new Error('Not authenticated');

      const streamRef = doc(db, 'users', resolvedOwnerId, 'projects', projectId, 'streams', id);
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
      if (updates.dependencies !== undefined) updateData.dependencies = updates.dependencies;
      if (updates.due_date !== undefined) updateData.dueDate = updates.due_date ? new Date(updates.due_date) : null;

      await updateDoc(streamRef, updateData);

      return {
        id,
        ...updates,
        updated_at: new Date().toISOString(),
      } as Stream;
    },
    [user, projectId, resolvedOwnerId]
  );

  const deleteStream = useCallback(
    async (id: string) => {
      if (!user || !projectId || !resolvedOwnerId) throw new Error('Not authenticated');

      const streamRef = doc(db, 'users', resolvedOwnerId, 'projects', projectId, 'streams', id);
      await deleteDoc(streamRef);
    },
    [user, projectId, resolvedOwnerId]
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
    updated_at: string;
    position_x?: number;
    position_y?: number;
    dependencies: string[];
    events: Array<{
      type: string;
      content: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;
    children: ExportedStream[];
  };

  const exportProject = useCallback(async (project?: { name: string; description: string | null; created_at: string; updated_at: string }) => {
    if (!user || !projectId || !resolvedOwnerId) throw new Error('Not authenticated');

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
        resolvedOwnerId,
        'projects',
        projectId,
        'streams',
        stream.id,
        'events'
      );
      const eventsSnapshot = await getDocs(query(eventsRef, orderBy('createdAt', 'desc')));
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
          updated_at: stream.updated_at,
          position_x: stream.position_x,
          position_y: stream.position_y,
          dependencies: stream.dependencies,
          events: streamEventsMap.get(stream.id) || [],
          children: buildExportTree(stream.id),
        }));
    };

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      ...(project ? { project: { name: project.name, description: project.description, created_at: project.created_at, updated_at: project.updated_at } } : {}),
      streams: buildExportTree(null),
    };
  }, [user, projectId, resolvedOwnerId, streams]);

  type ImportedStream = {
    id: string;
    title: string;
    description: string | null;
    status: StreamStatus;
    source_type: SourceType;
    created_at: string;
    updated_at?: string;
    position_x?: number;
    position_y?: number;
    dependencies?: string[];
    events: Array<{
      type: string;
      content: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;
    children: ImportedStream[];
  };

  const VALID_STATUSES = ['backlog', 'active', 'blocked', 'done'];
  const VALID_SOURCE_TYPES = ['task', 'investigation', 'meeting', 'blocker', 'discovery'];

  const validateImportData = (data: unknown): { valid: boolean; error?: string } => {
    if (!data || typeof data !== 'object') return { valid: false, error: 'Import data must be an object' };
    const d = data as Record<string, unknown>;
    if (d.version !== 2) return { valid: false, error: `Unsupported version: ${d.version}. Expected version 2.` };
    if (!Array.isArray(d.streams) || d.streams.length === 0) return { valid: false, error: 'Import must contain a non-empty streams array' };

    const validateStream = (stream: unknown, path: string): string | null => {
      if (!stream || typeof stream !== 'object') return `${path}: stream must be an object`;
      const s = stream as Record<string, unknown>;
      if (typeof s.title !== 'string' || !s.title.trim()) return `${path}: title must be a non-empty string`;
      if (!VALID_STATUSES.includes(s.status as string)) return `${path}: invalid status "${s.status}". Must be one of: ${VALID_STATUSES.join(', ')}`;
      if (!VALID_SOURCE_TYPES.includes(s.source_type as string)) return `${path}: invalid source_type "${s.source_type}". Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`;
      if (typeof s.created_at !== 'string' || isNaN(Date.parse(s.created_at))) return `${path}: created_at must be a valid date string`;

      if (Array.isArray(s.events)) {
        for (let i = 0; i < s.events.length; i++) {
          const ev = s.events[i] as Record<string, unknown>;
          if (!ev || typeof ev !== 'object') return `${path}.events[${i}]: event must be an object`;
          if (typeof ev.type !== 'string') return `${path}.events[${i}]: type must be a string`;
          if (typeof ev.content !== 'string') return `${path}.events[${i}]: content must be a string`;
          if (typeof ev.created_at !== 'string' || isNaN(Date.parse(ev.created_at))) return `${path}.events[${i}]: created_at must be a valid date string`;
        }
      }

      if (Array.isArray(s.children)) {
        for (let i = 0; i < s.children.length; i++) {
          const err = validateStream(s.children[i], `${path}.children[${i}]`);
          if (err) return err;
        }
      }
      return null;
    };

    for (let i = 0; i < d.streams.length; i++) {
      const err = validateStream(d.streams[i], `streams[${i}]`);
      if (err) return { valid: false, error: err };
    }
    return { valid: true };
  };

  const importProject = useCallback(
    async (data: {
      version: number;
      streams: ImportedStream[];
    }) => {
      if (!user || !projectId || !resolvedOwnerId) throw new Error('Not authenticated');

      // Validate before any writes
      const validation = validateImportData(data);
      if (!validation.valid) throw new Error(`Validation failed: ${validation.error}`);

      // Collect all write operations first, then commit in batches
      const writes: Array<{
        type: 'stream';
        ref: ReturnType<typeof doc>;
        data: Record<string, unknown>;
      } | {
        type: 'event';
        ref: ReturnType<typeof doc>;
        data: Record<string, unknown>;
      }> = [];

      const collectWrites = (
        stream: ImportedStream,
        parentStreamId: string | null
      ) => {
        const streamsRef = collection(db, 'users', resolvedOwnerId, 'projects', projectId, 'streams');
        const streamDocRef = doc(streamsRef);

        const updatedAt = stream.updated_at
          ? Timestamp.fromDate(new Date(stream.updated_at))
          : Timestamp.fromDate(new Date(stream.created_at));

        writes.push({
          type: 'stream',
          ref: streamDocRef,
          data: {
            title: stream.title,
            description: stream.description,
            status: stream.status,
            sourceType: stream.source_type,
            parentStreamId,
            branchedFromEventId: null,
            dependencies: stream.dependencies ?? [],
            createdAt: Timestamp.fromDate(new Date(stream.created_at)),
            updatedAt,
            ...(stream.position_x !== undefined && { positionX: stream.position_x }),
            ...(stream.position_y !== undefined && { positionY: stream.position_y }),
          },
        });

        for (const event of stream.events) {
          const eventsRef = collection(
            db,
            'users',
            resolvedOwnerId,
            'projects',
            projectId,
            'streams',
            streamDocRef.id,
            'events'
          );
          writes.push({
            type: 'event',
            ref: doc(eventsRef),
            data: {
              type: event.type,
              content: event.content,
              metadata: event.metadata,
              createdAt: Timestamp.fromDate(new Date(event.created_at)),
            },
          });
        }

        for (const child of stream.children) {
          collectWrites(child, streamDocRef.id);
        }
      };

      // Collect all writes from the tree
      for (const stream of data.streams) {
        collectWrites(stream, null);
      }

      // Commit in batches of 500 (Firestore limit)
      const BATCH_SIZE = 500;
      for (let i = 0; i < writes.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = writes.slice(i, i + BATCH_SIZE);
        for (const write of chunk) {
          batch.set(write.ref, write.data);
        }
        await batch.commit();
      }
    },
    [user, projectId, resolvedOwnerId]
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
    validateImportData,
  };
}
