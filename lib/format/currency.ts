/** Format angka menjadi Rupiah, mis. 2300000 → "Rp2.300.000". */
export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}
