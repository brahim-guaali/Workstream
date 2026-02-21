import { useState, useCallback, useMemo } from 'react';
import type { StreamWithChildren } from '../types/database';

export interface VisualizationConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  padding: number;
}

const defaultConfig: VisualizationConfig = {
  nodeWidth: 320,
  nodeHeight: 100,
  horizontalSpacing: 60,
  verticalSpacing: 40,
  padding: 40,
};

export interface TreeNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stream: StreamWithChildren;
  parentId: string | null;
}

export interface TreeLink {
  sourceId: string;
  targetId: string;
  sourcex: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export function useVisualization(
  streamTree: StreamWithChildren[],
  config: Partial<VisualizationConfig> = {}
) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const mergedConfig = useMemo(() => ({ ...defaultConfig, ...config }), [config]);

  const calculateTreeLayout = useCallback(
    (tree: StreamWithChildren[]): { nodes: TreeNode[]; links: TreeLink[]; width: number; height: number } => {
      const nodes: TreeNode[] = [];
      const links: TreeLink[] = [];
      let maxX = 0;
      let maxY = 0;

      const processNode = (
        node: StreamWithChildren,
        depth: number,
        siblingIndex: number,
        parentNode: TreeNode | null
      ): number => {
        const x = depth * (mergedConfig.nodeWidth + mergedConfig.horizontalSpacing) + mergedConfig.padding;
        let y = siblingIndex * (mergedConfig.nodeHeight + mergedConfig.verticalSpacing) + mergedConfig.padding;

        // Process children first to calculate proper Y positioning
        let childYOffset = siblingIndex;
        if (node.children.length > 0) {
          node.children.forEach((child) => {
            childYOffset = processNode(child, depth + 1, childYOffset, null);
          });
          // Center parent among children
          const firstChildY = nodes.find((n) => n.id === node.children[0].id)?.y || y;
          const lastChildY = nodes.find((n) => n.id === node.children[node.children.length - 1].id)?.y || y;
          y = (firstChildY + lastChildY) / 2;
        }

        const treeNode: TreeNode = {
          id: node.id,
          x,
          y,
          width: mergedConfig.nodeWidth,
          height: mergedConfig.nodeHeight,
          stream: node,
          parentId: parentNode?.id || node.parent_stream_id,
        };

        nodes.push(treeNode);
        maxX = Math.max(maxX, x + mergedConfig.nodeWidth);
        maxY = Math.max(maxY, y + mergedConfig.nodeHeight);

        // Create link to parent
        if (parentNode) {
          links.push({
            sourceId: parentNode.id,
            targetId: node.id,
            sourcex: parentNode.x + mergedConfig.nodeWidth,
            sourceY: parentNode.y + mergedConfig.nodeHeight / 2,
            targetX: x,
            targetY: y + mergedConfig.nodeHeight / 2,
          });
        }

        return node.children.length > 0 ? childYOffset : siblingIndex + 1;
      };

      // Process root nodes
      let rootOffset = 0;
      tree.forEach((rootNode) => {
        rootOffset = processNode(rootNode, 0, rootOffset, null);
      });

      // Create links after all nodes are positioned
      nodes.forEach((node) => {
        if (node.parentId) {
          const parentNode = nodes.find((n) => n.id === node.parentId);
          if (parentNode) {
            links.push({
              sourceId: parentNode.id,
              targetId: node.id,
              sourcex: parentNode.x + mergedConfig.nodeWidth,
              sourceY: parentNode.y + mergedConfig.nodeHeight / 2,
              targetX: node.x,
              targetY: node.y + mergedConfig.nodeHeight / 2,
            });
          }
        }
      });

      return {
        nodes,
        links: [...new Map(links.map((l) => [`${l.sourceId}-${l.targetId}`, l])).values()],
        width: maxX + mergedConfig.padding,
        height: maxY + mergedConfig.padding,
      };
    },
    [mergedConfig]
  );

  const layout = useMemo(() => calculateTreeLayout(streamTree), [streamTree, calculateTreeLayout]);

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    layout,
    config: mergedConfig,
  };
}
