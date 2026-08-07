import type { z } from 'zod';

/**
 * Bentuk respons seragam seluruh Server Action (docs/16 section 1).
 *
 * Modul ini sengaja **tanpa** `'use server'`: berkas dengan direktif itu hanya
 * boleh mengekspor fungsi async, sehingga tipe dan helper bersama harus tinggal
 * di luar. File action mengimpornya seperti modul biasa.
 */
export type ActionErrorCode =
  'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'INTERNAL';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ActionErrorCode;
        message: string;
        fields?: Record<string, string>;
      };
    };

/** Ubah ZodError menjadi peta `field → pesan` untuk ditempel di form. */
export function validationError(error: z.ZodError): ActionResult<never> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return {
    ok: false,
    error: { code: 'VALIDATION_ERROR', message: 'Data yang dikirim belum valid.', fields },
  };
}

/**
 * Kegagalan tak terduga dari Postgres/PostgREST.
 *
 * Detail teknisnya masuk log server, bukan ke layar operator — pesan mentah
 * Postgres membocorkan nama tabel, kolom, dan kebijakan RLS.
 */
export function internalError(
  scope: string,
  context: string,
  error: { message: string; code?: string },
): ActionResult<never> {
  console.error(`[${scope}] ${context}:`, error.code ?? '-', error.message);
  return {
    ok: false,
    error: { code: 'INTERNAL', message: `${context}. Coba lagi atau hubungi administrator.` },
  };
}

/** Pembungkus `internalError` yang sudah terikat satu modul. */
export function scopedInternalError(scope: string) {
  return (context: string, error: { message: string; code?: string }) =>
    internalError(scope, context, error);
}

export function forbidden(message: string): ActionResult<never> {
  return { ok: false, error: { code: 'FORBIDDEN', message } };
}

export function notFound(message: string): ActionResult<never> {
  return { ok: false, error: { code: 'NOT_FOUND', message } };
}

export function conflict(message: string): ActionResult<never> {
  return { ok: false, error: { code: 'CONFLICT', message } };
}
