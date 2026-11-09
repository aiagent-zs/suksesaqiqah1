import 'server-only';
import { headers } from 'next/headers';
import { BRANDS, CHANNEL_HEADER, parseChannel, type Brand, type Channel } from './brand';

/**
 * Kanal permintaan ini, dari header yang disetel `proxy.ts` menurut path.
 * Server action ikut membawanya: action dipanggil dari halaman `/aqiqahaja/...`
 * dan POST-nya menuju path halaman itu.
 */
export async function getChannel(): Promise<Channel> {
  return parseChannel((await headers()).get(CHANNEL_HEADER));
}

export async function getBrand(): Promise<Brand> {
  return BRANDS[await getChannel()];
}
