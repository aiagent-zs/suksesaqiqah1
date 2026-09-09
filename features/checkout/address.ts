/**
 * Bentuk alamat pengiriman — data murni, tanpa React.
 *
 * Dipisah dari `components/address-picker.tsx` karena `draft.ts` membutuhkannya
 * dan **hanya** membutuhkannya. Selama ia tinggal di dalam komponen, mengimpor
 * satu tipe menyeret serta seluruh rantai UI-nya: lucide-react, Base UI, dan
 * empat komponen `components/ui/`. Tes penyimpanan draft memanggil
 * `vi.resetModules()` di tiap kasus, jadi rantai itu dimuat ulang belasan kali
 * dan sesekali menembus batas waktu 5 detik — kegagalan yang tidak ada
 * hubungannya dengan apa yang sedang diuji.
 *
 * Kode **dan** nama disimpan berdampingan: kodenya yang dikirim ke server,
 * namanya hanya untuk ditampilkan di tahap ringkasan. Nama tidak pernah ikut ke
 * RPC — `create_guest_order` membacanya sendiri dari `regions` berdasarkan
 * kodenya, karena nama yang dikirim klien bisa tidak cocok dengan kodenya, dan
 * yang dibaca kurir adalah namanya.
 */
export type DeliveryAddressValue = {
  province_code: string;
  province_name: string;
  city_code: string;
  city_name: string;
  district_code: string;
  district_name: string;
  village_code: string;
  village_name: string;
  postal_code: string;
  detail: string;
};

export const EMPTY_DELIVERY_ADDRESS: DeliveryAddressValue = {
  province_code: '',
  province_name: '',
  city_code: '',
  city_name: '',
  district_code: '',
  district_name: '',
  village_code: '',
  village_name: '',
  postal_code: '',
  detail: '',
};
