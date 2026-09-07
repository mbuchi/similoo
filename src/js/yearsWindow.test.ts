import { describe, expect, it } from 'vitest';
import {
  ALL_YEARS,
  DEFAULT_YEARS,
  SLIDER_ALL_POS,
  SLIDER_COARSE_YEARS,
  SLIDER_FINE_MAX_YEARS,
  SLIDER_MAX_YEARS,
  SLIDER_MIN_YEARS,
  SLIDER_STOPS,
  clampSliderYears,
  coerceYearsWindow,
  isAllYears,
  sliderPosToYears,
  yearsToSliderPos,
} from './yearsWindow.js';

// The sidebar's age filter is a slider over a table of stops - 1..10 years one
// year at a time, then 15, 20 and the unrestricted window - and the value it
// holds is what goes on the wire to /score/similoo. Two things have to hold at
// once: the wire contract stays wider than the control (an explicit 40 from
// elsewhere must survive the coercion the old `Number.isFinite(x) ? x : 10`
// silently broke), and anything that reaches the CONTROL must land on a stop
// the input can actually show.
//
// The input's `value` is a POSITION, never a window: the steps are evenly
// spaced on the track but the windows behind them are not, so position 11 is
// 15 years and position 13 is 'all'. sliderPosToYears / yearsToSliderPos are
// the only legal way across that boundary.

describe('the slider', () => {
  it('runs 1..10 one year at a time, so the window can follow a recent rule change', () => {
    expect(SLIDER_MIN_YEARS).toBe(1);
    expect(SLIDER_FINE_MAX_YEARS).toBe(10);
    expect(SLIDER_STOPS.slice(0, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('widens past the fine range with 15 and 20 before dropping the limit', () => {
    expect(SLIDER_COARSE_YEARS).toEqual([15, 20]);
    expect(SLIDER_STOPS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, ALL_YEARS]);
    // The widest NUMERIC stop, not the widest window - 'all' is its own thing.
    expect(SLIDER_MAX_YEARS).toBe(20);
  });

  it('puts the unrestricted window on the last position', () => {
    expect(SLIDER_ALL_POS).toBe(SLIDER_STOPS.length);
    expect(sliderPosToYears(SLIDER_ALL_POS)).toBe(ALL_YEARS);
    expect(yearsToSliderPos(ALL_YEARS)).toBe(SLIDER_ALL_POS);
  });

  it('never lets a position be read as a year count past the fine range', () => {
    // The bug this whole POSITION/window split exists to prevent.
    expect(sliderPosToYears(11)).toBe(15);
    expect(sliderPosToYears(12)).toBe(20);
    expect(sliderPosToYears(13)).toBe(ALL_YEARS);
  });

  it('keeps 10 as the default, so a user who never touches it sends what they always sent', () => {
    expect(DEFAULT_YEARS).toBe(10);
    expect(SLIDER_STOPS).toContain(DEFAULT_YEARS);
    expect(yearsToSliderPos(DEFAULT_YEARS)).toBe(10);
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
  it('leaves every stop alone', () => {
    for (const stop of SLIDER_STOPS) {
      expect(clampSliderYears(stop)).toBe(stop);
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

  it('rounds a window between two stops UP to the wider one', () => {
    // Never down: 12 -> 10 would drop two years of comparables the value
    // explicitly asked for.
    expect(clampSliderYears(11)).toBe(15);
    expect(clampSliderYears(12)).toBe(15);
    expect(clampSliderYears(16)).toBe(20);
    expect(clampSliderYears(19)).toBe(20);
  });

  it('sends a window past the widest numeric stop to the unrestricted one', () => {
    // The retired ladder's coarse steps, and the wire contract's own ceiling.
    for (const stale of [21, 40, 60, 100]) {
      expect(clampSliderYears(stale)).toBe(ALL_YEARS);
      expect(yearsToSliderPos(stale)).toBe(SLIDER_ALL_POS);
    }
  });

  it("keeps the unrestricted 'all' instead of collapsing it onto 10 years", () => {
    expect(clampSliderYears('all')).toBe(ALL_YEARS);
    expect(clampSliderYears(0)).toBe(ALL_YEARS);
    expect(clampSliderYears(undefined, ALL_YEARS)).toBe(ALL_YEARS);
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

describe('sliderPosToYears / yearsToSliderPos (the position boundary)', () => {
  it('round-trips every stop through its position', () => {
    SLIDER_STOPS.forEach((stop, i) => {
      const pos = i + 1;
      expect(sliderPosToYears(pos)).toBe(stop);
      expect(yearsToSliderPos(stop)).toBe(pos);
    });
  });

  it('reads the string a range input hands back', () => {
    expect(sliderPosToYears('7')).toBe(7);
    expect(sliderPosToYears('11')).toBe(15);
    expect(sliderPosToYears(String(SLIDER_ALL_POS))).toBe(ALL_YEARS);
  });

  it('clamps a hand-edited position onto the track', () => {
    // A value past the last stop is still the unrestricted window, never
    // 99 years, and one below the first is still the first.
    expect(sliderPosToYears(99)).toBe(ALL_YEARS);
    expect(sliderPosToYears(0)).toBe(SLIDER_MIN_YEARS);
    expect(sliderPosToYears(-4)).toBe(SLIDER_MIN_YEARS);
  });

  it('falls back to the default position for garbage', () => {
    expect(sliderPosToYears('banana')).toBe(DEFAULT_YEARS);
    expect(sliderPosToYears(undefined)).toBe(DEFAULT_YEARS);
  });
});
