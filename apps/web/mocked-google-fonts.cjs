/**
 * CI-only mock for next/font/google (see NEXT_FONT_GOOGLE_MOCKED_RESPONSES).
 * Use .woff2 URLs so Next's font parser does not choke on extensionless gstatic URLs.
 */
const woff2 = 'https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1MmgVxIIzI.woff2';

function faces(family, weights) {
  return weights
    .map(
      (weight) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(${woff2}) format('woff2');
}`,
    )
    .join('\n');
}

module.exports = {
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap': faces(
    'JetBrains Mono',
    [400, 500],
  ),
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap':
    faces('Noto Sans Arabic', [400, 500, 600, 700]),
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap':
    faces('Plus Jakarta Sans', [500, 600, 700, 800]),
};
