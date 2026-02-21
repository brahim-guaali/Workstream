import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import type { StreamWithChildren } from '../../types/database';
import { useVisualization } from '../../hooks/useVisualization';
import { statusHexColors, sourceTypeHexColors } from '../../lib/utils';

// SVG path data for status icons (20x20 viewbox, centered)
const statusIcons = {
  backlog: 'M6 10h8', // Horizontal line (pause/queue)
  active: 'M10 6v8M6 10h8', // Plus/loading style
  blocked: 'M6 6l8 8M14 6l-8 8', // X mark
  done: 'M5 10l4 4 6-6', // Checkmark
} as const;

const statusLabels = {
  backlog: 'Backlog',
  active: 'Active',
  blocked: 'Blocked',
  done: 'Done',
} as const;

const typeLabels = {
  task: 'Task',
  investigation: 'Investigation',
  meeting: 'Meeting',
  blocker: 'Blocker',
  discovery: 'Discovery',
} as const;

interface StreamTreeProps {
  streamTree: StreamWithChildren[];
  selectedStreamId: string | null;
  onSelectStream: (stream: StreamWithChildren) => void;
  onUpdateStreamPosition?: (id: string, x: number, y: number) => Promise<void>;
  onCreateChildSlice?: (parentId: string, position: { x: number; y: number }) => void;
  pendingSlice?: { parentId: string; position: { x: number; y: number } } | null;
}

export interface StreamTreeHandle {
  resetView: () => void;
}

