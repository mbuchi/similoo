// The construction-year window every /score/similoo request carries.
//
// The backend takes either a bounded positive integer (1..100 years back from
// today) or an UNRESTRICTED window with no construction-year floor at all,
// spelled `'all'` on the wire (it also accepts the number 0 as a synonym).
// similoo sends the STRING everywhere - in the request body, in the DOM
// dataset, in any cache key - because 0 is falsy and would collide with
// "absent" in exactly the `Number.isFinite(x) ? x : 10` coercions this module
// exists to replace. Note 100 is NOT "all": Swiss parcels carry construction
// years well before 1926, so the unrestricted window is its own value, never
// the top of the numeric range.
//
// The sidebar control is a slider over a table of STOPS, not a plain numeric
// range: 1..10 years one year at a time, then 15, then 20, then the
// unrestricted window. The fine head answers "what was built under the current
// rule" - set it to the years since a zoning or building-law change took
// effect and only buildings completed under it remain - and the coarse tail
// answers "widen until there is actually a cohort to compare against", which
// is what a zone with little recent building needs (on a Kreuzlingen mixed
// zone /score/similoo returns 2 comparables at 7 years, 5 at 10, 11 at 15,
// 17 at 20 and 112 candidates unrestricted).
//
// The wire contract is wider still on purpose - an explicit `years: 40` from
// elsewhere reaches RES intact - but a value arriving at the CONTROL from
// anywhere else (a stale persisted number, a hand-edited attribute) is snapped
// onto a stop instead of being accepted verbatim.

export const ALL_YEARS = 'all';

// 10 is the top of the slider, so the default is unchanged from the ladder
// era: a user who never touches the control sends exactly what they sent
// before.
export const DEFAULT_YEARS = 10;

// The backend's bounded range for a NUMERIC window. Anything outside it is
// garbage, not something to clamp silently into a different question.
export const MIN_YEARS = 1;
export const MAX_YEARS = 100;

// The slider's stops, declared once and read by the sidebar for the input's
// min/max, its tick marks and its scale.
//
// SLIDER_MIN_YEARS..SLIDER_FINE_MAX_YEARS are the one-year steps;
// SLIDER_COARSE_YEARS are the wider numeric stops past them; the last stop
// carries `'all'` rather than a year count. Because the steps are NOT uniform,
// the input's `value` is a POSITION (a 1-based index into SLIDER_STOPS), never
// a window - position 11 is 15 years and position 13 is `'all'`. Convert with
// sliderPosToYears / yearsToSliderPos, never by reading `.value` as a number.
export const SLIDER_MIN_YEARS = 1;
export const SLIDER_FINE_MAX_YEARS = 10;
export const SLIDER_COARSE_YEARS = [15, 20];

/** @type {Array<number | typeof ALL_YEARS>} */
export const SLIDER_STOPS = [
    ...Array.from(
        { length: SLIDER_FINE_MAX_YEARS - SLIDER_MIN_YEARS + 1 },
        (_, i) => SLIDER_MIN_YEARS + i,
    ),
    ...SLIDER_COARSE_YEARS,
    ALL_YEARS,
];

// 1-based, because the input's min is 1 and not 0.
export const SLIDER_ALL_POS = SLIDER_STOPS.length;

// The widest NUMERIC stop, i.e. the last one before the unrestricted window.
export const SLIDER_MAX_YEARS = SLIDER_COARSE_YEARS[SLIDER_COARSE_YEARS.length - 1];

/**
 * True for the two accepted spellings of the unrestricted window: the string
 * `'all'` (any case, padded or not) and a literal `0` / `'0'`.
 *
 * Deliberately strict about 0: `raw === 0` and not `Number(raw) === 0`, because
 * `Number(null)`, `Number('')` and `Number(false)` are all 0 and none of those
 * means "the user asked for every year".
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isAllYears(raw) {
    if (raw === 0) return true;
    if (typeof raw !== 'string') return false;
    const v = raw.trim().toLowerCase();
    return v === 'all' || v === '0';
}

/**
 * Coerce an arbitrary value onto the wire contract: `'all'`, or an integer
 * inside [MIN_YEARS, MAX_YEARS]. Anything else (missing, empty, NaN, negative,
 * out of range, a boolean, an object) falls back - by default to 10.
 *
 * This is the honest replacement for `Number.isFinite(n) ? n : 10`, which
 * turned `'all'` into 10 and happily forwarded -5 and 1e9.
 *
 * @param {unknown} raw
 * @param {number | typeof ALL_YEARS} [fallback]
 * @returns {number | typeof ALL_YEARS}
 */
export function coerceYearsWindow(raw, fallback = DEFAULT_YEARS) {
    if (isAllYears(raw)) return ALL_YEARS;
    if (typeof raw === 'string') {
        if (raw.trim() === '') return fallback;
    } else if (typeof raw !== 'number') {
        return fallback;
    }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < MIN_YEARS || n > MAX_YEARS) return fallback;
    return n;
}

/**
 * Snap a value onto a stop the control can actually show: one of SLIDER_STOPS.
 * `'all'` survives as itself. A number BETWEEN two stops rounds UP to the
 * narrower-excluding one (12 -> 15, 17 -> 20) and anything past the widest
 * numeric stop lands on `'all'` (a stale 40 or 60 from the retired ladder,
 * a hand-typed 100): the honest stop is the one that still includes every
 * building the value asked for, since rounding 40 down to 20 would silently
 * hide two decades of comparables. Garbage falls back the same way
 * `coerceYearsWindow` does.
 *
 * @param {unknown} raw
 * @param {number | typeof ALL_YEARS} [fallback]
 * @returns {number | typeof ALL_YEARS}
 */
export function clampSliderYears(raw, fallback = DEFAULT_YEARS) {
    const coerced = coerceYearsWindow(raw, fallback);
    if (coerced === ALL_YEARS) return ALL_YEARS;
    const stop = SLIDER_STOPS.find(
        (s) => s !== ALL_YEARS && /** @type {number} */ (s) >= coerced,
    );
    return stop === undefined ? ALL_YEARS : stop;
}

/**
 * The window a slider POSITION means. Positions are 1-based indices into
 * SLIDER_STOPS, so they are NOT year counts past the fine range: position 11
 * is 15 years, 12 is 20 and 13 is the unrestricted window. A position outside
 * the track is clamped onto it, so a hand-edited `value` cannot smuggle a
 * window the control cannot display.
 *
 * @param {unknown} pos
 * @returns {number | typeof ALL_YEARS}
 */
export function sliderPosToYears(pos) {
    const n = Math.round(Number(pos));
    if (!Number.isFinite(n)) return DEFAULT_YEARS;
    const index = Math.min(SLIDER_ALL_POS, Math.max(1, n)) - 1;
    return SLIDER_STOPS[index];
}

/**
 * The inverse: which position holds a window. Anything not already on a stop
 * goes through `clampSliderYears` first, so the two agree by construction.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function yearsToSliderPos(value) {
    const stop = clampSliderYears(value);
    const index = SLIDER_STOPS.indexOf(stop);
    return index === -1 ? SLIDER_ALL_POS : index + 1;
}
