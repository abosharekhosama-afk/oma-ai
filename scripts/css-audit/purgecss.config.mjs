/** @type {import('purgecss').PurgeCSSOptions} */
export default {
  content: [
    './apps/web/src/**/*.{tsx,ts,jsx,js}',
    './packages/ui/src/**/*.{tsx,ts}',
  ],
  css: ['./apps/web/src/styles/**/*.css', './apps/web/src/app/globals.css'],
  safelist: {
    standard: [/^ant-/, /^rc-/, /^oma-/, /^plx-/, /^is-/, /^has-/],
    deep: [/data-active/, /data-scrolling/, /data-testid/],
    greedy: [/icon/, /lucide/],
  },
  blocklist: [],
};