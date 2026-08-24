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
// The sidebar control is a discrete precision ladder, not a free slider, so a
// value arriving from anywhere else (a stale persisted number, a hand-edited
// attribute) is snapped onto a step instead of being accepted verbatim.

export const ALL_YEARS = 'all';

// The ladder the sidebar renders, tightest step first. Mirrors the utilization
// vintage ladder used elsewhere in the suite: fine steps where recent-permit
// data is dense, coarse steps beyond it, then the unrestricted window.
export const YEARS_LADDER = [5, 10, 15, 20, 40, 60, ALL_YEARS];

// 10 is a ladder step, so the default is unchanged from the slider era: a user
// who never touches the control sends exactly what they sent before.
export const DEFAULT_YEARS = 10;

// The backend's bounded range for a NUMERIC window. Anything outside it is
// garbage, not something to clamp silently into a different question.
export const MIN_YEARS = 1;
export const MAX_YEARS = 100;

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
 * Snap a value onto a ladder step. `'all'` stays `'all'`; a numeric window
 * lands on the nearest step, ties going to the WIDER one (a sparse result set
 * is this filter's failure mode, so 30 widens to 40 rather than narrowing to
 * 20). Garbage falls back the same way `coerceYearsWindow` does.
 *
 * A number above the top numeric step lands on 60, never on `'all'`: the
 * unrestricted window is only ever reachable by asking for it by name.
 *
 * @param {unknown} raw
 * @param {number | typeof ALL_YEARS} [fallback]
 * @returns {number | typeof ALL_YEARS}
 */
export function normalizeYearsWindow(raw, fallback = DEFAULT_YEARS) {
    const coerced = coerceYearsWindow(raw, fallback);
    if (coerced === ALL_YEARS) return ALL_YEARS;
    let best = DEFAULT_YEARS;
    let bestDelta = Infinity;
    for (const step of YEARS_LADDER) {
        if (typeof step !== 'number') continue;
        const delta = Math.abs(step - coerced);
        if (delta < bestDelta || (delta === bestDelta && step > best)) {
            best = step;
            bestDelta = delta;
        }
    }
    return best;
}
