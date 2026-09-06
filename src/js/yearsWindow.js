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
// The sidebar control is a slider over a deliberately short range, 1..10
// years in one-year steps, so the window can follow a recent zoning or
// building-law change year by year: set it to the years since the rule took
// effect and only buildings completed under it remain. The wire contract is
// wider than the control on purpose - an explicit `years: 40` or `'all'` from
// elsewhere still reaches RES intact - but a value arriving at the CONTROL
// from anywhere else (a stale persisted number, a hand-edited attribute) is
// clamped onto the slider instead of being accepted verbatim.

export const ALL_YEARS = 'all';

// 10 is the top of the slider, so the default is unchanged from the ladder
// era: a user who never touches the control sends exactly what they sent
// before.
export const DEFAULT_YEARS = 10;

// The backend's bounded range for a NUMERIC window. Anything outside it is
// garbage, not something to clamp silently into a different question.
export const MIN_YEARS = 1;
export const MAX_YEARS = 100;

// The slider's own bounds, declared once and read by the sidebar for the
// input's min/max, its tick marks and its scale.
export const SLIDER_MIN_YEARS = 1;
export const SLIDER_MAX_YEARS = 10;

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
 * Clamp a value onto the slider: an integer inside
 * [SLIDER_MIN_YEARS, SLIDER_MAX_YEARS]. A wider numeric window (a stale 40
 * from the retired ladder, a hand-typed 100) lands on the slider's top, and so
 * does the unrestricted `'all'`: the widest window the control can say is the
 * nearest thing to "no limit" it has. Garbage falls back the same way
 * `coerceYearsWindow` does, and a fallback of `'all'` clamps like `'all'`.
 *
 * @param {unknown} raw
 * @param {number | typeof ALL_YEARS} [fallback]
 * @returns {number}
 */
export function clampSliderYears(raw, fallback = DEFAULT_YEARS) {
    const coerced = coerceYearsWindow(raw, fallback);
    if (coerced === ALL_YEARS) return SLIDER_MAX_YEARS;
    return Math.min(SLIDER_MAX_YEARS, Math.max(SLIDER_MIN_YEARS, coerced));
}
