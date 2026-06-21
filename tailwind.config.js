/** @type {import('tailwindcss').Config} */
export default {
  // Suite-standard class-based dark mode: a `dark` class on <html> drives every
  // `dark:` utility. similoo's preserved imperative engine + bespoke CSS theme
  // via `[data-theme="dark"]`; App.tsx mirrors the two so the shared React
  // chrome (navbar / account menu / zoom control) and the engine flip together.
  darkMode: 'class',
  // Scan the React shell, the shared library's compiled components (so the
  // Tailwind utilities they reference — slate surfaces, rounded-xl, etc. — get
  // generated), and index.html. The engine's vanilla .js DOM is styled by the
  // hand-written CSS, not Tailwind, so it doesn't need scanning.
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@aireon/shared/dist/**/*.js',
  ],
  // Preflight (Tailwind's reset) is intentionally LEFT ON to match the suite,
  // but similoo's design-token stylesheet (styles.css) is imported AFTER the
  // Tailwind layers in main.tsx, so the bespoke surfaces keep winning the
  // cascade over preflight's low-specificity base rules.
  theme: {
    extend: {
      fontFamily: {
        // Suite three-token typography, sourced from the same CSS vars the
        // hand-written stylesheets use (styles.css :root), so a font swap in
        // one place cascades to both Tailwind utilities and bespoke CSS.
        sans: ['var(--hood-font)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['var(--hood-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--hood-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
