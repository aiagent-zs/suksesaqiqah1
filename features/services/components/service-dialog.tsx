'use client';

import { useState, type ReactElement } from 'react';
import { Modal } from '@/components/ui/modal';
import { ServiceForm } from './service-form';
import { ServicePhotoField } from './service-photo-field';
import type { ServiceRow } from '../queries';

/**
 * Formulir paket dalam modal — untuk **menambah** dan **menyunting**.
 *
 * ## Kenapa modal
 *
 * Formulir ini punya 14 medan. Dirender di dalam halaman, ia mendorong seluruh
 * daftar ke bawah layar sehingga baris yang sedang dikerjakan berpindah dari
 * tempat yang tadi dilihat operator — keluhan yang sama sudah tercatat di
 * `user-dialog.tsx` dan `location-dialog.tsx`, dan keduanya diselesaikan begini.
 *
 * ## Menyunting tetap punya halaman sendiri
 *
 * `/vendors/katalog/{id}` **tidak dihapus**, dan tombol "Lihat" tetap menuju ke
 * sana. Keduanya menjawab kebutuhan berbeda: modal ini untuk perbaikan cepat
 * (salah harga, salah nama) tanpa kehilangan tempat di daftar, halaman detail
 * untuk hal-hal yang memang tidak muat — foto, kaitan ke order & mitra, dan
 * tombol aktif/non-aktif yang butuh konteks jumlah order.
 */
export function ServiceDialog({
  service,
  publicBase,
  trigger,
}: {
  /** Diisi = mode sunting. Dikosongkan = mode tambah. */
  service?: ServiceRow;
  /**
   * `NEXT_PUBLIC_SUPABASE_URL`, diteruskan dari server.
   *
   * Dipakai `ServicePhotoField` merakit URL publik foto. Diterima sebagai prop
   * alih-alih dibaca ulang di klien supaya satu sumbernya jelas — pola yang
   * sama dengan halaman detail paket.
   */
  publicBase: string;
  /** Elemen pemicu; base-ui menyatukan propsnya lewat `render`. */
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(service);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      // `lg`: blok isi paket & konten landing dirender dua kolom pada layar
      // lebar, dan lebar `md` membuat keduanya menumpuk tanpa alasan.
      width="lg"
      title={isEdit ? `Ubah ${service?.name}` : 'Tambah paket baru'}
      description={
        isEdit
          ? 'Perubahan langsung terlihat di halaman depan dan checkout. Order yang sudah berjalan tidak ikut berubah.'
          : 'Paket langsung bisa dipesan begitu disimpan. Centang “dipasarkan di halaman depan” bila ingin ia tampil sebagai kartu di beranda.'
      }
    >
      {/* Foto **di atas** formulir, dan terpisah darinya.

          Dua aturan penyimpanan yang berbeda: foto tersimpan seketika saat
          diunggah (berkasnya sudah masuk Storage dan `photo_path` ikut
          ditulis), sementara medan lain baru tersimpan saat "Simpan perubahan"
          ditekan. Menyatukannya dalam satu blok membuat satu formulir punya dua
          perilaku tanpa ada yang memberi tahu — jadi jaraknya sengaja dijaga,
          sama seperti di halaman detail paket.

          Hanya pada mode sunting: `ServicePhotoField` butuh `serviceId`, dan
          paket baru belum punya id sampai tersimpan. Pesan di bawah
          mengatakannya alih-alih membiarkan bagiannya hilang tanpa penjelasan. */}
      {service ? (
        <div className="border-border mb-5 border-b pb-5">
          <ServicePhotoField
            serviceId={service.id}
            slug={service.slug}
            photoPath={service.photoPath}
            photoAlt={service.photoAlt}
            publicBase={publicBase}
          />
        </div>
      ) : (
        <p className="text-muted-foreground border-border mb-5 border-b pb-5 text-xs">
          Foto paket bisa diunggah setelah paket ini tersimpan — buka kembali lewat tombol{' '}
          <strong>Edit</strong> di daftar.
        </p>
      )}

      <ServiceForm
        service={service}
        onCancel={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </Modal>
  );
}
