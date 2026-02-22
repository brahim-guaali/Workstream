import type { Stream, StreamWithChildren } from '../types/database';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function buildStreamTree(streams: Stream[]): StreamWithChildren[] {
  const streamMap = new Map<string, StreamWithChildren>();
  const roots: StreamWithChildren[] = [];

  // First pass: create all nodes
  streams.forEach((stream) => {
    streamMap.set(stream.id, { ...stream, children: [] });
  });

  // Second pass: build tree structure
  streams.forEach((stream) => {
    const node = streamMap.get(stream.id)!;
    if (stream.parent_stream_id) {
      const parent = streamMap.get(stream.parent_stream_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort children by created_at
  const sortChildren = (nodes: StreamWithChildren[]) => {
    nodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    nodes.forEach((node) => sortChildren(node.children));
  };

  sortChildren(roots);
  return roots;
}

export function flattenTree(tree: StreamWithChildren[], depth = 0): StreamWithChildren[] {
  const result: StreamWithChildren[] = [];
  tree.forEach((node) => {
    result.push({ ...node, depth });
    result.push(...flattenTree(node.children, depth + 1));
  });
  return result;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(dateString);
}

export const statusColors = {
  backlog: 'bg-stone-400',
  active: 'bg-green-500',
  blocked: 'bg-amber-500',
  done: 'bg-slate-400',
} as const;

export const statusHexColors = {
  backlog: '#a8a29e',  // Stone/gray for backlog
  active: '#3b82f6',   // Blue for in-progress
  blocked: '#f59e0b',
  done: '#22c55e',     // Green for completed
} as const;

export const statusLabels = {
  backlog: 'Backlog',
  active: 'Active',
  blocked: 'Blocked',
  done: 'Done',
} as const;

export const sourceTypeColors = {
  investigation: 'bg-blue-500',
  meeting: 'bg-purple-500',
  blocker: 'bg-red-500',
  discovery: 'bg-cyan-500',
  task: 'bg-slate-500',
} as const;

export const sourceTypeHexColors = {
  investigation: '#3b82f6',
  meeting: '#a855f7',
  blocker: '#ef4444',
  discovery: '#06b6d4',
  task: '#64748b',
} as const;

export const sourceTypeLabels = {
  investigation: 'Investigation',
  meeting: 'Meeting',
  blocker: 'Blocker',
  discovery: 'Discovery',
  task: 'Task',
} as const;

// --- Focus mode helpers ---

function countAllNodes(nodes: StreamWithChildren[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countAllNodes(node.children);
  }
  return count;
}

function collectAllIds(nodes: StreamWithChildren[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    ids.push(...collectAllIds(node.children));
  }
  return ids;
}

function createCollapsedPlaceholder(
  nodes: StreamWithChildren[],
  parentId: string | null,
): StreamWithChildren {
  const count = countAllNodes(nodes);
  const originalIds = collectAllIds(nodes);
  return {
    id: `collapsed-${originalIds[0] || 'root'}`,
    project_id: nodes[0]?.project_id ?? '',
    parent_stream_id: parentId,
    title: `${count} stream${count !== 1 ? 's' : ''}`,
    description: null,
    status: 'backlog',
    source_type: 'task',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: '',
    branched_from_event_id: null,
    dependencies: [],
    children: [],
    _collapsed: { count, originalIds },
  };
}

function findAncestorChain(
  nodes: StreamWithChildren[],
  targetId: string,
  path: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [...path, node.id];
    }
    const found = findAncestorChain(node.children, targetId, [...path, node.id]);
    if (found) return found;
  }
  return null;
}

export function buildFocusedTree(
  tree: StreamWithChildren[],
  focusedStreamId: string,
): StreamWithChildren[] {
  const chain = findAncestorChain(tree, focusedStreamId);
  if (!chain || chain.length === 0) return tree;

  const ancestorSet = new Set(chain);

  function walkLevel(nodes: StreamWithChildren[], parentId: string | null): StreamWithChildren[] {
    // Separate nodes into "on-path" and "off-path"
    const onPath: StreamWithChildren[] = [];
    const offPath: StreamWithChildren[] = [];

    for (const node of nodes) {
      if (ancestorSet.has(node.id)) {
        onPath.push(node);
      } else {
        offPath.push(node);
      }
    }

    const result: StreamWithChildren[] = [];

    // Add on-path nodes with their children filtered recursively
    for (const node of onPath) {
      if (node.id === focusedStreamId) {
        // Keep the focused stream and all its descendants as-is
        result.push(node);
      } else {
        // This is an ancestor — recurse into its children
        result.push({
          ...node,
          children: walkLevel(node.children, node.id),
        });
      }
    }

    // Collapse off-path nodes into a single placeholder
    if (offPath.length > 0) {
      result.push(createCollapsedPlaceholder(offPath, parentId));
    }

    return result;
  }

  return walkLevel(tree, null);
}
