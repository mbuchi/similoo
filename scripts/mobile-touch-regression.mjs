import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const css = await readFile(new URL('../src/css/comparison.css', import.meta.url), 'utf8');
const root = postcss.parse(css);

function declarationsFor(selector) {
  const declarations = new Map();
  root.walkRules((rule) => {
    const selectors = rule.selectors ?? rule.selector.split(',').map((part) => part.trim());
    if (!selectors.includes(selector)) return;
    rule.walkDecls((decl) => declarations.set(decl.prop, decl.value));
  });
  assert.ok(declarations.size, `Missing mobile touch rule: ${selector}`);
  return declarations;
}

function expectDeclarations(selector, expected) {
  const declarations = declarationsFor(selector);
  for (const [property, value] of Object.entries(expected)) {
    assert.equal(
      declarations.get(property),
      value,
      `${selector} must set ${property}: ${value}`,
    );
  }
}

expectDeclarations('.cmp-massing-inner input[type="range"]', {
  'min-height': '44px',
  background: 'transparent',
});
expectDeclarations('.cmp-massing-inner .mb-2 > button', {
  'min-width': '44px',
  'min-height': '44px',
});
expectDeclarations('.cmp-massing-inner .space-y-3 > .flex.gap-1\\.5 > button', {
  'min-height': '44px',
});
expectDeclarations('.cmp-massing-inner [role="switch"]', {
  position: 'relative',
  width: '44px',
  height: '44px',
});
// Identifier pills (EGRID / Lat/Lng): the Aireon data-card header standard
// (R1) says a 44px touch floor is a HIT AREA, never a paint size — a
// min-height on the chip itself inflated a 28px pill into a 44px block and
// shredded the coordinate over several lines. The chip keeps its compact box
// and a centred transparent ::before carries the 44x44 target instead.
expectDeclarations('.cmp-id-chip', {
  position: 'relative',
});
assert.equal(
  declarationsFor('.cmp-id-chip').has('min-height'),
  false,
  '.cmp-id-chip must not set min-height — the 44px target lives on ::before',
);
expectDeclarations('.cmp-id-chip::before', {
  position: 'absolute',
  width: '44px',
  height: '44px',
});
// R2: the pill row is a wrapping content-sized flex row and the value never
// wraps — a grid column or a `word-break` here is the multi-line-coordinate bug.
expectDeclarations('.cmp-id-grid', {
  display: 'flex',
  'flex-wrap': 'wrap',
});
expectDeclarations('.cmp-id-chip-value', {
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
});
assert.equal(
  declarationsFor('.cmp-id-chip-value').has('word-break'),
  false,
  '.cmp-id-chip-value must not set word-break — identifiers stay on one line',
);

expectDeclarations('.cmp-track', {
  'min-height': '44px',
});
expectDeclarations('.cmp-size-sub input', {
  'min-height': '44px',
});
expectDeclarations('.cmp-card-pc', {
  width: '44px',
  height: '44px',
});

console.log('mobile-touch regression: comparison controls keep 44px hit areas, identifier pills stay on one line');
