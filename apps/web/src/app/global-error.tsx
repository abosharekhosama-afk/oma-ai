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
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif',
          color: '#333333',
          background: '#f5f6f7',
        }}
      >
        <section
          role="alert"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e3e5',
            borderRadius: 8,
            padding: 24,
            maxWidth: 420,
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
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #d9d9d9',
              background: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Try again · إعادة المحاولة
          </button>
        </section>
      </body>
    </html>
  );
}
