export { default, metadata } from '../../checkout/page';

// Ditulis ulang, bukan diekspor ulang: Next hanya membaca konfigurasi rute yang
// dideklarasikan langsung di berkasnya.
export const dynamic = 'force-dynamic';
