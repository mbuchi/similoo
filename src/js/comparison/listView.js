// The comparables list as a pure view over the fetched pool: which rows
// survive the size filter, in what order, and which slice of them is the
// current page. Kept free of DOM so the sidebar's rendering and the tests
// share one definition of "sorted", "offered" and "page".
//
// The pool is fetched ONCE per parcel + years window (POOL_LIMIT rows, ranked
// by similarity on the server) and everything here is client-side: a sort,
// filter or page change never refetches.

// How deep a pool /score/similoo is asked for. The server ranks every
// candidate anyway and only slices the result, so a deeper pool costs it
// nothing; 60 keeps the payload small and gives the pager ten pages.
export const POOL_LIMIT = 60;

// Cards per page. Six keeps a page inside roughly one panel height on a phone
// (DESIGN_GUIDELINES principle 6) and lets the map highlights, which follow
// the page, stay readable.
export const PAGE_SIZE = 6;

export const DEFAULT_SORT = 'similarity';

// Every sort key the <select> can carry, and the row field each reads. The
// two planning sorts read fields the live route only emits from RES v0.0.166
// on (achievable_volume_m3 = vol_max, utilization = cz_util_now);
// `availableSortKeys` withholds them while a payload lacks them.
export const SORT_FIELDS = {
    similarity: 'similarity_score',
    ratioV: 'ratioV',
    size: 'parcel_area_m2',
    year: 'construction_year',
    achievable: 'achievable_volume_m3',
    utilization: 'utilization',
};
export const SORT_KEYS = Object.keys(SORT_FIELDS);

// Sorts that are only offered when the pool actually carries the field.
export const CONDITIONAL_SORT_KEYS = ['achievable', 'utilization'];

const finite = (v) => (Number.isFinite(v) ? v : null);

/**
 * The rows inside the parcel-size band. A bound that is not a finite number
 * is "no bound".
 *
 * @template T
 * @param {T[]} list
 * @param {{ sizeFrom?: number | null, sizeTo?: number | null }} [band]
 * @returns {T[]}
 */
export function filterComparables(list, { sizeFrom = null, sizeTo = null } = {}) {
    return (list || []).filter((c) => {
        if (Number.isFinite(sizeFrom) && c.parcel_area_m2 < sizeFrom) return false;
        if (Number.isFinite(sizeTo) && c.parcel_area_m2 > sizeTo) return false;
        return true;
    });
}

// Descending on `field`, rows without a finite value LAST (never as 0, which
// would rank an unknown envelope below every known one and above a negative
// one), so a missing figure reads as missing rather than as the smallest.
function compareDesc(field, a, b) {
    const av = finite(a?.[field]);
    const bv = finite(b?.[field]);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
}

/**
 * A new array sorted descending on the key's field, ties (and rows without
 * the field) broken by similarity so the order is stable across re-renders.
 * An unknown key sorts by similarity.
 *
 * @template T
 * @param {T[]} list
 * @param {string} key
 * @returns {T[]}
 */
export function sortComparables(list, key) {
    const field = SORT_FIELDS[key] || SORT_FIELDS[DEFAULT_SORT];
    return (list || []).slice().sort((a, b) =>
        compareDesc(field, a, b) || compareDesc(SORT_FIELDS.similarity, a, b));
}

/**
 * The sort keys a pool can honestly offer: the four similarity-era keys
 * always, the two planning keys only when at least one row carries a finite
 * value. Meant to run over the UNFILTERED pool so a size filter cannot make
 * an option flicker in and out.
 *
 * @param {Array<Record<string, unknown>>} list
 * @returns {string[]}
 */
export function availableSortKeys(list) {
    const rows = list || [];
    return SORT_KEYS.filter((key) =>
        !CONDITIONAL_SORT_KEYS.includes(key)
        || rows.some((c) => Number.isFinite(c?.[SORT_FIELDS[key]])));
}

/**
 * The key the <select> should hold: the requested one when it is offered,
 * else the default.
 *
 * @param {unknown} key
 * @param {string[]} [available]
 * @returns {string}
 */
export function resolveSortKey(key, available = SORT_KEYS) {
    return typeof key === 'string' && available.includes(key) ? key : DEFAULT_SORT;
}

/**
 * Clamp a requested page onto [0, pageCount) and return the slice bounds.
 * `from` / `to` are 1-based and inclusive, for display ("7–12 of 60"); an
 * empty list yields page 0 of 1 with from/to 0 so the caller can hide the
 * pager. `start` / `end` are the 0-based half-open slice bounds.
 *
 * @param {number} total
 * @param {number} page
 * @param {number} [size]
 */
export function paginate(total, page, size = PAGE_SIZE) {
    const count = Math.max(0, Number.isFinite(total) ? Math.floor(total) : 0);
    const per = Math.max(1, Number.isFinite(size) ? Math.floor(size) : PAGE_SIZE);
    const pageCount = Math.max(1, Math.ceil(count / per));
    const requested = Number.isFinite(page) ? Math.floor(page) : 0;
    const current = Math.min(Math.max(0, requested), pageCount - 1);
    const start = current * per;
    const end = Math.min(count, start + per);
    return {
        page: current,
        pageCount,
        start,
        end,
        from: count ? start + 1 : 0,
        to: end,
        hasPrev: current > 0,
        hasNext: current < pageCount - 1,
    };
}
