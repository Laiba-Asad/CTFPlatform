import { describe, expect, it } from 'vitest';
import * as shared from './index';
import { compareMissions, missionNumbers } from './missions';

describe('compareMissions', () => {
  it('orders by points ascending, then by id in natural order', () => {
    const list = [
      { id: 'web10', points: 350 },
      { id: 'net1', points: 300 },
      { id: 'web2', points: 200 },
      { id: 'web5', points: 350 },
      { id: 'web14', points: 100 },
      { id: 'web1', points: 100 },
    ];
    expect([...list].sort(compareMissions).map((m) => m.id)).toEqual(['web1', 'web14', 'web2', 'net1', 'web5', 'web10']);
  });

  it('derives 1-based display numbers from that order', () => {
    const numbers = missionNumbers([
      { id: 'web2', points: 200 },
      { id: 'web1', points: 100 },
    ]);
    expect(numbers.get('web1')).toBe(1);
    expect(numbers.get('web2')).toBe(2);
  });
});

describe('shared package', () => {
  it('exports nothing about a difficulty level', () => {
    for (const name of Object.keys(shared)) expect(name.toLowerCase()).not.toContain('difficult');
  });
});
