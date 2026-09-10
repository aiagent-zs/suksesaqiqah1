-- Selaraskan `profiles.email` saat email login berpindah.
--
-- `auth.users` punya `on_auth_user_created` yang menyalin email saat akun
-- dibuat, tapi tidak ada satu pun trigger untuk saat email itu **berubah**.
-- Akibatnya sekali seseorang mengganti emailnya, `profiles.email` membeku pada
-- alamat lama — selamanya.
--
-- Itu bukan sekadar tampilan yang basi. `profiles.email` dibaca di daftar
-- pengguna, dipakai superadmin untuk mengenali akun, dan menjadi nilai awal
-- form saat ia menyunting akun orang lain. Superadmin yang menyimpan form itu
-- akan mengembalikan email login ke alamat lama tanpa bermaksud demikian —
-- `updateUser` membandingkan `v.email !== target.email` dan melihat sebuah
-- perubahan yang sebenarnya adalah data usang.
--
-- Ditulis di database, bukan di server action, karena perpindahan email tidak
-- selesai di aksi itu: Supabase baru memindahkannya ketika tautan konfirmasi
-- diklik dari alamat baru — di lain waktu, tanpa melewati kode kita.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set email = new.email,
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;

comment on function public.handle_user_email_change is
  'Menyalin auth.users.email ke profiles.email setiap kali email login berubah (mis. sesudah konfirmasi ganti email).';

drop trigger if exists on_auth_user_email_changed on auth.users;

-- `when` menyaring di database, bukan di badan fungsi: `auth.users` ikut
-- ter-UPDATE pada tiap login (last_sign_in_at) dan tiap refresh token, jadi
-- tanpa penyaring ini setiap orang yang masuk akan memicu UPDATE ke `profiles`
-- yang tidak mengubah apa pun.
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();
