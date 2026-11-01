import { describe, expect, it } from 'vitest';
import {
  contentBodyText,
  contentTitleText,
  displayContentLabels,
  resolveLocaleCopy,
} from '../../apps/web/src/lib/content-display-text';

describe('content-display-text', () => {
  it('falls back across locales and hides raw ids', () => {
    expect(
      resolveLocaleCopy({ en: '', ar: 'نص عربي' }, 'en'),
    ).toBe('نص عربي');
    expect(
      resolveLocaleCopy({ en: '01M68FN1FZGN0BJBXHJM3RMF64', ar: 'عنوان' }, 'en'),
    ).toBe('عنوان');
  });

  it('prefers caption for body and title for headings', () => {
    expect(
      contentBodyText(
        { en: 'Title', ar: 'Title' },
        { en: 'Body copy', ar: 'Body copy' },
        'en',
        '—',
      ),
    ).toBe('Body copy');
    expect(
      contentTitleText(
        { en: 'Title', ar: 'Title' },
        { en: 'Body', ar: 'Body' },
        'en',
        'Untitled',
      ),
    ).toBe('Title');
  });

  it('filters label ids', () => {
    expect(displayContentLabels(['Promo', '01M68FN1FZGN0BJBXHJM3RMF64'])).toEqual(['Promo']);
  });
});
