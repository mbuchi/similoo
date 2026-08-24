import { describe, expect, it } from 'vitest';
import {
  ALL_YEARS,
  DEFAULT_YEARS,
  YEARS_LADDER,
  coerceYearsWindow,
  isAllYears,
  normalizeYearsWindow,
} from './yearsWindow.js';

// The sidebar's years filter is a discrete precision ladder, and the value it
// holds is what goes on the wire to /score/similoo. Two things have to hold at
// once: the unrestricted window must survive as 'all' (the old
// `Number.isFinite(x) ? x : 10` coercion silently turned it into ten years),
// and anything that is not a real window must still land on the default.

describe('the ladder', () => {
  it('is the shipped set of steps, tightest first, unrestricted last', () => {
    expect(YEARS_LADDER).toEqual([5, 10, 15, 20, 40, 60, ALL_YEARS]);
  });

  it('keeps 10 as a step, so the default is not a behavior change', () => {
    expect(DEFAULT_YEARS).toBe(10);
    expect(YEARS_LADDER).toContain(DEFAULT_YEARS);
  });
});

describe('isAllYears', () => {
  it('accepts the string and the numeric synonym', () => {
    expect(isAllYears('all')).toBe(true);
    expect(isAllYears(' ALL ')).toBe(true);
    expect(isAllYears('All')).toBe(true);
    expect(isAllYears(0)).toBe(true);
    expect(isAllYears('0')).toBe(true);
  });

  it('does not read the falsy values that merely COERCE to 0 as "all"', () => {
    // Number(null) === Number('') === Number(false) === 0. None of them is a
    // user asking for every construction year, and treating them as one would
    // silently drop the year filter on an empty input.
    expect(isAllYears(null)).toBe(false);
    expect(isAllYears('')).toBe(false);
    expect(isAllYears(false)).toBe(false);
    expect(isAllYears(undefined)).toBe(false);
  });

  it('rejects real windows', () => {
    expect(isAllYears(10)).toBe(false);
    expect(isAllYears('10')).toBe(false);
    // 100 is NOT "all": Swiss parcels carry construction years well before it.
    expect(isAllYears(100)).toBe(false);
  });
});

describe('coerceYearsWindow (the wire contract)', () => {
  it("passes the unrestricted window through as 'all'", () => {
    expect(coerceYearsWindow('all')).toBe(ALL_YEARS);
    expect(coerceYearsWindow(0)).toBe(ALL_YEARS);
  });

  it('passes an in-range integer through, from a number or a numeric string', () => {
    expect(coerceYearsWindow(5)).toBe(5);
    expect(coerceYearsWindow(60)).toBe(60);
    expect(coerceYearsWindow('7')).toBe(7);
    expect(coerceYearsWindow(1)).toBe(1);
    expect(coerceYearsWindow(100)).toBe(100);
  });

  it('rounds a fractional window instead of forwarding it', () => {
    expect(coerceYearsWindow(7.6)).toBe(8);
  });

  it('defaults anything that is not a window, including out-of-range numbers', () => {
    for (const garbage of [undefined, null, '', '   ', 'banana', NaN, Infinity, true, {}, [], -5, 0.4, 101, 1e9]) {
      expect(coerceYearsWindow(garbage)).toBe(DEFAULT_YEARS);
    }
  });

  it('honors an explicit fallback', () => {
    expect(coerceYearsWindow('banana', 20)).toBe(20);
    expect(coerceYearsWindow(undefined, ALL_YEARS)).toBe(ALL_YEARS);
  });
});

describe('normalizeYearsWindow (the control contract)', () => {
  it('leaves every ladder step alone', () => {
    for (const step of YEARS_LADDER) {
      expect(normalizeYearsWindow(step)).toBe(step);
    }
  });

  it('reads the DOM dataset spellings the ladder buttons carry', () => {
    expect(normalizeYearsWindow('15')).toBe(15);
    expect(normalizeYearsWindow('all')).toBe(ALL_YEARS);
  });

  it('snaps an off-ladder window to the nearest step', () => {
    expect(normalizeYearsWindow(1)).toBe(5);
    expect(normalizeYearsWindow(12)).toBe(10);
    expect(normalizeYearsWindow(13)).toBe(15);
    expect(normalizeYearsWindow(25)).toBe(20);
    expect(normalizeYearsWindow(55)).toBe(60);
  });

  it('widens on a tie, because a sparse set is this filter\'s failure mode', () => {
    expect(normalizeYearsWindow(30)).toBe(40); // 20 and 40 are equidistant
    expect(normalizeYearsWindow(50)).toBe(60); // 40 and 60 are equidistant
  });

  it('never reaches the unrestricted window by being a large number', () => {
    // The old slider topped out at 30; a stale 100 is still a bounded window.
    expect(normalizeYearsWindow(100)).toBe(60);
  });

  it('falls back to the default step for garbage', () => {
    expect(normalizeYearsWindow(undefined)).toBe(DEFAULT_YEARS);
    expect(normalizeYearsWindow('banana')).toBe(DEFAULT_YEARS);
    expect(normalizeYearsWindow(null)).toBe(DEFAULT_YEARS);
  });
});
