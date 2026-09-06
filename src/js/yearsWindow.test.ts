import { describe, expect, it } from 'vitest';
import {
  ALL_YEARS,
  DEFAULT_YEARS,
  SLIDER_MAX_YEARS,
  SLIDER_MIN_YEARS,
  clampSliderYears,
  coerceYearsWindow,
  isAllYears,
} from './yearsWindow.js';

// The sidebar's years filter is a 1..10 slider, and the value it holds is what
// goes on the wire to /score/similoo. Two things have to hold at once: the
// wire contract stays wider than the control (an explicit 40 or 'all' from
// elsewhere must survive the coercion the old `Number.isFinite(x) ? x : 10`
// silently broke), and anything that reaches the CONTROL must land inside the
// slider, never on a value the input cannot show.

describe('the slider', () => {
  it('runs 1..10, one year per step, so the window can follow a recent rule change', () => {
    expect(SLIDER_MIN_YEARS).toBe(1);
    expect(SLIDER_MAX_YEARS).toBe(10);
  });

  it('keeps 10 as the default, so a user who never touches it sends what they always sent', () => {
    expect(DEFAULT_YEARS).toBe(10);
    expect(DEFAULT_YEARS).toBeGreaterThanOrEqual(SLIDER_MIN_YEARS);
    expect(DEFAULT_YEARS).toBeLessThanOrEqual(SLIDER_MAX_YEARS);
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

describe('clampSliderYears (the control contract)', () => {
  it('leaves every slider position alone', () => {
    for (let y = SLIDER_MIN_YEARS; y <= SLIDER_MAX_YEARS; y += 1) {
      expect(clampSliderYears(y)).toBe(y);
    }
  });

  it('reads the string the range input hands back', () => {
    expect(clampSliderYears('3')).toBe(3);
    expect(clampSliderYears('10')).toBe(10);
  });

  it('rounds a fractional position onto a whole year', () => {
    expect(clampSliderYears(2.4)).toBe(2);
    expect(clampSliderYears(2.6)).toBe(3);
  });

  it('clamps a wider window onto the top of the slider, never past it', () => {
    // The retired ladder's coarse steps, and the wire contract's own ceiling.
    for (const stale of [15, 20, 40, 60, 100]) {
      expect(clampSliderYears(stale)).toBe(SLIDER_MAX_YEARS);
    }
  });

  it("turns the unrestricted 'all' into the widest window the slider can say", () => {
    expect(clampSliderYears('all')).toBe(SLIDER_MAX_YEARS);
    expect(clampSliderYears(0)).toBe(SLIDER_MAX_YEARS);
    expect(clampSliderYears(undefined, ALL_YEARS)).toBe(SLIDER_MAX_YEARS);
  });

  it('never reaches below the first year', () => {
    // 0.4 rounds to 0, which coerceYearsWindow already refuses as a window; a
    // fallback below the slider is still clamped up onto it.
    expect(clampSliderYears(0.4)).toBe(DEFAULT_YEARS);
    expect(clampSliderYears(-3)).toBe(DEFAULT_YEARS);
  });

  it('falls back to the default position for garbage', () => {
    expect(clampSliderYears(undefined)).toBe(DEFAULT_YEARS);
    expect(clampSliderYears('banana')).toBe(DEFAULT_YEARS);
    expect(clampSliderYears(null)).toBe(DEFAULT_YEARS);
    expect(clampSliderYears('')).toBe(DEFAULT_YEARS);
  });
});
