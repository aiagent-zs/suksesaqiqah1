import { z } from 'zod';

const uuid = z.string().uuid('Pilihan tidak valid');

/** Kode wilayah Kemendagri: `32`, `32.04`, `32.04.01`, `32.04.01.2001`. */
const regionCode = z
  .string()
  .trim()
  .regex(/^\d{2}(\.\d{2}){0,2}(\.\d{4})?$/, 'Kode wilayah tidak dikenali');

/**
 * Master mitra pelaksana.
 *
 * Alamatnya disimpan sebagai kode + nama, bentuk yang sama dengan
 * `orders.delivery_*` — tapi **alasannya berbeda**, dan itu perlu dicatat:
 * alamat pada order adalah rekaman sejarah yang harus beku selamanya,
 * sedangkan alamat mitra adalah master data yang berlaku kini. Kalau Kemendagri
 * mengganti nama kecamatan, alamat mitra memang seharusnya ikut berubah;
 * alamat order tidak boleh.
 */
export const vendorSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,12}$/, 'Kode 2-12 huruf kapital atau angka'),
  name: z.string().trim().min(2, 'Nama usaha wajib diisi').max(150, 'Nama terlalu panjang'),
  legal_name: z.string().trim().max(200).optional().or(z.literal('')),
  owner_name: z.string().trim().max(150).optional().or(z.literal('')),
  npwp: z.string().trim().max(30).optional().or(z.literal('')),

  phone: z
    .string()
    .trim()
    .min(8, 'Nomor telepon tidak valid')
    .max(20, 'Nomor terlalu panjang')
    .regex(/^[0-9+()\- ]+$/, 'Nomor hanya boleh berisi angka dan tanda + ( ) -'),
  whatsapp: z.string().trim().max(20).optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid')
    .optional()
    .or(z.literal('')),

  province_code: regionCode.optional().or(z.literal('')),
  city_code: regionCode.optional().or(z.literal('')),
  district_code: regionCode.optional().or(z.literal('')),
  village_code: regionCode.optional().or(z.literal('')),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Kode pos harus 5 digit')
    .optional()
    .or(z.literal('')),
  address_detail: z.string().trim().max(500).optional().or(z.literal('')),

  agreement_number: z.string().trim().max(100).optional().or(z.literal('')),
  agreement_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  agreement_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  daily_capacity: z.number().int().min(1, 'Kapasitas minimal 1').max(1000).optional(),

  /**
   * Mode yang sanggup dilayani. Wajib minimal satu — mitra yang tidak melayani
   * apa pun tidak bisa ditugaskan ke order mana pun.
   */
  service_modes: z.array(z.enum(['salur', 'kirim'])).min(1, 'Pilih minimal satu cara penyaluran'),

  bank_name: z.string().trim().max(100).optional().or(z.literal('')),
  bank_account_no: z.string().trim().max(50).optional().or(z.literal('')),
  bank_account_name: z.string().trim().max(150).optional().or(z.literal('')),

  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const createVendorSchema = vendorSchema;
export const updateVendorSchema = vendorSchema.extend({ id: uuid });

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

export const setVendorActiveSchema = z.object({
  id: uuid,
  is_active: z.boolean(),
});

/**
 * Modal per paket untuk satu mitra.
 *
 * Ini angka internal: pembeli tetap melihat `services.price`. Margin sebuah
 * order adalah selisih keduanya, dan itulah sebabnya kewenangannya berhenti di
 * superadmin.
 */
export const vendorServiceSchema = z.object({
  vendor_id: uuid,
  service_id: uuid,
  vendor_price: z.number().min(0, 'Harga modal tidak boleh negatif'),
  is_offered: z.boolean().default(true),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export type VendorServiceInput = z.infer<typeof vendorServiceSchema>;

export const deleteVendorServiceSchema = z.object({ id: uuid });
