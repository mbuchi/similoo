import { describe, expect, it } from 'vitest';
import {
  CONDITIONAL_SORT_KEYS,
  DEFAULT_SORT,
  PAGE_SIZE,
  POOL_LIMIT,
  SORT_KEYS,
  availableSortKeys,
  filterComparables,
  paginate,
  resolveSortKey,
  sortComparables,
} from './listView.js';

// The list the sidebar renders is a pure view over the fetched pool: filter,
// sort, page. These tests pin the three contracts the DOM code leans on: a
// missing figure sorts LAST (never as zero), the two planning sorts are only
// offered when the pool carries the field, and a page request can never fall
// off either end of the list.

const row = (over: Record<string, unknown>) => ({
  egrid: 'CH000000000000',
  parcel_area_m2: 600,
  building_volume_m3: 1800,
  ratioV: 3,
  construction_year: 2020,
  similarity_score: 0.5,
  achievable_volume_m3: null,
  utilization: null,
  ...over,
});

describe('the pool and the page', () => {
  it('asks for a 60-deep pool and shows six cards at a time', () => {
    expect(POOL_LIMIT).toBe(60);
    expect(PAGE_SIZE).toBe(6);
    expect(POOL_LIMIT % PAGE_SIZE).toBe(0);
  });

  it('offers six sort keys, similarity first and as the default', () => {
    expect(SORT_KEYS).toEqual(['similarity', 'ratioV', 'size', 'year', 'achievable', 'utilization']);
    expect(SORT_KEYS[0]).toBe(DEFAULT_SORT);
    expect(CONDITIONAL_SORT_KEYS).toEqual(['achievable', 'utilization']);
  });
});

describe('filterComparables', () => {
  const pool = [row({ egrid: 'A', parcel_area_m2: 300 }), row({ egrid: 'B', parcel_area_m2: 900 }), row({ egrid: 'C', parcel_area_m2: 1500 })];

  it('keeps everything when no bound is set', () => {
    expect(filterComparables(pool).map((c) => c.egrid)).toEqual(['A', 'B', 'C']);
    expect(filterComparables(pool, { sizeFrom: null, sizeTo: NaN }).map((c) => c.egrid)).toEqual(['A', 'B', 'C']);
  });

  it('applies the band inclusively at both ends', () => {
    expect(filterComparables(pool, { sizeFrom: 900 }).map((c) => c.egrid)).toEqual(['B', 'C']);
    expect(filterComparables(pool, { sizeTo: 900 }).map((c) => c.egrid)).toEqual(['A', 'B']);
    expect(filterComparables(pool, { sizeFrom: 400, sizeTo: 1000 }).map((c) => c.egrid)).toEqual(['B']);
  });

  it('tolerates a missing list', () => {
    expect(filterComparables(undefined as unknown as never[])).toEqual([]);
  });
});

