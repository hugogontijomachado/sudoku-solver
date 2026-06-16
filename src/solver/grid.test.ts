import { describe, it, expect } from 'vitest';
import {
  parseGrid, gridToString, renderGridText, PEERS, UNITS, findConflicts, combinations,
} from './grid';

describe('grid', () => {
  it('parses an 81-char string, ignoring separators', () => {
    const g = parseGrid('1'.padEnd(81, '.'));
    expect(g[0][0]).toBe(1);
    expect(g[8][8]).toBe(0);
    expect(gridToString(g)).toBe('1'.padEnd(81, '0'));
  });

  it('throws when the cell count is not 81', () => {
    expect(() => parseGrid('123')).toThrow();
  });

  it('each cell has exactly 20 peers and 3 units', () => {
    expect(PEERS[0]).toHaveLength(20);
    expect(UNITS).toHaveLength(27);
  });

  it('detects duplicate givens in a unit', () => {
    const g = parseGrid('11' + '.'.repeat(79));
    expect(findConflicts(g)).toHaveLength(2);
  });

  it('combinations(2 of [a,b,c]) has 3 pairs', () => {
    expect(combinations(['a', 'b', 'c'], 2)).toHaveLength(3);
  });

  it('renderGridText renders separator lines and empty cells as dots', () => {
    const g = parseGrid('.'.repeat(81));
    const text = renderGridText(g);
    expect(text).toContain('------+-------+------');
    expect(text).toContain('.');
  });
});
