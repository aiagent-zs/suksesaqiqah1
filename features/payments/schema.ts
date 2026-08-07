import { z } from 'zod';
import { PAYMENT_METHODS } from '@/lib/constants/order';

const uuid = z.string().uuid('ID tidak valid');

/**
 * Nominal pembayaran.
 *
 * Dibatasi dua desimal supaya cocok dengan `numeric(14,2)` di DB — tanpa ini
 * Postgres membulatkan diam-diam dan angka di layar berbeda dari yang tersimpan,
 * padahal selisihnya ikut menentukan lolos-tidaknya gate DP.
 */
const amount = z.coerce
  .number()
  .positive('Nominal harus lebih dari 0')
  .max(9_999_999_999.99, 'Nominal terlalu besar')
  .refine((v) => Number.isFinite(v) && Math.round(v * 100) === v * 100, {
    message: 'Nominal maksimal 2 angka di belakang koma',
  });

export const recordPaymentSchema = z.object({
  order_id: uuid,
  amount,
  method: z.enum(PAYMENT_METHODS),
  /**
   * Path relatif di bucket `payment-proofs`. Bentuknya diperiksa lagi terhadap
   * cabang & nomor order sebenarnya di server action (`isProofPathForOrder`).
   */
  proof_path: z.string().trim().max(200).optional().or(z.literal('')),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export const verifyPaymentSchema = z
  .object({
    payment_id: uuid,
    decision: z.enum(['verified', 'rejected']),
    note: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((v) => v.decision !== 'rejected' || Boolean(v.note), {
    // Penolakan tanpa alasan tidak bisa ditindaklanjuti oleh yang mencatat.
    path: ['note'],
    message: 'Alasan wajib diisi saat menolak pembayaran',
  });

export const deletePaymentSchema = z.object({ payment_id: uuid });

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
