import type { Project, ProjectMetric } from '../types/database';
import { statusLabels, sourceTypeLabels, metricProgress } from './utils';

type ExportedStream = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source_type: string;
  created_at: string;
  dependencies: string[];
  events: Array<{
    type: string;
    content: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
  children: ExportedStream[];
};

export type ExportData = {
  version: number;
  exportedAt: string;
  streams: ExportedStream[];
};

function buildIdToTitle(streams: ExportedStream[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (list: ExportedStream[]) => {
    for (const s of list) {
      map.set(s.id, s.title);
      walk(s.children);
    }
  };
  walk(streams);
  return map;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function metricChange(m: ProjectMetric): string {
  const progress = metricProgress(m);
  if (!progress) return '';
  return progress.pct > 0 ? `+${progress.pct}%` : `${progress.pct}%`;
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export function generateMarkdown(project: Project, exportData: ExportData): string {
  const lines: string[] = [];
  const idToTitle = buildIdToTitle(exportData.streams);

  lines.push(`# ${project.name}`);
  if (project.description) {
    lines.push(`> ${project.description}`);
  }
  lines.push('');

  // Metrics
  if (project.metrics.length > 0) {
    lines.push('## Metrics');
    lines.push('| Name | Value | Target | Change |');
    lines.push('|------|-------|--------|--------|');
    for (const m of project.metrics) {
      const target = m.target != null ? String(m.target) : '—';
      const change = metricChange(m) || '—';
      lines.push(`| ${m.name} | ${m.value} | ${target} | ${change} |`);
    }
    lines.push('');
  }

  // Streams
  if (exportData.streams.length > 0) {
    lines.push('## Streams');
    lines.push('');

    const renderStream = (stream: ExportedStream, depth: number) => {
      const level = Math.min(depth + 3, 6);
      const heading = '#'.repeat(level);
      const statusLabel =
        statusLabels[stream.status as keyof typeof statusLabels] || stream.status;
      const typeLabel =
        sourceTypeLabels[stream.source_type as keyof typeof sourceTypeLabels] || stream.source_type;

      lines.push(`${heading} ${stream.title} [${statusLabel} | ${typeLabel}]`);

      if (stream.description) {
        lines.push(`> ${stream.description}`);
      }

      if (stream.dependencies.length > 0) {
        const depNames = stream.dependencies.map((id) => idToTitle.get(id) || id);
        lines.push(`**Dependencies:** ${depNames.join(', ')}`);
      }

      const notes = stream.events.filter((e) => e.type === 'note');
      if (notes.length > 0) {
        lines.push('');
        lines.push(`${'#'.repeat(Math.min(level + 1, 6))} Notes`);
        for (const note of notes) {
          lines.push(`- ${formatDate(note.created_at)}: ${note.content}`);
        }
      }

      lines.push('');

      for (const child of stream.children) {
        renderStream(child, depth + 1);
      }
    };

    for (const stream of exportData.streams) {
      renderStream(stream, 0);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Print-ready HTML (for window.print → PDF)
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generatePrintHTML(project: Project, exportData: ExportData): string {
  const idToTitle = buildIdToTitle(exportData.streams);

  // Metrics table
  const metricsHTML =
    project.metrics.length > 0
      ? `<h2>Metrics</h2>
    <table>
      <thead><tr><th>Name</th><th>Value</th><th>Target</th><th>Change</th></tr></thead>
      <tbody>
        ${project.metrics
          .map((m) => {
            const target = m.target != null ? String(m.target) : '—';
            const progress = metricProgress(m);
            const change = metricChange(m);
            const cls = progress
              ? progress.isPositive ? 'positive' : 'negative'
              : '';
            return `<tr><td>${escapeHtml(m.name)}</td><td>${m.value}</td><td>${target}</td><td class="${cls}">${change || '—'}</td></tr>`;
          })
          .join('')}
      </tbody>
    </table>`
      : '';

  // Streams
  const renderStreamHTML = (stream: ExportedStream, depth: number): string => {
    const statusLabel =
      statusLabels[stream.status as keyof typeof statusLabels] || stream.status;
    const typeLabel =
      sourceTypeLabels[stream.source_type as keyof typeof sourceTypeLabels] ||
      stream.source_type;
    const indent = depth * 24;
    const notes = stream.events.filter((e) => e.type === 'note');

    let html = `<div class="stream" style="margin-left:${indent}px">`;
    html += `<h3>${escapeHtml(stream.title)} <span class="badge">${statusLabel}</span> <span class="badge type">${typeLabel}</span></h3>`;

    if (stream.description) {
      html += `<p class="stream-desc">${escapeHtml(stream.description)}</p>`;
    }

    if (stream.dependencies.length > 0) {
      const depNames = stream.dependencies.map(
        (id) => escapeHtml(idToTitle.get(id) || id),
      );
      html += `<p class="deps"><strong>Dependencies:</strong> ${depNames.join(', ')}</p>`;
    }

    if (notes.length > 0) {
      html += '<ul class="notes">';
      for (const note of notes) {
        html += `<li><span class="date">${formatDate(note.created_at)}</span> ${escapeHtml(note.content)}</li>`;
      }
      html += '</ul>';
    }

    for (const child of stream.children) {
      html += renderStreamHTML(child, depth + 1);
    }

    html += '</div>';
    return html;
  };

  const streamsHTML =
    exportData.streams.length > 0
      ? `<h2>Streams</h2>${exportData.streams.map((s) => renderStreamHTML(s, 0)).join('')}`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(project.name)} — Export</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px 24px;color:#1c1917;line-height:1.6}
h1{font-size:28px;margin-bottom:4px}
.description{color:#57534e;margin-bottom:24px;font-style:italic}
.export-date{color:#a8a29e;font-size:13px;margin-bottom:24px}
h2{font-size:20px;margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid #e7e5e4}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #e7e5e4}
th{font-weight:600;font-size:13px;text-transform:uppercase;color:#78716c}
.positive{color:#16a34a;font-weight:600}
.negative{color:#dc2626;font-weight:600}
.stream{margin-bottom:16px;padding:12px 0 4px;border-top:1px solid #f5f5f4}
.stream h3{font-size:16px;margin-bottom:4px}
.badge{font-size:11px;font-weight:500;padding:2px 8px;border-radius:9999px;background:#f5f5f4;color:#57534e;margin-left:4px}
.badge.type{background:#e0f2fe;color:#0369a1}
.stream-desc{color:#57534e;font-size:14px;margin-bottom:6px}
.deps{font-size:13px;color:#78716c;margin-bottom:6px}
.notes{list-style:none;margin:8px 0}
.notes li{font-size:14px;padding:3px 0 3px 12px;border-left:2px solid #d6d3d1;margin-bottom:4px}
.notes .date{color:#a8a29e;font-size:12px;margin-right:6px}
@media print{body{padding:0}.stream{break-inside:avoid}}
</style>
</head>
<body>
<h1>${escapeHtml(project.name)}</h1>
${project.description ? `<p class="description">${escapeHtml(project.description)}</p>` : ''}
<p class="export-date">Exported on ${formatDate(exportData.exportedAt)}</p>
${metricsHTML}
${streamsHTML}
</body>
</html>`;
}
