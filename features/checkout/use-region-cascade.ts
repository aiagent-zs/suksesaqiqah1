'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchRegionChildren } from './regions';
import type { RegionOption } from './queries';

/**
 * Pemuatan wilayah bertingkat, dipakai bersama pemilih alamat pemesan
 * (checkout) dan pemilih alamat mitra (`/vendors/{id}`).
 *
 * Yang diekstrak ke sini **hanya keadaannya**, bukan tampilannya: keduanya
 * merender medan yang berbeda — checkout menandai wajib dan memakai kunci galat
 * `delivery_*`, formulir mitra tidak. Yang sama persis justru bagian yang paling
 * halus dan paling mahal kalau salah, dan itulah alasan ekstraksinya.
 *
 * Isi daftar dikunci **kode induknya**, bukan tingkatnya. Kunci itu yang
 * menyelesaikan balapan: mengganti provinsi dua kali dengan cepat membuat dua
 * permintaan berjalan bersamaan, dan yang lebih lambat bisa mendarat
 * belakangan. Kalau hasilnya disimpan per tingkat, daftar kabupaten provinsi
 * **pertama** akan menimpa yang kedua dan orang memilih kota yang bukan bagian
 * dari provinsinya. Disimpan per induk, hasil yang tidak lagi relevan cukup
 * mengendap tanpa pernah ditampilkan.
 *
 * Sekaligus jadi singgahan: kembali ke provinsi yang tadi sudah dibuka tidak
 * menimbulkan permintaan baru.
 */
export function useRegionCascade(parents: Array<string | null | undefined>) {
  const [byParent, setByParent] = useState<Record<string, RegionOption[]>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  /** Induk yang permintaannya sedang berjalan — penjaga agar tidak dobel. */
  const inFlight = useRef<Set<string>>(new Set());

  // Daftar induk digabung jadi satu string supaya efeknya tidak berjalan ulang
  // tiap render hanya karena arraynya baru dibuat.
  const key = parents.join('|');

  useEffect(() => {
    for (const parent of key.split('|')) {
      if (!parent) continue;
      if (parent in byParent || failed[parent] || inFlight.current.has(parent)) continue;

      inFlight.current.add(parent);
      fetchRegionChildren(parent)
        .then((rows) => setByParent((prev) => ({ ...prev, [parent]: rows })))
        .catch(() => setFailed((prev) => ({ ...prev, [parent]: true })))
        .finally(() => inFlight.current.delete(parent));
    }
  }, [key, byParent, failed]);

  return {
    /**
     * Isi & keadaan satu tingkat, **diturunkan** dari kode induknya — tidak
     * disimpan terpisah. Mengosongkan daftar saat induknya dilepas tidak butuh
     * setState sama sekali: tanpa induk, tidak ada yang bisa ditampilkan.
     */
    stateOf(parent: string | null | undefined) {
      if (!parent) return { parent: '', options: [] as RegionOption[], loading: false };
      return {
        parent,
        options: byParent[parent] ?? [],
        loading: !(parent in byParent) && !failed[parent],
      };
    },

    hasFailed(parent: string | null | undefined) {
      return Boolean(parent && failed[parent]);
    },

    /**
     * Cukup dilepas dari daftar gagal: efek di atas melihat induknya belum
     * pernah berhasil dimuat lalu mencoba lagi.
     */
    retry(parent: string) {
      setFailed((prev) => {
        const next = { ...prev };
        delete next[parent];
        return next;
      });
    },
  };
}
