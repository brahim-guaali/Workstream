export const STATUS_CONFIG = {
  backlog: { label: 'Backlog', hex: '#a8a29e', tw: 'bg-stone-400', icon: 'M6 10h8' },
  active:  { label: 'Active',  hex: '#3b82f6', tw: 'bg-green-500', icon: null },
  blocked: { label: 'Blocked', hex: '#f59e0b', tw: 'bg-amber-500', icon: 'M6 6l8 8M14 6l-8 8' },
  done:    { label: 'Done',    hex: '#22c55e', tw: 'bg-slate-400', icon: 'M5 10l4 4 6-6' },
} as const;

export const SOURCE_TYPE_CONFIG = {
  task:          { label: 'Task',          hex: '#64748b', tw: 'bg-slate-500' },
  investigation: { label: 'Investigation', hex: '#3b82f6', tw: 'bg-blue-500' },
  meeting:       { label: 'Meeting',       hex: '#a855f7', tw: 'bg-purple-500' },
  blocker:       { label: 'Blocker',       hex: '#ef4444', tw: 'bg-red-500' },
  discovery:     { label: 'Discovery',     hex: '#06b6d4', tw: 'bg-cyan-500' },
} as const;

// Derived types — update automatically when config changes
export type StreamStatus = keyof typeof STATUS_CONFIG;
export type SourceType = keyof typeof SOURCE_TYPE_CONFIG;

// Convenience lookups (derived from config — no duplication)
export const statusLabels = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])
) as Record<StreamStatus, string>;

export const statusHexColors = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.hex])
) as Record<StreamStatus, string>;

export const statusColors = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.tw])
) as Record<StreamStatus, string>;

export const statusIcons = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.icon])
) as Record<StreamStatus, string | null>;

export const sourceTypeLabels = Object.fromEntries(
  Object.entries(SOURCE_TYPE_CONFIG).map(([k, v]) => [k, v.label])
) as Record<SourceType, string>;

export const sourceTypeHexColors = Object.fromEntries(
  Object.entries(SOURCE_TYPE_CONFIG).map(([k, v]) => [k, v.hex])
) as Record<SourceType, string>;

export const sourceTypeColors = Object.fromEntries(
  Object.entries(SOURCE_TYPE_CONFIG).map(([k, v]) => [k, v.tw])
) as Record<SourceType, string>;

// Select options for dropdowns (derived)
export const statusOptions = Object.entries(STATUS_CONFIG).map(([value, c]) => ({
  value: value as StreamStatus,
  label: c.label,
}));

export const sourceTypeOptions = Object.entries(SOURCE_TYPE_CONFIG).map(([value, c]) => ({
  value: value as SourceType,
  label: c.label,
}));

export const EMOJI_TAG_OPTIONS = [
  { emoji: '🔥', label: 'Urgent' },
  { emoji: '🚀', label: 'Launch' },
  { emoji: '⭐', label: 'Important' },
  { emoji: '💡', label: 'Idea' },
  { emoji: '⚠️', label: 'Caution' },
  { emoji: '🎯', label: 'Goal' },
  { emoji: '🐛', label: 'Bug' },
  { emoji: '👀', label: 'Review' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '🧪', label: 'Experiment' },
  { emoji: '⏰', label: 'Time sensitive' },
  { emoji: '💎', label: 'High value' },
] as const;

export const MAX_EMOJI_TAGS = 4;
