import { useState, useCallback, useRef } from 'react';
import { getGenerativeModel } from 'firebase/ai';
import { ai } from '../lib/firebase';
import type { Project, Stream, ProjectMetric } from '../types/database';

interface ExportedStream {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source_type: string;
  events: Array<{ type: string; content: string; created_at: string }>;
  children: ExportedStream[];
}

interface ExportData {
  streams: ExportedStream[];
}

function flattenStreams(streams: ExportedStream[]): ExportedStream[] {
  const result: ExportedStream[] = [];
  for (const s of streams) {
    result.push(s);
    result.push(...flattenStreams(s.children));
  }
  return result;
}

function buildPrompt(
  project: Project,
  streams: Stream[],
  exportData: ExportData,
  metrics: ProjectMetric[]
): string {
  const flat = flattenStreams(exportData.streams);

  // Stream counts by status
  const statusCounts: Record<string, number> = {};
  for (const s of streams) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }
  const statusSummary = Object.entries(statusCounts)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');

  // Blocked streams
  const blockedStreams = streams.filter((s) => s.status === 'blocked');
  const blockedSection =
    blockedStreams.length > 0
      ? blockedStreams
          .map((s) => `- "${s.title}"${s.description ? `: ${s.description}` : ''}`)
          .join('\n')
      : 'None';

  // Metrics
  const metricsSection =
    metrics.length > 0
      ? metrics
          .map((m) => {
            const progress = m.target
              ? ` (${Math.round(((m.value - m.initialValue) / (m.target - m.initialValue)) * 100)}% toward target ${m.target})`
              : '';
            return `- ${m.name}: ${m.value}${m.target ? ` / ${m.target}` : ''}${progress}`;
          })
          .join('\n')
      : 'No metrics defined';

  // Recent events — collect all events, sort by date, take the 20 most recent
  const allEvents: Array<{ streamTitle: string; type: string; content: string; created_at: string }> = [];
  for (const s of flat) {
    for (const e of s.events) {
      allEvents.push({
        streamTitle: s.title,
        type: e.type,
        content: e.content.slice(0, 200),
        created_at: e.created_at,
      });
    }
  }
  allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const recentEvents = allEvents.slice(0, 20);

  const eventsSection =
    recentEvents.length > 0
      ? recentEvents
          .map((e) => `- [${e.streamTitle}] (${e.type}) ${e.content}`)
          .join('\n')
      : 'No events yet';

  return `Project: ${project.name}
${project.description ? `Description: ${project.description}` : ''}

Streams (${streams.length} total): ${statusSummary}

Blocked Streams:
${blockedSection}

Metrics:
${metricsSection}

Recent Events (most recent first):
${eventsSection}`;
}

export function useProjectInsights() {
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const generateInsights = useCallback(
    async (
      project: Project,
      streams: Stream[],
      exportProject: () => Promise<ExportData>
    ) => {
      setLoading(true);
      setError(null);
      setInsights('');
      abortRef.current = false;

      let fullText = '';
      try {
        const exportData = await exportProject();
        const prompt = buildPrompt(project, streams, exportData, project.metrics ?? []);

        const model = getGenerativeModel(ai, {
          model: 'gemini-2.5-flash',
          systemInstruction:
            `You are a project management analyst. Analyze the following project data and provide a concise insights report in markdown. Structure it as follows:

## TL;DR
A 2-3 sentence high-level summary of the project state. Bold the key takeaway.

## Progress Overview
Brief bullet points on stream status distribution and momentum. Keep to 3-4 bullets max.

## Blockers & Risks
List any blocked streams or risks. If none, say so in one line. Keep each item to one sentence.

## Metrics Analysis
Only include if metrics exist. One bullet per metric with trend interpretation. Keep it short.

## Recommendations
2-3 specific, actionable next steps as bullet points. Each should be one sentence.

Rules: Be concise — the entire response should be under 300 words. Use **bold** for emphasis. Use bullet points, not paragraphs. Be specific to the data, not generic.`,
        });

        const result = await model.generateContentStream(prompt);

        for await (const chunk of result.stream) {
          if (abortRef.current) break;
          const text = chunk.text();
          if (text) {
            fullText += text;
            setInsights(fullText);
          }
        }
      } catch (err) {
        // Only surface the error if we didn't receive any streamed content.
        // The Firebase AI SDK has a known issue where post-stream validation
        // can throw even after a successful response.
        if (!fullText && !abortRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to generate insights');
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { insights, loading, error, generateInsights, abort };
}