describe('sortComparables', () => {
  const pool = [
    row({ egrid: 'low', achievable_volume_m3: 1000, utilization: 0.2, similarity_score: 0.9 }),
    row({ egrid: 'none', achievable_volume_m3: null, utilization: null, similarity_score: 0.95 }),
    row({ egrid: 'high', achievable_volume_m3: 9000, utilization: 0.8, similarity_score: 0.1 }),
    row({ egrid: 'mid', achievable_volume_m3: 4000, utilization: 0.5, similarity_score: 0.4 }),
  ];

  it('sorts descending on the chosen field', () => {
    expect(sortComparables(pool, 'achievable').map((c) => c.egrid)).toEqual(['high', 'mid', 'low', 'none']);
    expect(sortComparables(pool, 'utilization').map((c) => c.egrid)).toEqual(['high', 'mid', 'low', 'none']);
    expect(sortComparables(pool, 'similarity').map((c) => c.egrid)).toEqual(['none', 'low', 'mid', 'high']);
  });

  it('puts rows without the figure LAST, never among the zeros', () => {
    const withZero = [...pool, row({ egrid: 'zero', achievable_volume_m3: 0, similarity_score: 0.99 })];
    const order = sortComparables(withZero, 'achievable').map((c) => c.egrid);
    // 0 is a real (if odd) value and outranks "unknown".
    expect(order).toEqual(['high', 'mid', 'low', 'zero', 'none']);
  });

  it('breaks ties by similarity so the order is stable', () => {
    const tied = [
      row({ egrid: 'a', construction_year: 2019, similarity_score: 0.2 }),
      row({ egrid: 'b', construction_year: 2019, similarity_score: 0.8 }),
      row({ egrid: 'c', construction_year: 2021, similarity_score: 0.1 }),
    ];
    expect(sortComparables(tied, 'year').map((c) => c.egrid)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate its input and falls back to similarity for an unknown key', () => {
    const copy = pool.slice();
    const out = sortComparables(pool, 'banana');
    expect(pool).toEqual(copy);
    expect(out.map((c) => c.egrid)).toEqual(['none', 'low', 'mid', 'high']);
  });
});

describe('availableSortKeys', () => {
  it('withholds the two planning sorts while no row carries the field', () => {
    const legacy = [row({}), row({})];
    expect(availableSortKeys(legacy)).toEqual(['similarity', 'ratioV', 'size', 'year']);
    expect(availableSortKeys([])).toEqual(['similarity', 'ratioV', 'size', 'year']);
  });

  it('offers each planning sort on its own evidence', () => {
    expect(availableSortKeys([row({ achievable_volume_m3: 1200 })])).toEqual(['similarity', 'ratioV', 'size', 'year', 'achievable']);
    expect(availableSortKeys([row({ utilization: 0.4 })])).toEqual(['similarity', 'ratioV', 'size', 'year', 'utilization']);
    expect(availableSortKeys([row({}), row({ achievable_volume_m3: 1, utilization: 0 })])).toEqual(SORT_KEYS);
  });

  it('does not count NaN or a string as evidence', () => {
    expect(availableSortKeys([row({ achievable_volume_m3: NaN, utilization: '0.4' })])).toEqual(['similarity', 'ratioV', 'size', 'year']);
  });
});

describe('resolveSortKey', () => {
  it('keeps an offered key and drops an unoffered one to the default', () => {
    expect(resolveSortKey('year')).toBe('year');
    expect(resolveSortKey('achievable', ['similarity', 'ratioV', 'size', 'year'])).toBe('similarity');
    expect(resolveSortKey('achievable', SORT_KEYS)).toBe('achievable');
    expect(resolveSortKey('banana')).toBe('similarity');
    expect(resolveSortKey(undefined)).toBe('similarity');
  });
});

describe('paginate', () => {
  it('slices a full pool into pages of six with 1-based display bounds', () => {
    expect(paginate(60, 0)).toMatchObject({ page: 0, pageCount: 10, start: 0, end: 6, from: 1, to: 6, hasPrev: false, hasNext: true });
    expect(paginate(60, 1)).toMatchObject({ page: 1, start: 6, end: 12, from: 7, to: 12, hasPrev: true, hasNext: true });
    expect(paginate(60, 9)).toMatchObject({ page: 9, start: 54, end: 60, from: 55, to: 60, hasPrev: true, hasNext: false });
  });

  it('ends a short last page at the list, not at the page size', () => {
    expect(paginate(14, 2)).toMatchObject({ page: 2, pageCount: 3, start: 12, end: 14, from: 13, to: 14, hasNext: false });
  });

  it('clamps a page past either end onto the list', () => {
    expect(paginate(14, 7).page).toBe(2);
    expect(paginate(14, -3).page).toBe(0);
    expect(paginate(14, NaN).page).toBe(0);
  });

  it('describes an empty list as one empty page so the pager can hide', () => {
    expect(paginate(0, 3)).toMatchObject({ page: 0, pageCount: 1, start: 0, end: 0, from: 0, to: 0, hasPrev: false, hasNext: false });
  });

  it('describes a single page as having no neighbours', () => {
    expect(paginate(6, 0)).toMatchObject({ pageCount: 1, hasPrev: false, hasNext: false, from: 1, to: 6 });
    expect(paginate(5, 0, 12)).toMatchObject({ pageCount: 1, to: 5 });
  });
});
