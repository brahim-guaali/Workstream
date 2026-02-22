import type { StreamStatus, SourceType } from '../lib/streamConfig';
export type { StreamStatus, SourceType };
export type EventType = 'note' | 'status_change' | 'artifact_link' | 'created';
export type ArtifactType = 'pr' | 'ticket' | 'doc' | 'link';
export type ShareRole = 'viewer' | 'editor';

export interface ProjectShare {
  email: string;
  uid: string | null;
  role: ShareRole;
  added_at: string;
}

export interface SharedProjectRef {
  id: string;
  owner_uid: string;
  owner_email: string;
  owner_display_name: string;
  project_id: string;
  project_name: string;
  role: ShareRole;
  shared_with_uid: string;
  updatedAt: unknown;
}

export interface ProjectMetric {
  id: string;
  name: string;
  value: number;
  initialValue: number;
  target?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  metrics: ProjectMetric[];
  created_at: string;
  updated_at: string;
  user_id: string;
  shared_with: ProjectShare[];
  owner_email: string;
}

export interface Stream {
  id: string;
  project_id: string;
  parent_stream_id: string | null;
  title: string;
  description: string | null;
  status: StreamStatus;
  source_type: SourceType;
  created_at: string;
  updated_at: string;
  created_by: string;
  branched_from_event_id: string | null;
  position_x?: number;
  position_y?: number;
  dependencies: string[];
}

export interface StreamEvent {
  id: string;
  stream_id: string;
  type: EventType;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string;
}

export interface Artifact {
  id: string;
  stream_id: string;
  type: ArtifactType;
  url: string;
  title: string;
  created_at: string;
}

// Extended types for UI
export interface StreamWithChildren extends Stream {
  children: StreamWithChildren[];
  events?: StreamEvent[];
  artifacts?: Artifact[];
  depth?: number;
  _collapsed?: { count: number; originalIds: string[] };
}

export interface ProjectWithStreams extends Project {
  streams: Stream[];
}

// Database insert types
export type ProjectInsert = Omit<Project, 'id' | 'created_at' | 'updated_at'>;
export type StreamInsert = Omit<Stream, 'id' | 'created_at' | 'updated_at'>;
export type EventInsert = Omit<StreamEvent, 'id' | 'created_at'>;
export type ArtifactInsert = Omit<Artifact, 'id' | 'created_at'>;
