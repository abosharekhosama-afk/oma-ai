'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { resolveDir } from '@oma/i18n';
import { carouselKeyTarget, type GalleryItem } from '../../lib/product-media';
import { useLocale, useT } from '../../lib/use-locale';

type Props = {
  items: GalleryItem[];
  /** Accessible name — the product name. */
  label: string;
  /** Opens the full-screen viewer at the given slide (images only). */
  onOpen?: (index: number) => void;
  testId?: string;
};

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (acc, [k, v]) => acc.split(`{${k}}`).join(String(v)),
    template,
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function Chevron({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      className={`oma-media-carousel__chevron oma-media-carousel__chevron--${direction}`}
    >
      <path
        d={direction === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MediaPlaceholder({ text }: { text: string }) {
  return (
    <div className="oma-media-carousel__placeholder" role="img" aria-label={text}>
      <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" focusable="false">
        <path
          d="M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{text}</span>
    </div>
  );
}

/**
 * Swipeable product media carousel.
 * - Native scroll-snap track: touch swipe / trackpad on every device, no JS drag code.
 * - Arrow buttons + dots for pointer users; ←/→/Home/End on the focused track (RTL aware).
 * - Images are lazy-loaded (first slide eager) inside a fixed aspect-ratio frame so cards
 *   never jump while media streams from WorkDrive.
 */
export function ProductMediaCarousel({ items, label, onOpen, testId }: Props) {
  const t = useT();
  const locale = useLocale();
  const dir = resolveDir(locale);
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Record<string, true>>({});
  const count = items.length;

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, count - 1)));
  }, [count]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || count < 2 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (Number.isInteger(index)) setActive(index);
          }
        }
      },
      { root: track, threshold: [0.6] },
    );
    track.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [count]);

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(count - 1, index));
      const slide = track.querySelector<HTMLElement>(`[data-index="${clamped}"]`);
      if (!slide) return;
      // Scroll only the track (never the page) — works in LTR and RTL alike.
      const delta = slide.getBoundingClientRect().left - track.getBoundingClientRect().left;
      track.scrollBy({ left: delta, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      setActive(clamped);
    },
    [count],
  );

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const target = carouselKeyTarget(event.key, active, count, dir);
    if (target == null) return;
    event.preventDefault();
    goTo(target);
  }

  if (count === 0) {
    return (
      <div
        className="oma-media-carousel oma-media-carousel--empty"
        data-testid={testId}
        data-count={0}
      >
        <MediaPlaceholder text={t('brand.catalog.noMedia')} />
      </div>
    );
  }

  const prevDisabled = active <= 0;
  const nextDisabled = active >= count - 1;

  return (
    <div
      className="oma-media-carousel"
      role="region"
      aria-roledescription={t('brand.catalog.carousel.roledescription')}
      aria-label={label}
      data-testid={testId}
      data-count={count}
    >
      <ul
        ref={trackRef}
        className="oma-media-carousel__track"
        tabIndex={count > 1 ? 0 : -1}
        onKeyDown={onKeyDown}
        aria-label={fill(t('brand.catalog.carousel.trackLabel'), { count })}
      >
        {items.map((item, index) => {
          const slideLabel = fill(t('brand.catalog.carousel.slideLabel'), {
            index: index + 1,
            count,
          });
          const isBroken = Boolean(broken[item.id]);
          return (
            <li
              key={item.id}
              className="oma-media-carousel__slide"
              data-index={index}
              role="group"
              aria-roledescription={t('brand.catalog.carousel.slide')}
              aria-label={slideLabel}
              aria-hidden={index === active ? undefined : true}
            >
              {isBroken ? (
                <MediaPlaceholder text={t('brand.catalog.mediaUnavailable')} />
              ) : item.kind === 'video' ? (
                <video
                  className="oma-media-carousel__media"
                  src={item.streamUrl ?? item.src}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  tabIndex={index === active ? 0 : -1}
                  aria-label={`${label} — ${slideLabel}`}
                  onError={() => setBroken((b) => ({ ...b, [item.id]: true }))}
                />
              ) : (
                <button
                  type="button"
                  className="oma-media-carousel__open"
                  onClick={() => onOpen?.(index)}
                  disabled={!onOpen}
                  tabIndex={index === active ? 0 : -1}
                  aria-label={`${t('brand.catalog.zoomImage')} — ${slideLabel}`}
                >
                  <img
                    className="oma-media-carousel__media"
                    src={item.src}
                    alt={`${label} — ${slideLabel}`}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    onError={() => setBroken((b) => ({ ...b, [item.id]: true }))}
                  />
                </button>
              )}
              {item.generated ? (
                <span className="oma-media-carousel__tag">{t('brand.catalog.generatedTag')}</span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {count > 1 ? (
        <>
          <span className="oma-media-carousel__counter" aria-hidden="true">
            {fill(t('brand.catalog.carousel.counter'), { index: active + 1, count })}
          </span>
          <button
            type="button"
            className="oma-media-carousel__nav oma-media-carousel__nav--prev"
            onClick={() => goTo(active - 1)}
            disabled={prevDisabled}
            aria-label={t('brand.catalog.carousel.prev')}
            data-testid={testId ? `${testId}-prev` : undefined}
          >
            <Chevron direction="prev" />
          </button>
          <button
            type="button"
            className="oma-media-carousel__nav oma-media-carousel__nav--next"
            onClick={() => goTo(active + 1)}
            disabled={nextDisabled}
            aria-label={t('brand.catalog.carousel.next')}
            data-testid={testId ? `${testId}-next` : undefined}
          >
            <Chevron direction="next" />
          </button>
          <div className="oma-media-carousel__dots" role="group" aria-label={label}>
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`oma-media-carousel__dot${index === active ? ' is-active' : ''}`}
                aria-label={fill(t('brand.catalog.carousel.goTo'), { index: index + 1, count })}
                aria-current={index === active ? 'true' : undefined}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
          <p className="oma-sr-only" aria-live="polite" aria-atomic="true">
            {fill(t('brand.catalog.carousel.slideLabel'), { index: active + 1, count })}
          </p>
        </>
      ) : null}
    </div>
  );
}

type LightboxProps = {
  items: GalleryItem[];
  index: number | null;
  caption: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

/** Full-screen viewer (modal <dialog>: focus trap + Esc for free). */
export function ProductMediaLightbox({
  items,
  index,
  caption,
  onIndexChange,
  onClose,
}: LightboxProps) {
  const t = useT();
  const locale = useLocale();
  const dir = resolveDir(locale);
  const ref = useRef<HTMLDialogElement>(null);
  const open = index != null && items.length > 0;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return <dialog ref={ref} className="oma-catalog-lightbox" hidden />;
  const current = Math.max(0, Math.min(items.length - 1, index));
  const item = items[current]!;

  return (
    <dialog
      ref={ref}
      className="oma-catalog-lightbox"
      data-testid="catalog-image-lightbox"
      aria-label={caption}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        const next = carouselKeyTarget(e.key, current, items.length, dir);
        if (next != null) {
          e.preventDefault();
          onIndexChange(next);
        }
      }}
    >
      <button
        type="button"
        className="oma-catalog-lightbox__close"
        onClick={onClose}
        aria-label={t('common.close')}
      >
        ×
      </button>
      {item.kind === 'video' ? (
        <video
          className="oma-catalog-lightbox__img"
          src={item.streamUrl ?? item.src}
          controls
          playsInline
        />
      ) : (
        <img className="oma-catalog-lightbox__img" src={item.src} alt={caption} />
      )}
      <div className="oma-catalog-lightbox__bar">
        {items.length > 1 ? (
          <button
            type="button"
            className="oma-media-carousel__nav oma-media-carousel__nav--static"
            onClick={() => onIndexChange(current - 1)}
            disabled={current === 0}
            aria-label={t('brand.catalog.carousel.prev')}
          >
            <Chevron direction="prev" />
          </button>
        ) : null}
        <p className="oma-catalog-lightbox__caption">
          {caption}
          {items.length > 1
            ? ` · ${fill(t('brand.catalog.carousel.counter'), {
                index: current + 1,
                count: items.length,
              })}`
            : ''}
        </p>
        {items.length > 1 ? (
          <button
            type="button"
            className="oma-media-carousel__nav oma-media-carousel__nav--static"
            onClick={() => onIndexChange(current + 1)}
            disabled={current >= items.length - 1}
            aria-label={t('brand.catalog.carousel.next')}
          >
            <Chevron direction="next" />
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
