/**
 * Pisahkan isi paket yang dimiliki semua paket dari yang membedakannya.
 *
 * Di 375px tiga kartu paket aqiqah masing-masing ±430px, padahal enam dari
 * tujuh barisnya sama persis. Yang sama ditulis sekali di atas kisi; tiap
 * kartu hanya memuat pembedanya, jadi tidak ada informasi yang disembunyikan.
 *
 * Satu paket saja: tidak ada yang bisa dibandingkan, semuanya tetap di kartu.
 */
export function splitCommonFeatures(lists: string[][]): { common: string[]; unique: string[][] } {
  if (lists.length < 2) return { common: [], unique: lists };
  const common = lists[0].filter((item) => lists.every((list) => list.includes(item)));
  return { common, unique: lists.map((list) => list.filter((item) => !common.includes(item))) };
}
