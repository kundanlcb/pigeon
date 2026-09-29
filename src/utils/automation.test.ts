import { describe, it, expect } from 'vitest';
import { topologicalSort, getFlowExecutionStages } from './automation';
import type { FlowNode, FlowEdge } from '../store';

describe('automation utils', () => {
  const createNode = (id: string): FlowNode => ({
    id,
    type: 'requestNode',
    position: { x: 0, y: 0 },
    data: { requestId: `req-${id}` }
  });

  const createEdge = (source: string, target: string): FlowEdge => ({
    id: `e-${source}-${target}`,
    source,
    target
  });

  describe('topologicalSort', () => {
    it('sorts a linear chain of nodes in dependency order', () => {
      const nodes = [createNode('C'), createNode('A'), createNode('B')];
      const edges = [createEdge('A', 'B'), createEdge('B', 'C')];

      const sorted = topologicalSort(nodes, edges);
      const ids = sorted.map(n => n.id);
      expect(ids).toEqual(['A', 'B', 'C']);
    });
  });

  describe('getFlowExecutionStages', () => {
    it('groups a linear chain into sequential 1-element stages', () => {
      const nodes = [createNode('A'), createNode('B'), createNode('C')];
      const edges = [createEdge('A', 'B'), createEdge('B', 'C')];

      const stages = getFlowExecutionStages(nodes, edges);
      expect(stages.map(s => s.map(n => n.id))).toEqual([
        ['A'],
        ['B'],
        ['C']
      ]);
    });

    it('identifies parallel branch nodes at the same execution stage', () => {
      // Node A branches to B and C, which both merge into D
      // A -> B -> D
      // A -> C -> D
      const nodes = [createNode('D'), createNode('A'), createNode('B'), createNode('C')];
      const edges = [
        createEdge('A', 'B'),
        createEdge('A', 'C'),
        createEdge('B', 'D'),
        createEdge('C', 'D')
      ];

      const stages = getFlowExecutionStages(nodes, edges);
      expect(stages).toHaveLength(3);
      expect(stages[0].map(n => n.id)).toEqual(['A']);
      
      const stage1Ids = stages[1].map(n => n.id).sort();
      expect(stage1Ids).toEqual(['B', 'C']); // B and C run in parallel!
      
      expect(stages[2].map(n => n.id)).toEqual(['D']);
    });

    it('handles multiple root nodes starting simultaneously in parallel', () => {
      // Root A and Root B with no dependencies, both feeding into C
      const nodes = [createNode('A'), createNode('B'), createNode('C')];
      const edges = [createEdge('A', 'C'), createEdge('B', 'C')];

      const stages = getFlowExecutionStages(nodes, edges);
      expect(stages).toHaveLength(2);
      
      const rootIds = stages[0].map(n => n.id).sort();
      expect(rootIds).toEqual(['A', 'B']); // A and B run in parallel in Stage 1!
      expect(stages[1].map(n => n.id)).toEqual(['C']);
    });

    it('handles completely disconnected parallel nodes', () => {
      const nodes = [createNode('X'), createNode('Y'), createNode('Z')];
      const edges: FlowEdge[] = [];

      const stages = getFlowExecutionStages(nodes, edges);
      expect(stages).toHaveLength(1);
      const stage0Ids = stages[0].map(n => n.id).sort();
      expect(stage0Ids).toEqual(['X', 'Y', 'Z']); // All run concurrently
    });
  });
});
