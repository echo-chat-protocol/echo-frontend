import { describe, expect, it } from 'vitest';

import {
  copath,
  directPath,
  leafNode,
  left,
  level,
  nodeWidth,
  parent,
  resolution,
  right,
  root,
  sibling,
} from '../treemath.js';

describe('treemath level', () => {
  it('computes the number of trailing 1 bits', () => {
    expect(level(0)).toBe(0);
    expect(level(1)).toBe(1);
    expect(level(2)).toBe(0);
    expect(level(3)).toBe(2);
    expect(level(7)).toBe(3);
    expect(level(11)).toBe(2);
  });
});

describe('treemath node sizing', () => {
  it('computes node width for left-balanced trees', () => {
    expect(nodeWidth(0)).toBe(0);
    expect(nodeWidth(1)).toBe(1);
    expect(nodeWidth(4)).toBe(7);
  });

  it('computes the root index', () => {
    expect(root(1)).toBe(0);
    expect(root(2)).toBe(1);
    expect(root(4)).toBe(3);
    expect(root(5)).toBe(7);
  });

  it('maps leaf indices to even tree indices', () => {
    expect(leafNode(0)).toBe(0);
    expect(leafNode(1)).toBe(2);
    expect(leafNode(2)).toBe(4);
  });
});

describe('treemath child navigation', () => {
  it('returns the left child of internal nodes', () => {
    expect(left(1)).toBe(0);
    expect(left(3)).toBe(1);
    expect(left(5)).toBe(4);
  });

  it('returns the right child of internal nodes, including virtual children', () => {
    expect(right(1)).toBe(2);
    expect(right(3)).toBe(5);
    expect(right(5)).toBe(6);
    expect(right(3)).toBeGreaterThanOrEqual(nodeWidth(3));
  });

  it('throws for leaf children lookups', () => {
    expect(() => left(0)).toThrow(RangeError);
    expect(() => right(2)).toThrow(RangeError);
  });
});

describe('treemath parent and sibling navigation', () => {
  it('returns parents in a full tree', () => {
    expect(parent(0, 4)).toBe(1);
    expect(parent(2, 4)).toBe(1);
    expect(parent(4, 4)).toBe(5);
    expect(parent(6, 4)).toBe(5);
    expect(parent(1, 4)).toBe(3);
    expect(parent(3, 4)).toBe(3);
  });

  it('skips virtual nodes when computing parents in non-power-of-2 trees', () => {
    expect(parent(0, 3)).toBe(1);
    expect(parent(2, 3)).toBe(1);
    expect(parent(4, 3)).toBe(3);
    expect(parent(3, 3)).toBe(3);
  });

  it('returns siblings in full trees and virtual siblings when needed', () => {
    expect(sibling(0, 4)).toBe(2);
    expect(sibling(2, 4)).toBe(0);
    expect(sibling(1, 4)).toBe(5);
    expect(sibling(5, 4)).toBe(1);
    expect(sibling(3, 4)).toBe(3);
    expect(sibling(1, 3)).toBe(5);
  });
});

describe('treemath paths', () => {
  it('returns the direct path from a node to the root', () => {
    expect(directPath(0, 4)).toEqual([1, 3]);
    expect(directPath(2, 4)).toEqual([1, 3]);
    expect(directPath(4, 4)).toEqual([5, 3]);
    expect(directPath(4, 3)).toEqual([3]);
    expect(directPath(3, 4)).toEqual([]);
  });

  it('returns the copath for each node on the direct path', () => {
    expect(copath(0, 4)).toEqual([2, 5]);
    expect(copath(2, 4)).toEqual([0, 5]);
    expect(copath(4, 4)).toEqual([6, 1]);
    expect(copath(4, 3)).toEqual([1]);
    expect(copath(3, 4)).toEqual([]);
  });
});

describe('treemath resolution', () => {
  it('returns a non-blank real node as its own resolution', () => {
    const nodes = [];
    nodes[2] = { publicKeyB64: 'leaf-2' };
    nodes[5] = { publicKeyB64: 'node-5' };

    expect(resolution(nodes, 2, 4)).toEqual([2]);
    expect(resolution(nodes, 5, 4)).toEqual([5]);
  });

  it('returns an empty resolution for blank leaves', () => {
    expect(resolution([], 0, 4)).toEqual([]);
    expect(resolution([], 6, 4)).toEqual([]);
  });

  it('expands blank internal nodes into the minimal non-blank descendants', () => {
    const nodes = [];
    nodes[2] = { publicKeyB64: 'leaf-2' };
    nodes[4] = { publicKeyB64: 'leaf-4' };

    expect(resolution(nodes, 1, 4)).toEqual([2]);
    expect(resolution(nodes, 5, 4)).toEqual([4]);
    expect(resolution(nodes, 3, 4)).toEqual([2, 4]);
  });

  it('expands virtual nodes through their children', () => {
    const nodes = [];
    nodes[4] = { publicKeyB64: 'leaf-4' };

    expect(resolution(nodes, 5, 3)).toEqual([4]);
    expect(resolution(nodes, 6, 3)).toEqual([]);
  });
});
