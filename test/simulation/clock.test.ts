import { describe, it, expect } from 'bun:test';
import { SimulationClock } from '../../src/simulation/clock.js';

describe('SimulationClock', () => {
  describe('constructor', () => {
    it('starts at day 1, hour 9 by default', () => {
      const clock = new SimulationClock();
      const t = clock.current;
      expect(t.logical_day).toBe(1);
      expect(t.hour).toBe(9);
      expect(t.sprint).toBe(1);
      expect(t.sprint_day).toBe(1);
    });

    it('clamps hour to minimum of 9', () => {
      const clock = new SimulationClock(1, 5);
      expect(clock.current.hour).toBe(9);
    });

    it('clamps hour to maximum of 23', () => {
      const clock = new SimulationClock(1, 25);
      expect(clock.current.hour).toBe(23);
    });
  });

  describe('advance within a day', () => {
    it('advances by hours within work hours', () => {
      const clock = new SimulationClock(1, 9);
      const t = clock.advance(3);
      expect(t.hour).toBe(12);
      expect(t.logical_day).toBe(1);
    });

    it('advances to exactly end of day', () => {
      const clock = new SimulationClock(1, 9);
      const t = clock.advance(8); // 9 + 8 = 17
      expect(t.hour).toBe(17);
      expect(t.logical_day).toBe(1);
    });
  });

  describe('advance past end of day', () => {
    it('rolls to next morning when exceeding work hours', () => {
      const clock = new SimulationClock(1, 15);
      // 2 hours left today (15 -> 17), then 3 more spills into next day
      const t = clock.advance(5);
      expect(t.logical_day).toBe(2);
      expect(t.hour).toBe(12); // 9 + 3
    });

    it('handles multi-day advance', () => {
      const clock = new SimulationClock(1, 9);
      // 8 hours/day. 20 hours = 2 full days + 4 hours into day 3
      const t = clock.advance(20);
      expect(t.logical_day).toBe(3);
      expect(t.hour).toBe(13); // 9 + 4
    });

    it('advances exactly one day for 8 hours from 9am', () => {
      const clock = new SimulationClock(1, 9);
      // 8 hours = rest of day 1. One more = spill into day 2
      const t = clock.advance(9);
      expect(t.logical_day).toBe(2);
      expect(t.hour).toBe(10); // 9 + 1
    });
  });

  describe('advanceToNextMorning', () => {
    it('jumps to next day 9am', () => {
      const clock = new SimulationClock(1, 14);
      const t = clock.advanceToNextMorning();
      expect(t.logical_day).toBe(2);
      expect(t.hour).toBe(9);
    });

    it('increments sprint_day', () => {
      const clock = new SimulationClock(1, 9);
      const t = clock.advanceToNextMorning();
      expect(t.sprint_day).toBe(2);
    });
  });

  describe('sprint boundary detection', () => {
    it('sprint 1 covers days 1-10', () => {
      const clock = new SimulationClock(10, 9);
      expect(clock.current.sprint).toBe(1);
      expect(clock.current.sprint_day).toBe(10);
    });

    it('day 11 starts sprint 2', () => {
      const clock = new SimulationClock(11, 9);
      expect(clock.current.sprint).toBe(2);
      expect(clock.current.sprint_day).toBe(1);
    });

    it('advancing past sprint boundary updates sprint', () => {
      const clock = new SimulationClock(10, 9);
      expect(clock.current.sprint).toBe(1);

      const t = clock.advanceToNextMorning();
      expect(t.sprint).toBe(2);
      expect(t.sprint_day).toBe(1);
    });

    it('day 20 ends sprint 2', () => {
      const clock = new SimulationClock(20, 9);
      expect(clock.current.sprint).toBe(2);
      expect(clock.current.sprint_day).toBe(10);
    });

    it('day 21 starts sprint 3', () => {
      const clock = new SimulationClock(21, 9);
      expect(clock.current.sprint).toBe(3);
      expect(clock.current.sprint_day).toBe(1);
    });
  });

  describe('getElapsedHours', () => {
    it('returns hours within same day', () => {
      const clock = new SimulationClock(1, 14);
      expect(clock.getElapsedHours(1, 9)).toBe(5);
    });

    it('returns hours across days', () => {
      const clock = new SimulationClock(3, 11);
      // Day 1 at 15: 2 hours left (15->17)
      // Day 2: full 8 hours (9->17)
      // Day 3: 2 hours (9->11)
      expect(clock.getElapsedHours(1, 15)).toBe(12);
    });

    it('returns 0 for future time', () => {
      const clock = new SimulationClock(1, 9);
      expect(clock.getElapsedHours(2, 9)).toBe(0);
    });
  });
});
