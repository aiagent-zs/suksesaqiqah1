'use client';

// Menggantikan root layout saat layout itu sendiri gagal, jadi tanpa CSS
// aplikasi: gaya ditulis inline seperlunya.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  console.error(error);
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#fff',
          color: '#111',
          padding: 16,
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: 22 }}>Situs sedang bermasalah</h1>
          <p style={{ color: '#444' }}>Coba muat ulang dalam beberapa saat.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 44, padding: '0 20px', fontSize: 16, cursor: 'pointer' }}
          >
            Muat ulang
          </button>
        </div>
      </body>
    </html>
  );
}
