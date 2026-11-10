import type { Database } from '@/types/database';

export type UserRole = Database['public']['Enums']['user_role'];

/**
 * Tiga role, sesuai bentuk operasi yang sebenarnya: satu tempat kerja, banyak
 * vendor.
 *
 *   superadmin  akses penuh — master data, harga, penghapusan
 *   admin       penghubung pembeli & vendor: verifikasi order, verifikasi
 *               pembayaran, penugasan vendor, validasi bukti dari vendor
 *   vendor      pelaksana; hanya melihat order yang ditugaskan padanya
 *
 * Wewenang sesungguhnya ada di `server/auth/capabilities.ts` dan kebijakan RLS;
 * berkas ini hanya menamai rolenya untuk layar.
 */
export const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  vendor: 'Vendor',
};
