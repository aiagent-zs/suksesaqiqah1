import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * React PDF membawa dependensi non-JS (fontkit, parser biner) yang rusak bila
   * ikut dibundel Next. Dibiarkan sebagai paket eksternal supaya di-resolve
   * langsung dari node_modules saat runtime server.
   */
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
