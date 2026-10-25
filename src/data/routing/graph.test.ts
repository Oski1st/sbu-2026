import { expect, test } from 'vitest';
import { createGraph } from './graph';
import type { ConceptEdge } from './graph';
import { cities, getConceptEdges } from '../eastCoast';

import { reference } from './reference';

test('heap matches independent reference paths for every sample pair/profile', () => {
  const nodes = cities.map(city => city.id);
  for (const profile of ['AMTRAK', 'GREYHOUND', 'FLIXBUS'] as const) {
    const edges = getConceptEdges(profile), graph = createGraph(nodes, edges);
    for (const a of nodes) for (const b of nodes) expect(graph.path(a, b)).toEqual(reference(nodes, edges, a, b));
  }
});

test('disconnected, zero-weight, parallel, tie and stale-heap paths are correct', () => {
  const nodes = ['a', 'b', 'c', 'd', 'isolated'];
  const edge = (from: string, to: string, minutes: number): ConceptEdge => ({ from, to, minutes, agency: 'AMTRAK', line: 'test' });
  const edges = [edge('a','b',9),edge('a','c',0),edge('c','b',1),edge('b','d',0),edge('c','d',1),edge('a','b',2)];
  const graph = createGraph(nodes, edges);
  for (const a of nodes) for (const b of nodes) expect(graph.path(a,b)).toEqual(reference(nodes,edges,a,b));
  expect(graph.path('unknown','a')).toBeUndefined();
  const path = graph.path('a','d')!; path[0].minutes = 999;
  expect(graph.path('a','d')![0].minutes).toBe(0);
  for (const minutes of [-1, NaN, Infinity]) expect(() => createGraph(nodes,[edge('a','b',minutes)])).toThrow();
  expect(() => createGraph(nodes,[edge('missing','a',1)])).toThrow();
});
