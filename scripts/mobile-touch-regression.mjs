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
expectDeclarations('.cmp-target-identity .aireon-pih-egrid', {
  'min-height': '44px',
});
expectDeclarations('.cmp-size-sub input', {
  'min-height': '44px',
});
expectDeclarations('.cmp-card-pc', {
  width: '44px',
  height: '44px',
});

console.log('mobile-touch regression: comparison controls keep 44px hit areas');
