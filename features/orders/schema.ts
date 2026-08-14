import { z } from 'zod';

const uuid = z.string().uuid('ID tidak valid');

/** Peserta: pilih yang sudah ada, atau buat baru (docs/16 section 3). */
export const participantInputSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('existing'),
    participant_id: uuid,
  }),
  z.object({
    mode: z.literal('new'),
    name: z.string().trim().min(3, 'Nama peserta minimal 3 karakter'),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+()\-\s]{8,20}$/, 'Nomor telepon tidak valid')
      .optional()
      .or(z.literal('')),
    email: z.string().trim().email('Email tidak valid').optional().or(z.literal('')),
    address: z.string().trim().optional().or(z.literal('')),
  }),
]);

export const orderItemInputSchema = z.object({
  service_id: uuid,
  qty: z.coerce.number().int().min(1, 'Jumlah minimal 1'),
  unit_price: z.coerce.number().min(0, 'Harga tidak boleh negatif'),
  on_behalf_of: z.string().trim().optional().or(z.literal('')),
});

export const animalInputSchema = z.object({
  species: z.enum(['kambing', 'domba', 'sapi']),
  tag_code: z.string().trim().max(50).optional().or(z.literal('')),
  weight_kg: z.coerce.number().positive('Berat harus lebih dari 0').optional(),
  on_behalf_of: z.string().trim().optional().or(z.literal('')),
});

export const createOrderSchema = z.object({
  branch_id: uuid,
  participant: participantInputSchema,
  items: z.array(orderItemInputSchema).min(1, 'Order harus punya minimal 1 item layanan'),
  animals: z.array(animalInputSchema).default([]),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const updateOrderSchema = z.object({
  order_id: uuid,
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  total_amount: z.coerce.number().min(0).optional(),
});

export const changeStatusSchema = z.object({
  order_id: uuid,
  // Daftar ditulis eksplisit agar tipe hasil parse langsung menyempit ke OrderStatus.
  to: z.enum([
    'new',
    'paid',
    'scheduled',
    'preparation',
    'slaughtering',
    'distribution',
    'documentation',
    'reporting',
    'completed',
    'on_hold',
    'cancelled',
  ]),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
});

/**
 * Verifikasi order tamu.
 *
 * Hanya `order_id` — waktu dan pelaku verifikasi diturunkan di server, tidak
 * pernah dikirim klien, sama seperti `resolved_at` pada kendala. Penguncian
 * optimistiknya melekat pada update-nya sendiri (`guest_verified_at is null`),
 * jadi tidak perlu penanda versi dari layar.
 */
export const verifyGuestOrderSchema = z.object({ order_id: uuid });

export const addAnimalSchema = animalInputSchema.extend({ order_id: uuid });

export const updateAnimalStatusSchema = z.object({
  animal_id: uuid,
  status: z.enum(['registered', 'prepared', 'slaughtered', 'distributed']),
});

export const deleteAnimalSchema = z.object({ animal_id: uuid });

/**
 * Asal order pada daftar admin (`prd.md` FR-C2).
 *
 * Order tamu hanya bertanda `created_by is null` di database; tanpa filter ini
 * tidak ada cara melihatnya sebagai kelompok tersendiri. `guest_pending` adalah
 * antrian verifikasinya — order publik yang belum diperiksa siapa pun.
 */
export const ORDER_SOURCES = ['guest_pending', 'guest', 'staff'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  guest_pending: 'Tamu — perlu verifikasi',
  guest: 'Tamu — semua',
  staff: 'Dibuat staf',
};

/** Tanggal kalender `YYYY-MM-DD` dari input `<input type="date">`. */
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

/**
 * Filter & pencarian list order (docs/16 section 1).
 *
 * Seluruh isinya berasal dari query string yang bisa disunting siapa saja, jadi
 * setiap field memakai `.catch()`: nilai ngawur jatuh ke default alih-alih
 * melempar. Tanpa itu, `?page=abc` atau `?status=xyz` membuat halaman daftar
 * order gagal render — enum yang tidak dikenal juga akan ditolak Postgres saat
 * dipakai di `.eq()`.
 */
export const orderFilterSchema = z.object({
  status: z
    .enum([
      'new',
      'paid',
      'scheduled',
      'preparation',
      'slaughtering',
      'distribution',
      'documentation',
      'reporting',
      'completed',
      'on_hold',
      'cancelled',
    ])
    .optional()
    .catch(undefined),
  payment_status: z.enum(['unpaid', 'partial', 'paid']).optional().catch(undefined),
  source: z.enum(ORDER_SOURCES).optional().catch(undefined),
  branch_id: uuid.optional().catch(undefined),
  location_id: uuid.optional().catch(undefined),
  pic_id: uuid.optional().catch(undefined),
  date_from: calendarDate.optional().catch(undefined),
  date_to: calendarDate.optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  page_size: z.coerce.number().int().min(5).max(100).default(20).catch(20),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderFilterInput = z.infer<typeof orderFilterSchema>;
export type AnimalInput = z.infer<typeof animalInputSchema>;
