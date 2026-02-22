import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, X, Crosshair, Lock, Unlock } from 'lucide-react';
import type { StreamWithChildren } from '../../types/database';
import { useVisualization } from '../../hooks/useVisualization';
import { statusHexColors, sourceTypeHexColors, statusIcons, statusLabels, sourceTypeLabels } from '../../lib/streamConfig';

interface StreamTreeProps {
  streamTree: StreamWithChildren[];
  selectedStreamId: string | null;
  onSelectStream: (stream: StreamWithChildren) => void;
  onUpdateStreamPosition?: (id: string, x: number, y: number) => Promise<void>;
  onCreateChildSlice?: (parentId: string, position: { x: number; y: number }) => void;
  pendingSlice?: { parentId: string; position: { x: number; y: number } } | null;
  focusedStreamId?: string | null;
  onExitFocus?: () => void;
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
  focusedStreamId,
  onExitFocus,
}, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { layout, zoom, pan, setPan, setZoom } = useVisualization(streamTree);
  const [freePan, setFreePan] = useState(false);
  const [dragLocked, setDragLocked] = useState(() => localStorage.getItem('dragLocked') === 'true');
  const dragLockedRef = useRef(false);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const hasInitialFit = useRef(false);
  const lastAutoPannedId = useRef<string | null>(null);

  // Keep ref in sync with state so D3 drag handlers can read it
  dragLockedRef.current = dragLocked;

  // Escape key exits focus mode
  useEffect(() => {
    if (!focusedStreamId || !onExitFocus) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExitFocus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedStreamId, onExitFocus]);

  // Find focused stream title for banner
  const findStreamTitle = useCallback((nodes: StreamWithChildren[], id: string): string | null => {
    for (const node of nodes) {
      if (node.id === id) return node.title;
      const found = findStreamTitle(node.children, id);
      if (found) return found;
    }
    return null;
  }, []);
  const focusedStreamTitle = focusedStreamId ? findStreamTitle(streamTree, focusedStreamId) : null;

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

  // Keep refs for auto-pan so the effect only fires on selectedStreamId changes
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const nodeOffsetsRef = useRef(nodeOffsets);
  nodeOffsetsRef.current = nodeOffsets;

  // Animated view transition — easeOutCubic over a given duration
  const animRef = useRef<number>(0);
  const animateViewTo = useCallback((targetX: number, targetY: number, targetZoom?: number, duration = 300) => {
    cancelAnimationFrame(animRef.current);
    const startX = panRef.current.x;
    const startY = panRef.current.y;
    const startZoom = zoomRef.current;
    const endZoom = targetZoom ?? startZoom;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setPan({
        x: startX + (targetX - startX) * ease,
        y: startY + (targetY - startY) * ease,
      });
      if (endZoom !== startZoom) {
        setZoom(startZoom + (endZoom - startZoom) * ease);
      }
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      }
    };
    animRef.current = requestAnimationFrame(step);
  }, [setPan, setZoom]);

  // Animated zoom-only helper (keeps current pan)
  const animateZoomTo = useCallback((target: number, duration = 200) => {
    animateViewTo(panRef.current.x, panRef.current.y, target, duration);
  }, [animateViewTo]);

  // Wheel zoom: accumulate a target and animate toward cursor position
  const wheelZoomTarget = useRef(zoom);
  wheelZoomTarget.current = zoom; // stay in sync when not wheeling
  const wheelAnimRef = useRef<number>(0);
  const handleWheelZoom = useCallback((deltaY: number, cursorX: number, cursorY: number) => {
    const delta = -deltaY * 0.001;
    wheelZoomTarget.current = Math.min(3, Math.max(0.2, wheelZoomTarget.current + delta));
    cancelAnimationFrame(wheelAnimRef.current);
    const startZoom = zoomRef.current;
    const startPan = { ...panRef.current };
    const endZoom = wheelZoomTarget.current;
    // Compute target pan so the world point under the cursor stays fixed
    const endPanX = cursorX - (cursorX - startPan.x) * (endZoom / startZoom);
    const endPanY = cursorY - (cursorY - startPan.y) * (endZoom / startZoom);
    const duration = 150;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setZoom(startZoom + (endZoom - startZoom) * ease);
      setPan({
        x: startPan.x + (endPanX - startPan.x) * ease,
        y: startPan.y + (endPanY - startPan.y) * ease,
      });
      if (t < 1) {
        wheelAnimRef.current = requestAnimationFrame(step);
      }
    };
    wheelAnimRef.current = requestAnimationFrame(step);
  }, [setZoom, setPan]);

  // Fit all nodes in the viewport
  const fitAll = useCallback(() => {
    if (!containerRef.current || layout.nodes.length === 0) return;

    // Merge saved initial offsets with any live drag offsets so the bounding
    // box is correct even when called before the offset state has been flushed.
    const savedOffsets = getInitialOffsets();
    const liveOffsets = nodeOffsetsRef.current;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of layout.nodes) {
      const off = liveOffsets[node.id] || savedOffsets[node.id] || { x: 0, y: 0 };
      const nx = node.x + off.x;
      const ny = node.y + off.y;
      minX = Math.min(minX, nx);
      minY = Math.min(minY, ny);
      maxX = Math.max(maxX, nx + node.width);
      maxY = Math.max(maxY, ny + node.height);
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 60;
    const availW = rect.width - padding * 2;
    const availH = rect.height - padding * 2;

    const newZoom = Math.min(Math.min(availW / contentW, availH / contentH), 3);
    const clampedZoom = Math.max(newZoom, 0.2);
    const newPanX = (rect.width - contentW * clampedZoom) / 2 - minX * clampedZoom;
    const newPanY = (rect.height - contentH * clampedZoom) / 2 - minY * clampedZoom;

    animateViewTo(newPanX, newPanY, clampedZoom);
  }, [layout.nodes, getInitialOffsets, animateViewTo]);

  useImperativeHandle(ref, () => ({
    resetView: () => fitAll(),
  }), [fitAll]);

  // Fit all nodes into view on initial load
  useEffect(() => {
    if (hasInitialFit.current || layout.nodes.length === 0 || !containerRef.current) return;
    hasInitialFit.current = true;
    // Wait one frame so the container has its final size
    requestAnimationFrame(() => fitAll());
  }, [layout.nodes, fitAll]);

  // Auto-pan to keep the selected node fully visible when a NEW stream is selected.
  // Once auto-panned, manual user pan/zoom is not overridden.
  useEffect(() => {
    if (!selectedStreamId || !containerRef.current) return;
    // Only auto-pan when the selection actually changes
    if (lastAutoPannedId.current === selectedStreamId) return;
    lastAutoPannedId.current = selectedStreamId;

    const node = layout.nodes.find((n) => n.id === selectedStreamId);
    if (!node) return;

    // Wait two frames: first for React render (sidebar appears), second for browser layout
    const rafId = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const curPan = panRef.current;
      const curZoom = zoomRef.current;
      const savedOffsets = getInitialOffsets();
      const liveOffsets = nodeOffsetsRef.current;
      const offset = liveOffsets[selectedStreamId] || savedOffsets[selectedStreamId] || { x: 0, y: 0 };

      const nodeX = node.x + offset.x;
      const nodeY = node.y + offset.y;

      // Node bounds in screen (pixel) coordinates
      const screenLeft = curPan.x + nodeX * curZoom;
      const screenRight = curPan.x + (nodeX + node.width) * curZoom;
      const screenTop = curPan.y + nodeY * curZoom;
      const screenBottom = curPan.y + (nodeY + node.height) * curZoom;

      const rect = containerRef.current!.getBoundingClientRect();
      const viewW = rect.width;
      const viewH = rect.height;
      const margin = 40;

      // Compute minimal pan adjustment to bring the node fully into view
      let dx = 0;
      let dy = 0;
      if (screenLeft < margin) dx = margin - screenLeft;
      else if (screenRight > viewW - margin) dx = (viewW - margin) - screenRight;
      if (screenTop < margin) dy = margin - screenTop;
      else if (screenBottom > viewH - margin) dy = (viewH - margin) - screenBottom;

      if (dx !== 0 || dy !== 0) {
        animateViewTo(curPan.x + dx, curPan.y + dy);
      }
    }));

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [selectedStreamId, layout.nodes, getInitialOffsets, animateViewTo]);

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

    // In focus mode, compute a straight-line override for Y positions
    // Main chain sits on one horizontal line; collapsed placeholders offset below
    const focusYOverrides: Record<string, number> = {};
    if (focusedStreamId) {
      const mainY = 100; // consistent Y for the main chain
      const collapsedOffsetY = 120; // collapsed nodes sit below the main line
      for (const node of layout.nodes) {
        if (node.stream._collapsed) {
          focusYOverrides[node.id] = mainY + collapsedOffsetY;
        } else {
          focusYOverrides[node.id] = mainY;
        }
      }
    }

    // Calculate adjusted positions with offsets (ignored in focus mode)
    const getAdjustedPosition = (nodeId: string, baseX: number, baseY: number) => {
      if (focusedStreamId && focusYOverrides[nodeId] !== undefined) {
        return { x: baseX, y: focusYOverrides[nodeId] };
      }
      return {
        x: baseX + (nodeOffsets[nodeId]?.x || 0),
        y: baseY + (nodeOffsets[nodeId]?.y || 0),
      };
    };

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

      // Calculate link anchor points, adjusting for collapsed nodes
      const collapsedW = 160;
      const sourceIsCollapsed = !!sourceNode.stream._collapsed;
      const targetIsCollapsed = !!targetNode.stream._collapsed;

      const sourceX = sourceIsCollapsed
        ? sourceAdjusted.x + (sourceNode.width + collapsedW) / 2
        : sourceAdjusted.x + sourceNode.width;
      const sourceY = sourceAdjusted.y + sourceNode.height / 2;
      const targetX = targetIsCollapsed
        ? targetAdjusted.x + (targetNode.width - collapsedW) / 2
        : targetAdjusted.x;
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

      // Collapsed placeholder — render and skip everything else
      if (node.stream._collapsed) {
        const collapsedW = 160;
        const collapsedH = 50;
        const offsetX = (node.width - collapsedW) / 2;
        const offsetY = (node.height - collapsedH) / 2;

        const collapsedGroup = g
          .append('g')
          .attr('transform', `translate(${adjustedPos.x}, ${adjustedPos.y})`)
          .attr('data-node-id', node.id)
          .style('cursor', 'pointer');

        collapsedGroup
          .append('rect')
          .attr('x', offsetX)
          .attr('y', offsetY)
          .attr('width', collapsedW)
          .attr('height', collapsedH)
          .attr('rx', 8)
          .attr('fill', '#fafaf9')
          .attr('stroke', '#d6d3d1')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6,3');

        collapsedGroup
          .append('text')
          .attr('x', offsetX + collapsedW / 2)
          .attr('y', offsetY + collapsedH / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '13px')
          .attr('font-weight', '500')
          .attr('fill', '#a8a29e')
          .text(node.stream.title);

        collapsedGroup.on('click', (event: MouseEvent) => {
          event.stopPropagation();
          if (onExitFocus) onExitFocus();
        });

        return; // skip drag, badges, handle, etc.
      }

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

          // When drag is locked, ignore all drag movement
          if (dragLockedRef.current) return;

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
            setFreePan(false);
            lastMousePos.current = null;
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
      const typeLabel = sourceTypeLabels[node.stream.source_type];
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

      // Dependency tags (bottom-left, compact pills — stop before the type badge)
      const deps = node.stream.dependencies || [];
      if (deps.length > 0) {
        // Generate a stable hue from a string so each dependency name gets a unique color
        const depHue = (s: string) => {
          let h = 0;
          for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
          return Math.abs(h) % 360;
        };
        const maxDepX = node.width - typeBadgeWidth - 20; // leave gap before type badge
        let depX = 16;
        let rendered = 0;

        for (const dep of deps) {
          const pillWidth = dep.length * 6 + 12;
          if (depX + pillWidth > maxDepX) break;

          const hue = depHue(dep);
          const bgColor = `hsl(${hue}, 70%, 92%)`;
          const fgColor = `hsl(${hue}, 60%, 35%)`;

          const pillGroup = nodeGroup
            .append('g')
            .attr('transform', `translate(${depX}, ${node.height - 26})`);

          pillGroup
            .append('rect')
            .attr('width', pillWidth)
            .attr('height', 16)
            .attr('rx', 8)
            .attr('fill', bgColor);

          pillGroup
            .append('text')
            .attr('x', pillWidth / 2)
            .attr('y', 11.5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('font-weight', '500')
            .attr('fill', fgColor)
            .text(dep);

          depX += pillWidth + 4;
          rendered++;
        }

        const overflow = deps.length - rendered;
        if (overflow > 0) {
          const overflowText = `+${overflow}`;
          const overflowWidth = overflowText.length * 6 + 10;
          if (depX + overflowWidth <= maxDepX) {
            const overflowGroup = nodeGroup
              .append('g')
              .attr('transform', `translate(${depX}, ${node.height - 26})`);

            overflowGroup
              .append('rect')
              .attr('width', overflowWidth)
              .attr('height', 16)
              .attr('rx', 8)
              .attr('fill', '#e7e5e4');

            overflowGroup
              .append('text')
              .attr('x', overflowWidth / 2)
              .attr('y', 11.5)
              .attr('text-anchor', 'middle')
              .attr('font-size', '9px')
              .attr('font-weight', '500')
              .attr('fill', '#78716c')
              .text(overflowText);
          }
        }
      }

      // Tooltip on hover
      const tooltipContent = [
        node.stream.title,
        node.stream.description || '',
        `Status: ${statusLabels[node.stream.status]} | Type: ${sourceTypeLabels[node.stream.source_type]}`,
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

    // Wheel / trackpad: pinch-to-zoom (ctrlKey) zooms, two-finger scroll pans
    // Listen on container (not SVG) so events are caught even if SVG layout is odd
    const svgEl = svgRef.current;
    const container = containerRef.current!;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+scroll → zoom toward cursor
        // Trackpad pinch sends small deltaY (~1-10); mouse wheel sends large (~100+)
        // Boost small deltas so trackpad pinch feels responsive
        const boosted = Math.abs(e.deltaY) < 20 ? -e.deltaY * 8 : e.deltaY;
        const rect = container.getBoundingClientRect();
        handleWheelZoom(boosted, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        // Two-finger scroll → pan
        setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Any click disables free pan
    const handleClick = () => {
      if (freePan) {
        setFreePan(false);
        lastMousePos.current = null;
      }
    };
    svgEl.addEventListener('mousedown', handleClick);

    // Free-pan: move canvas by moving the mouse (no click needed)
    const handleMouseMove = (e: MouseEvent) => {
      if (!freePan) return;
      if (lastMousePos.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseLeave = () => {
      lastMousePos.current = null;
    };
    svgEl.addEventListener('mousemove', handleMouseMove);
    svgEl.addEventListener('mouseleave', handleMouseLeave);

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

    return () => {
      container.removeEventListener('wheel', handleWheel);
      svgEl.removeEventListener('mousedown', handleClick);
      svgEl.removeEventListener('mousemove', handleMouseMove);
      svgEl.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [layout, zoom, pan, selectedStreamId, onSelectStream, handleCanvasDrag, nodeOffsets, onUpdateStreamPosition, onCreateChildSlice, pendingSlice, focusedNodeIds, freePan, setZoom, setPan, onExitFocus, focusedStreamId, handleWheelZoom]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-stone-50 dark:bg-stone-950" style={{ touchAction: 'none' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor: freePan ? 'move' : undefined }}
      />

      {/* Focus banner */}
      {focusedStreamId && focusedStreamTitle && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full shadow-lg px-4 py-1.5 text-sm">
          <span className="text-stone-500 dark:text-stone-400">Focused on:</span>
          <span className="font-medium text-stone-900 dark:text-stone-100">{focusedStreamTitle}</span>
          <button
            onClick={onExitFocus}
            className="p-0.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            title="Exit focus"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}


      {/* Zoom & pan controls */}
      <div className="absolute top-4 right-4 md:top-auto md:bottom-4 flex items-center gap-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg p-1">
        <button
          onClick={() => animateZoomTo(Math.min(3, zoomRef.current + 0.15))}
          className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-stone-500 dark:text-stone-400 w-10 text-center select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => animateZoomTo(Math.max(0.2, zoomRef.current - 0.15))}
          className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-stone-200 dark:bg-stone-700 mx-0.5" />
        <button
          onClick={() => setDragLocked((v) => {
            const next = !v;
            localStorage.setItem('dragLocked', String(next));
            return next;
          })}
          className={`p-2 rounded-lg transition-colors ${
            dragLocked
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
              : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300'
          }`}
          title={dragLocked ? 'Unlock node dragging' : 'Lock node positions'}
        >
          {dragLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
        <div className="w-px h-5 bg-stone-200 dark:bg-stone-700 mx-0.5" />
        <button
          onClick={fitAll}
          className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
          title="Recenter view"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
