/** Batas atas jumlah ekor per pesanan. */
export const MAX_QTY = 20;

export const AQIQAH_FOR_OPTIONS = [
  { value: 'laki_laki', label: 'Anak Laki-laki', hint: 'Rekomendasi 2 ekor' },
  { value: 'perempuan', label: 'Anak Perempuan', hint: 'Rekomendasi 1 ekor' },
];
export const SERVICE_TYPE_LABEL: Record<string, string> = {
  aqiqah: 'Aqiqah',
  // qurban: 'Qurban',
};

export const RECOMMENDED_QTY: Record<string, number> = { laki_laki: 2, perempuan: 1 };

export const DISTRIBUTION_OPTIONS = [
  {
    value: 'salur',
    label: 'Aqiqah Salur',
    hint: 'Daging disalurkan ke penghafal Qur’an dan dhuafa oleh tim kami.',
  },
  {
    value: 'kirim',
    label: 'Aqiqah Kirim',
    hint: 'Hasil olahan diantar ke alamat yang Anda tentukan.',
  },
];
