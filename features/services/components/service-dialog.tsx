'use client';

import { useState, type ReactElement } from 'react';
import { Modal } from '@/components/ui/modal';
import { ServiceForm } from './service-form';
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
  trigger,
}: {
  /** Diisi = mode sunting. Dikosongkan = mode tambah. */
  service?: ServiceRow;
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
      <ServiceForm
        service={service}
        onCancel={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </Modal>
  );
}