export const StreamTree = forwardRef<StreamTreeHandle, StreamTreeProps>(function StreamTree({
  streamTree,
  selectedStreamId,
  onSelectStream,
  onUpdateStreamPosition,
  onCreateChildSlice,
  pendingSlice,
}, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { layout, zoom, pan, setPan, setZoom } = useVisualization(streamTree);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      setPan({ x: 0, y: 0 });
      setZoom(1);
    },
  }), [setPan, setZoom]);

  // Initialize offsets from saved positions
  const getInitialOffsets = useCallback(() => {
    const offsets: Record<string, { x: number; y: number }> = {};
    const flattenTree = (nodes: StreamWithChildren[]) => {
      nodes.forEach(node => {
        if (node.position_x !== undefined && node.position_y !== undefined) {
          const layoutNode = layout.nodes.find(n => n.id === node.id);
          if (layoutNode) {
            offsets[node.id] = {
              x: node.position_x - layoutNode.x,
              y: node.position_y - layoutNode.y,
            };
          }
        }
        flattenTree(node.children);
      });
    };
    flattenTree(streamTree);
    return offsets;
  }, [streamTree, layout.nodes]);

  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const processedNodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (layout.nodes.length > 0) {
      const newOffsets = getInitialOffsets();
      const offsetsToAdd: Record<string, { x: number; y: number }> = {};

      // Only collect offsets for nodes we haven't processed yet
      for (const [id, offset] of Object.entries(newOffsets)) {
        if (!processedNodesRef.current.has(id)) {
          offsetsToAdd[id] = offset;
          processedNodesRef.current.add(id);
        }
      }

      // Only update state if there are new offsets
      if (Object.keys(offsetsToAdd).length > 0) {
        setNodeOffsets((prev) => ({ ...prev, ...offsetsToAdd }));
      }
    }
  }, [layout.nodes, getInitialOffsets]);

  const handleCanvasDrag = useCallback(
    (event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) => {
      setPan((prev) => ({
        x: prev.x + event.dx,
        y: prev.y + event.dy,
      }));
    },
    [setPan]
  );


  // Compute ancestor IDs for the selected stream
  const getAncestorIds = useCallback((streamId: string | null): Set<string> => {
    const ancestors = new Set<string>();
    if (!streamId) return ancestors;

    let currentId: string | null = streamId;
    while (currentId) {
      ancestors.add(currentId);
      const node = layout.nodes.find(n => n.id === currentId);
      currentId = node?.parentId || null;
    }
    return ancestors;
  }, [layout.nodes]);

  const focusedNodeIds = getAncestorIds(selectedStreamId);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Clear previous content
    svg.selectAll('*').remove();

    // Add animation styles
    const defs = svg.append('defs');
    defs.append('style').text(`
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes stream-flow {
        0% { stroke-dashoffset: 12; }
        100% { stroke-dashoffset: 0; }
      }
      .active-badge {
        animation: pulse 2s ease-in-out infinite;
      }
      .node-draggable {
        cursor: grab;
        transition: opacity 0.2s ease-in-out;
      }
      .node-draggable:active {
        cursor: grabbing;
      }
      .node-faded {
        opacity: 0.25;
      }
      .link {
        transition: opacity 0.2s ease-in-out;
      }
      .link-faded {
        opacity: 0.15;
      }
      .link-stream {
        stroke-dasharray: 8, 4;
        animation: stream-flow 0.4s linear infinite;
      }
    `);

    // Create main group with transform
    const g = svg
      .append('g')
      .attr('class', 'main-group')
      .attr('transform', `translate(${pan.x}, ${pan.y}) scale(${zoom})`);

    // Calculate adjusted positions with offsets
    const getAdjustedPosition = (nodeId: string, baseX: number, baseY: number) => ({
      x: baseX + (nodeOffsets[nodeId]?.x || 0),
      y: baseY + (nodeOffsets[nodeId]?.y || 0),
    });

    // Draw links with adjusted positions
    const linkGenerator = d3
      .linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
      .x((d) => d[0])
      .y((d) => d[1]);

    layout.links.forEach((link) => {
      const sourceNode = layout.nodes.find(n => n.id === link.sourceId);
      const targetNode = layout.nodes.find(n => n.id === link.targetId);
      if (!sourceNode || !targetNode) return;

      const sourceAdjusted = getAdjustedPosition(link.sourceId, sourceNode.x, sourceNode.y);
      const targetAdjusted = getAdjustedPosition(link.targetId, targetNode.x, targetNode.y);

      // Calculate link anchor points based on adjusted positions
      const sourceX = sourceAdjusted.x + sourceNode.width;
      const sourceY = sourceAdjusted.y + sourceNode.height / 2;
      const targetX = targetAdjusted.x;
      const targetY = targetAdjusted.y + targetNode.height / 2;

      // Check if link connects focused nodes (part of ancestor chain)
      const isLinkInAncestorChain = selectedStreamId &&
        focusedNodeIds.has(link.sourceId) && focusedNodeIds.has(link.targetId);
      const isLinkFocused = !selectedStreamId || isLinkInAncestorChain;

      g.append('path')
        .attr('class', `link link-source-${link.sourceId} link-target-${link.targetId}${!isLinkFocused ? ' link-faded' : ''}${isLinkInAncestorChain ? ' link-stream' : ''}`)
        .attr('data-source', link.sourceId)
        .attr('data-target', link.targetId)
        .attr('d', linkGenerator({
          source: [sourceX, sourceY],
          target: [targetX, targetY],
        }))
        .attr('fill', 'none')
        .attr('stroke', isLinkInAncestorChain ? '#FF5A00' : '#a8a29e')
        .attr('stroke-width', isLinkInAncestorChain ? 3 : 2);
    });

    // Draw nodes
    layout.nodes.forEach((node) => {
      const adjustedPos = getAdjustedPosition(node.id, node.x, node.y);

      // Fade nodes that are not in the focused ancestor chain
      const isNodeFocused = !selectedStreamId || focusedNodeIds.has(node.id);

      const nodeGroup = g
        .append('g')
        .attr('transform', `translate(${adjustedPos.x}, ${adjustedPos.y})`)
        .attr('class', `node-draggable${!isNodeFocused ? ' node-faded' : ''}`)
        .attr('data-node-id', node.id);

      // Add drag behavior to node
      let dragStartX = 0;
      let dragStartY = 0;
      let nodeStartX = adjustedPos.x;
      let nodeStartY = adjustedPos.y;
      let hasDragged = false;

      const nodeDrag = d3.drag<SVGGElement, unknown>()
        .on('start', (event) => {
          event.sourceEvent.stopPropagation();

          // Store initial positions
          dragStartX = event.x;
          dragStartY = event.y;
          nodeStartX = adjustedPos.x;
          nodeStartY = adjustedPos.y;
          hasDragged = false;
        })
        .on('drag', function(event) {
          event.sourceEvent.preventDefault();

          // Get the node group dynamically using 'this'
          const currentNodeGroup = d3.select(this);

          // Calculate new position based on drag delta
          const dx = (event.x - dragStartX) / zoom;
          const dy = (event.y - dragStartY) / zoom;

          // Check if we've moved enough to consider it a drag
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            if (!hasDragged) {
              hasDragged = true;
              currentNodeGroup.raise().style('cursor', 'grabbing');
            }
          }

          if (!hasDragged) return;
          const newX = nodeStartX + dx;
          const newY = nodeStartY + dy;

          // Update transform directly for smooth dragging
          currentNodeGroup.attr('transform', `translate(${newX}, ${newY})`);

          // Store the offset for state update
          dragOffsetRef.current = {
            x: newX - node.x,
            y: newY - node.y,
          };

          // Update connected links in real-time
          const mainGroup = d3.select(svgRef.current).select('.main-group');

          // Links where this node is the source
          mainGroup.selectAll(`.link-source-${node.id}`).each(function() {
            const linkEl = d3.select(this);
            const targetId = linkEl.attr('data-target');
            const targetNode = layout.nodes.find(n => n.id === targetId);
            if (!targetNode) return;

            const targetOffset = nodeOffsets[targetId] || { x: 0, y: 0 };
            const sourceX = newX + node.width;
            const sourceY = newY + node.height / 2;
            const targetX = targetNode.x + targetOffset.x;
            const targetY = targetNode.y + targetOffset.y + targetNode.height / 2;

            linkEl.attr('d', linkGenerator({
              source: [sourceX, sourceY],
              target: [targetX, targetY],
            }));
          });

          // Links where this node is the target
          mainGroup.selectAll(`.link-target-${node.id}`).each(function() {
            const linkEl = d3.select(this);
            const sourceId = linkEl.attr('data-source');
            const sourceNode = layout.nodes.find(n => n.id === sourceId);
            if (!sourceNode) return;

            const sourceOffset = nodeOffsets[sourceId] || { x: 0, y: 0 };
            const sourceX = sourceNode.x + sourceOffset.x + sourceNode.width;
            const sourceY = sourceNode.y + sourceOffset.y + sourceNode.height / 2;
            const targetX = newX;
            const targetY = newY + node.height / 2;

            linkEl.attr('d', linkGenerator({
              source: [sourceX, sourceY],
              target: [targetX, targetY],
            }));
          });
        })
        .on('end', function() {
          d3.select(this).style('cursor', 'grab');

          if (hasDragged) {
            // Update state with final position
            setNodeOffsets((prev) => ({
              ...prev,
              [node.id]: dragOffsetRef.current,
            }));

            // Save to database
            if (onUpdateStreamPosition) {
              const finalX = node.x + dragOffsetRef.current.x;
              const finalY = node.y + dragOffsetRef.current.y;
              onUpdateStreamPosition(node.id, finalX, finalY);
            }
          } else {
            // It was a click, not a drag
            onSelectStream(node.stream);
          }
        });

      nodeGroup.call(nodeDrag);

      const statusColor = statusHexColors[node.stream.status];
      const typeColor = sourceTypeHexColors[node.stream.source_type];
      const isSelected = selectedStreamId === node.id;
      const sw = isSelected ? 2 : 1;
      const inset = sw / 2;

      // Node background (inset so stroke stays within node bounds)
      nodeGroup
        .append('rect')
        .attr('x', inset)
        .attr('y', inset)
        .attr('width', node.width - sw)
        .attr('height', node.height - sw)
        .attr('rx', 8)
        .attr('fill', isSelected ? '#FFF5ED' : '#ffffff')
        .attr('stroke', isSelected ? '#FF5A00' : '#e7e5e4')
        .attr('stroke-width', sw);

      // Status indicator - colored left border
      nodeGroup
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 6)
        .attr('height', node.height)
        .attr('rx', 8)
        .attr('fill', statusColor)
        .attr('clip-path', 'inset(0 round 8px 0 0 8px)');

      // Clean left border (cover the rounded right edge)
      nodeGroup
        .append('rect')
        .attr('x', 4)
        .attr('y', 1)
        .attr('width', 3)
        .attr('height', node.height - 2)
        .attr('fill', statusColor);

      // Status badge with icon and label
      const badgeWidth = (node.stream.status === 'blocked' || node.stream.status === 'backlog') ? 80 : 70;
      const badgeGroup = nodeGroup
        .append('g')
        .attr('transform', `translate(${node.width - badgeWidth - 8}, 8)`);

      // Badge background
      const badgeRect = badgeGroup
        .append('rect')
        .attr('width', badgeWidth)
        .attr('height', 22)
        .attr('rx', 11)
        .attr('fill', statusColor);

      // Add pulse animation for active status
      if (node.stream.status === 'active') {
        badgeRect.attr('class', 'active-badge');
      }

      // Status icon (white)
      if (node.stream.status === 'active') {
        // Spinner for active status
        const spinnerG = badgeGroup
          .append('g')
          .attr('transform', 'translate(14, 11)')
          .append('g')
          .style('animation', 'spin 1s linear infinite')
          .style('transform-origin', '0px 0px');

        spinnerG
          .append('circle')
          .attr('r', 6)
          .attr('fill', 'none')
          .attr('stroke', 'rgba(255,255,255,0.3)')
          .attr('stroke-width', 2);

        spinnerG
          .append('path')
          .attr('d', 'M0,-6 A6,6 0 0,1 6,0')
          .attr('fill', 'none')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('stroke-linecap', 'round');
      } else {
        badgeGroup
          .append('path')
          .attr('d', statusIcons[node.stream.status])
          .attr('transform', 'translate(4, 1)')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2.5)
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round')
          .attr('fill', 'none');
      }

      // Status label
      badgeGroup
        .append('text')
        .attr('x', 26)
        .attr('y', 15)
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#ffffff')
        .text(statusLabels[node.stream.status]);

      // Type badge (bottom right)
      const typeLabel = typeLabels[node.stream.source_type];
      const typeBadgeWidth = typeLabel.length * 7 + 16;
      const typeBadgeGroup = nodeGroup
        .append('g')
        .attr('transform', `translate(${node.width - typeBadgeWidth - 8}, ${node.height - 26})`);

      typeBadgeGroup
        .append('rect')
        .attr('width', typeBadgeWidth)
        .attr('height', 18)
        .attr('rx', 9)
        .attr('fill', typeColor)
        .attr('opacity', 0.15);

      typeBadgeGroup
        .append('text')
        .attr('x', typeBadgeWidth / 2)
        .attr('y', 13)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('font-weight', '500')
        .attr('fill', typeColor)
        .text(typeLabel);

      // Helper to wrap SVG text into multiple lines
      const wrapText = (
        parent: d3.Selection<SVGGElement, unknown, null, undefined>,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        fontSize: string,
        fontWeight: string,
        fill: string,
        maxLines: number
      ) => {
        const words = text.split(/\s+/);
        let line = '';
        let lineNumber = 0;
        const lineHeight = parseInt(fontSize) + 3;

        const tempText = parent.append('text')
          .attr('font-size', fontSize)
          .attr('font-weight', fontWeight)
          .style('visibility', 'hidden');

        words.forEach((word) => {
          if (lineNumber >= maxLines) return;
          const testLine = line ? `${line} ${word}` : word;
          tempText.text(testLine);
          const testWidth = tempText.node()?.getComputedTextLength() || 0;

          if (testWidth > maxWidth && line) {
            if (lineNumber === maxLines - 1) {
              // Last allowed line: truncate with ellipsis
              let truncated = line;
              tempText.text(truncated + '...');
              while ((tempText.node()?.getComputedTextLength() || 0) > maxWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
                tempText.text(truncated + '...');
              }
              parent.append('text')
                .attr('x', x).attr('y', y + lineNumber * lineHeight)
                .attr('font-size', fontSize).attr('font-weight', fontWeight).attr('fill', fill)
                .text(truncated + '...');
            } else {
              parent.append('text')
                .attr('x', x).attr('y', y + lineNumber * lineHeight)
                .attr('font-size', fontSize).attr('font-weight', fontWeight).attr('fill', fill)
                .text(line);
            }
            lineNumber++;
            line = word;
          } else {
            line = testLine;
          }
        });

        if (line && lineNumber < maxLines) {
          parent.append('text')
            .attr('x', x).attr('y', y + lineNumber * lineHeight)
            .attr('font-size', fontSize).attr('font-weight', fontWeight).attr('fill', fill)
            .text(line);
        }

        tempText.remove();
      };

      // Title (multi-line, up to 2 lines) — font size scales with title length
      const titleMaxWidth = node.width - badgeWidth - 36;
      const titleLen = node.stream.title.length;
      const titleFontSize = titleLen <= 15 ? '16px' : titleLen <= 30 ? '14px' : '13px';
      wrapText(nodeGroup, node.stream.title, 16, 20, titleMaxWidth, titleFontSize, '600', '#292524', 3);

      // Description preview (multi-line, up to 2 lines)
      if (node.stream.description) {
        wrapText(nodeGroup, node.stream.description, 16, 48, node.width - 32, '11px', '400', '#78716c', 2);
      }

      // Children count
      if (node.stream.children.length > 0) {
        nodeGroup
          .append('text')
          .attr('x', 16)
          .attr('y', node.height - 12)
          .attr('font-size', '10px')
          .attr('fill', '#a8a29e')
          .text(`${node.stream.children.length} branch${node.stream.children.length > 1 ? 'es' : ''}`);
      }

      // Dependency tags (bottom-left, compact pills)
      const deps = node.stream.dependencies || [];
      if (deps.length > 0) {
        const maxVisible = 3;
        const visibleDeps = deps.slice(0, maxVisible);
        const overflow = deps.length - maxVisible;
        let depX = node.stream.children.length > 0 ? 16 + (`${node.stream.children.length} branch${node.stream.children.length > 1 ? 'es' : ''}`.length * 6) + 12 : 16;

        visibleDeps.forEach((dep) => {
          const pillWidth = dep.length * 6 + 12;
          const pillGroup = nodeGroup
            .append('g')
            .attr('transform', `translate(${depX}, ${node.height - 26})`);

          pillGroup
            .append('rect')
            .attr('width', pillWidth)
            .attr('height', 16)
            .attr('rx', 8)
            .attr('fill', '#8b5cf6')
            .attr('opacity', 0.15);

          pillGroup
            .append('text')
            .attr('x', pillWidth / 2)
            .attr('y', 11.5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('font-weight', '500')
            .attr('fill', '#7c3aed')
            .text(dep);

          depX += pillWidth + 4;
        });

        if (overflow > 0) {
          const overflowText = `+${overflow}`;
          const overflowWidth = overflowText.length * 6 + 10;
          const overflowGroup = nodeGroup
            .append('g')
            .attr('transform', `translate(${depX}, ${node.height - 26})`);

          overflowGroup
            .append('rect')
            .attr('width', overflowWidth)
            .attr('height', 16)
            .attr('rx', 8)
            .attr('fill', '#8b5cf6')
            .attr('opacity', 0.1);

          overflowGroup
            .append('text')
            .attr('x', overflowWidth / 2)
            .attr('y', 11.5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('font-weight', '500')
            .attr('fill', '#a78bfa')
            .text(overflowText);
        }
      }

      // Tooltip on hover
      const tooltipContent = [
        node.stream.title,
        node.stream.description || '',
        `Status: ${statusLabels[node.stream.status]} | Type: ${typeLabels[node.stream.source_type]}`,
        deps.length > 0 ? `Dependencies: ${deps.join(', ')}` : '',
      ].filter(Boolean).join('\n');

      nodeGroup.append('title').text(tooltipContent);

      // Connection handle (only if status is not 'done')
      if (node.stream.status !== 'done' && onCreateChildSlice) {
        const handleRadius = 8;
        const handleX = node.width;
        const handleY = node.height / 2;

        // Handle circle
        const handle = nodeGroup
          .append('circle')
          .attr('cx', handleX)
          .attr('cy', handleY)
          .attr('r', handleRadius)
          .attr('fill', '#FF5A00')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('cursor', 'crosshair')
          .attr('class', 'connection-handle');

        // Hover effect
        handle
          .on('mouseenter', function() {
            d3.select(this).attr('r', handleRadius + 2).attr('fill', '#E04E00');
          })
          .on('mouseleave', function() {
            d3.select(this).attr('r', handleRadius).attr('fill', '#FF5A00');
          });

        // Drag behavior for creating connections
        let connectionStartX = 0;
        let connectionStartY = 0;
        let releasePosition = { x: 0, y: 0 };

        const placeholderWidth = 200;
        const placeholderHeight = 80;

        const handleDrag = d3.drag<SVGCircleElement, unknown>()
          .on('start', (event) => {
            event.sourceEvent.stopPropagation();

            // Store start position (right edge of node)
            connectionStartX = adjustedPos.x + handleX;
            connectionStartY = adjustedPos.y + handleY;

            // Get main group dynamically
            const mainGroup = d3.select(svgRef.current).select('.main-group');

            // Create temporary curved path
            mainGroup.append('path')
              .attr('class', 'temp-connection-line')
              .attr('d', linkGenerator({
                source: [connectionStartX, connectionStartY],
                target: [connectionStartX, connectionStartY],
              }))
              .attr('fill', 'none')
              .attr('stroke', '#FF5A00')
              .attr('stroke-width', 2)
              .attr('stroke-dasharray', '5,5');

            // Create placeholder box
            const placeholderGroup = mainGroup
              .append('g')
              .attr('class', 'temp-placeholder')
              .attr('transform', `translate(${connectionStartX}, ${connectionStartY - placeholderHeight / 2})`);

            placeholderGroup
              .append('rect')
              .attr('width', placeholderWidth)
              .attr('height', placeholderHeight)
              .attr('rx', 8)
              .attr('fill', '#FFF5ED')
              .attr('stroke', '#FF5A00')
              .attr('stroke-width', 2)
              .attr('stroke-dasharray', '5,5')
              .attr('opacity', 0.7);

            placeholderGroup
              .append('text')
              .attr('x', placeholderWidth / 2)
              .attr('y', placeholderHeight / 2)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', '12px')
              .attr('fill', '#FF5A00')
              .text('New Stream...');
          })
          .on('drag', (event) => {
            event.sourceEvent.preventDefault();

            // Get SVG element bounds
            const svgRect = svgRef.current?.getBoundingClientRect();
            if (!svgRect) return;

            // Calculate mouse position relative to the transformed group
            const mouseX = (event.sourceEvent.clientX - svgRect.left - pan.x) / zoom;
            const mouseY = (event.sourceEvent.clientY - svgRect.top - pan.y) / zoom;

            // Store release position (top-left of placeholder)
            releasePosition = { x: mouseX, y: mouseY - placeholderHeight / 2 };

            // Update curved path to follow cursor (connect to left edge of placeholder)
            d3.select(svgRef.current).select('.temp-connection-line')
              .attr('d', linkGenerator({
                source: [connectionStartX, connectionStartY],
                target: [mouseX, mouseY],
              }));

            // Update placeholder position
            d3.select(svgRef.current).select('.temp-placeholder')
              .attr('transform', `translate(${mouseX}, ${mouseY - placeholderHeight / 2})`);
          })
          .on('end', () => {
            // Remove temporary elements
            d3.select(svgRef.current).select('.temp-connection-line').remove();
            d3.select(svgRef.current).select('.temp-placeholder').remove();

            // Create child slice at release position
            onCreateChildSlice(node.id, releasePosition);
          });

        handle.call(handleDrag);
      }
    });

    // Setup canvas drag behavior (for panning)
    const canvasDrag = d3.drag<SVGSVGElement, unknown>()
      .filter((event) => {
        // Only allow canvas drag if clicking on the background
        return event.target === svgRef.current;
      })
      .on('drag', handleCanvasDrag);
    svg.call(canvasDrag);

    // Render pending slice placeholder
    if (pendingSlice) {
      const parentNode = layout.nodes.find(n => n.id === pendingSlice.parentId);
      if (parentNode) {
        const parentAdjusted = getAdjustedPosition(parentNode.id, parentNode.x, parentNode.y);
        const placeholderX = pendingSlice.position.x;
        const placeholderY = pendingSlice.position.y;
        const placeholderWidth = 200;
        const placeholderHeight = 80;

        // Draw connection line to placeholder
        const sourceX = parentAdjusted.x + parentNode.width;
        const sourceY = parentAdjusted.y + parentNode.height / 2;
        const targetX = placeholderX;
        const targetY = placeholderY + placeholderHeight / 2;

        g.append('path')
          .attr('class', 'pending-connection-line')
          .attr('d', linkGenerator({
            source: [sourceX, sourceY],
            target: [targetX, targetY],
          }))
          .attr('fill', 'none')
          .attr('stroke', '#FF5A00')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5');

        // Draw placeholder box
        const placeholderGroup = g
          .append('g')
          .attr('transform', `translate(${placeholderX}, ${placeholderY})`)
          .attr('class', 'pending-placeholder');

        // Placeholder background with dashed border
        placeholderGroup
          .append('rect')
          .attr('width', placeholderWidth)
          .attr('height', placeholderHeight)
          .attr('rx', 8)
          .attr('fill', '#FFF5ED')
          .attr('stroke', '#FF5A00')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5')
          .attr('opacity', 0.8);

        // Placeholder text
        placeholderGroup
          .append('text')
          .attr('x', placeholderWidth / 2)
          .attr('y', placeholderHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '12px')
          .attr('fill', '#FF5A00')
          .text('New Stream...');
      }
    }

  }, [layout, zoom, pan, selectedStreamId, onSelectStream, handleCanvasDrag, nodeOffsets, onUpdateStreamPosition, onCreateChildSlice, pendingSlice, focusedNodeIds]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden bg-stone-50 dark:bg-stone-950">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ minHeight: layout.height, minWidth: layout.width }}
      />
    </div>
  );
});
