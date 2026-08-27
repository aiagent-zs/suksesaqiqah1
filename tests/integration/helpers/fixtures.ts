/**
 * Pembuat data uji untuk tes integrasi.
 *
 * Setiap fungsi di sini menyisipkan baris **di dalam transaksi yang akan
 * dibatalkan** (lihat `inRollback`), jadi tidak ada yang perlu dibersihkan dan
 * tidak ada tes yang bisa mengotori tes lain.
 *
 * ## Kenapa tidak memakai order dari seed
 *
 * `02_demo.sql` menyisipkan tahap-tahapnya **secara manual** — komentarnya
 * sendiri menyebut alasannya: seed membuat order yang sudah `in_progress`,
 * sementara `generate_stage_checklist` hanya menyala pada transisi status ke
 * `assigned`. Artinya order seed justru **tidak** membuktikan trigger itu
 * bekerja. Tes ini harus menempuh transisinya sendiri.
 */
import type postgres from 'postgres';

/** ID tetap dari `supabase/seed`. Dipakai agar tes tidak perlu menebak. */
export const SEED = {
  superadmin: 'd0000000-0000-4000-8000-000000000001',
  admin: 'd0000000-0000-4000-8000-000000000002',
  vendorUserA: 'd0000000-0000-4000-8000-000000000003',
  vendorA: 'c0000000-0000-4000-8000-000000000001',
  vendorB: 'c0000000-0000-4000-8000-000000000002',
  /** Aqiqah kambing standar, dilayani vendor A. */
  serviceKambing: 'a2000000-0000-4000-8000-000000000002',
  participant: 'e0000000-0000-4000-8000-000000000001',
} as const;

export type StageRow = {
  id: string;
  stage: string;
  seq: number;
  status: string;
  animal_id: string | null;
};

/**
 * Order baru berstatus `paid`, siap ditugaskan ke mitra.
 *
 * Sengaja berhenti di `paid`: transisi `paid -> assigned` itulah yang memicu
 * `generate_stage_checklist`, dan tes harus menempuhnya sendiri agar
 * pemicunya benar-benar teruji.
 *
 * `order_number` dibiarkan kosong — trigger `set_order_number` yang mengisi,
 * sehingga penomoran atomik ikut terlewati jalur tes ini.
 */
export async function makePaidOrder(
  tx: postgres.TransactionSql,
  opts: {
    mode: 'salur' | 'kirim';
    animals?: number;
    vendorId?: string | null;
  },
): Promise<{ orderId: string; animalIds: string[] }> {
  const { mode, animals = 1, vendorId = SEED.vendorA } = opts;

  const [order] = await tx<{ id: string }[]>`
    insert into public.orders (
      participant_id, vendor_id, status, payment_status,
      total_amount, paid_amount, distribution_mode, aqiqah_for,
      requested_date, requested_time,
      ${mode === 'kirim' ? tx`delivery_address,` : tx``}
      guest_verified_at, guest_verified_by
    ) values (
      ${SEED.participant}, ${vendorId},
      'paid'::public.order_status, 'paid'::public.payment_status,
      2800000, 2800000, ${mode}::public.distribution_mode, 'laki_laki',
      current_date + 3, '09:00',
      ${mode === 'kirim' ? tx`'Jl. Uji No. 1, Bandung',` : tx``}
      now(), ${SEED.admin}
    )
    returning id
  `;

  // `order_items_qty_check` menuntut qty > 0, jadi kasus "order tanpa hewan"
  // tidak boleh menurunkan qty dari jumlah hewan. Keduanya memang bukan hal
  // yang sama: item adalah yang dibeli, `animals` adalah ekor yang teregistrasi.
  await tx`
    insert into public.order_items (order_id, service_id, qty, unit_price, vendor_unit_price)
    values (${order.id}, ${SEED.serviceKambing}, ${Math.max(animals, 1)}, 2800000, 2325000)
  `;

  const animalIds: string[] = [];
  for (let i = 0; i < animals; i += 1) {
    const [animal] = await tx<{ id: string }[]>`
      insert into public.animals (order_id, species, tag_code, weight_kg, on_behalf_of)
      values (
        ${order.id}, 'kambing'::public.animal_species,
        ${`UJI-${i + 1}`}, 28.5, ${`Anak Uji ${i + 1}`}
      )
      returning id
    `;
    animalIds.push(animal.id);
  }

  return { orderId: order.id, animalIds };
}

/**
 * Tugaskan mitra — inilah transisi yang memicu penerbitan daftar tahap.
 *
 * Dijalankan sebagai `postgres` (bukan lewat RLS) supaya yang teruji adalah
 * trigger-nya, bukan kebijakan aksesnya. Penegakan akses diuji terpisah di
 * `enforce_vendor_assignment`.
 */
export async function assignVendor(tx: postgres.TransactionSql, orderId: string): Promise<void> {
  await tx`
    update public.orders set status = 'assigned'::public.order_status
    where id = ${orderId}
  `;
}

/** Daftar tahap sebuah order, terurut sebagaimana gerbang urutan membacanya. */
export async function stagesOf(tx: postgres.TransactionSql, orderId: string): Promise<StageRow[]> {
  return tx<StageRow[]>`
    select id, stage::text as stage, seq, status::text as status, animal_id
    from public.order_stage_events
    where order_id = ${orderId}
    order by seq, animal_id nulls first
  `;
}

/**
 * Laporkan sebuah tahap sebagai vendor.
 *
 * `reported_by` diisi supaya `enforce_stage_review` punya bahan untuk menolak
 * validasi-oleh-pelapor-sendiri.
 */
export async function reportStage(
  tx: postgres.TransactionSql,
  stageId: string,
  reporterId: string = SEED.vendorUserA,
): Promise<void> {
  await tx`
    update public.order_stage_events set
      status = 'reported'::public.stage_event_status,
      reported_by = ${reporterId},
      reported_at = now(),
      occurred_at = now()
    where id = ${stageId}
  `;
}

/**
 * Validasi sebuah tahap sebagai admin.
 *
 * `validated_by`/`validated_at` **tidak** dikirim: `enforce_stage_review`
 * menurunkannya dari `auth.uid()`. Mengirimnya dari sini justru akan
 * menyembunyikan kalau trigger itu berhenti bekerja.
 */
export async function validateStage(tx: postgres.TransactionSql, stageId: string): Promise<void> {
  await tx`
    update public.order_stage_events
    set status = 'validated'::public.stage_event_status
    where id = ${stageId}
  `;
}
