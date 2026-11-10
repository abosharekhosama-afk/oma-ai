'use client';

/** Last-resort boundary (root layout failed). No providers here, so copy is bilingual. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif',
          color: '#333333',
          background: '#f5f6f7',
        }}
      >
        <main
          id="main"
          data-testid="status-page"
          style={{
            display: 'grid',
            justifyItems: 'center',
            gap: 16,
            width: '100%',
            maxWidth: 440,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
              <rect x="3" y="3" width="11" height="11" rx="3.5" fill="#5CC98E" />
              <rect x="16" y="3" width="11" height="11" rx="3.5" fill="#4C8DFF" />
              <rect x="3" y="16" width="11" height="11" rx="3.5" fill="#FFB547" />
              <rect x="16" y="16" width="11" height="11" rx="3.5" fill="#A66CFF" />
            </svg>
            oma
          </span>
          <section
            role="alert"
            style={{
              width: '100%',
              background: '#ffffff',
              border: '1px solid #e2e3e5',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 8px 28px rgba(15, 23, 42, 0.08)',
            }}
          >
            <p style={{ margin: 0, color: '#5e6166', fontSize: 13 }}>500</p>
            <h1 style={{ margin: '4px 0 8px', fontSize: 18 }}>Something went wrong</h1>
            <p dir="rtl" style={{ margin: '0 0 16px', color: '#5e6166', fontSize: 14 }}>
              حدث خطأ غير متوقع
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid #1677ff',
                background: '#1677ff',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Try again · إعادة المحاولة
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
