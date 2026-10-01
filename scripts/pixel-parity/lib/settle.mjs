/** Shared settle protocol for PIXEL_LEVEL_REFERENCE_PARITY captures. */

export async function settlePage(page, { networkIdleMs = 800 } = {}) {
  await page
    .waitForFunction(() => document.fonts?.status === 'loaded' || document.fonts?.ready, {
      timeout: 15_000,
    })
    .catch(() => {});
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(networkIdleMs);
  // Skeletons / busy
  await page
    .waitForFunction(
      () => {
        const busy = document.querySelectorAll(
          '[aria-busy="true"], .oma-skeleton, .ant-skeleton',
        ).length;
        return busy === 0;
      },
      { timeout: 15_000 },
    )
    .catch(() => {});
  // Images with src must have non-zero natural size when complete
  await page
    .waitForFunction(
      () =>
        [...document.images].every(
          (img) => !img.src || !img.complete || img.naturalWidth > 0 || img.closest('[hidden]'),
        ),
      { timeout: 10_000 },
    )
    .catch(() => {});
  // Prefer reduced motion settle
  await page.evaluate(
    () =>
      new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)));
      }),
  );
}

export async function assertCaptureReady(page, { width, height }) {
  const vp = page.viewportSize();
  if (!vp || vp.width !== width || vp.height !== height) {
    throw new Error(`viewport mismatch want ${width}x${height} got ${JSON.stringify(vp)}`);
  }
  const report = await page.evaluate(() => {
    const nextDev = !!document.querySelector(
      '#__next-build-watcher, [data-nextjs-toast], nextjs-portal',
    );
    const broken = [...document.images].filter(
      (i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:'),
    ).length;
    return {
      nextDev,
      broken,
      zoom: window.devicePixelRatio,
      title: document.title,
      url: location.href,
    };
  });
  if (report.nextDev) throw new Error('development overlay present — invalid capture');
  return report;
}

export function scrubUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '(invalid)';
  }
}
