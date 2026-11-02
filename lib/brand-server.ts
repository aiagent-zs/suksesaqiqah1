import 'server-only';
import { cookies } from 'next/headers';
import { BRANDS, CHANNEL_COOKIE, parseChannel, type Brand, type Channel } from './brand';

/** Kanal pengunjung saat ini, dari cookie yang disetel `proxy.ts`. */
export async function getChannel(): Promise<Channel> {
  return parseChannel((await cookies()).get(CHANNEL_COOKIE)?.value);
}

export async function getBrand(): Promise<Brand> {
  return BRANDS[await getChannel()];
}
