import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { LoginSlideshow } from "./login-slideshow";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
  const user = await getSessionUser(token);

  if (user) {
    redirect("/app");
  }

  return (
    <main className="login-page">
      <section className="login-visual" aria-label="IDB Bali">
        <LoginSlideshow />
        <div className="login-visual__scrim" />
        <div className="login-visual__content">
          <p className="mono-label login-visual__greeting">Selamat Datang di SIRU</p>
          <h1>Sistem Reservasi Ruangan</h1>
          <p className="login-visual__lead">
            Temukan ruang yang kosong, ajukan peminjaman, dan ikuti statusnya
            tanpa bolak-balik ke petugas.
          </p>
          <div className="login-visual__rule" />
          <div className="login-visual__meta">
            <span>Denpasar, Bali</span>
            <span>WITA · UTC+8</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel__inner">
          <div className="login-brand">
            <Image
              src="/brand/idb-logo.png"
              alt="IDB Bali — Institut Desain dan Bisnis Bali"
              width={150}
              height={98}
              priority
            />
          </div>
          <p className="mono-label">Masuk ke SIRU</p>
          <h2>Satu ruangan, satu waktu.</h2>
          <p className="login-panel__lead">
            Gunakan akun kampus Anda untuk mencari ruangan dan mengelola
            reservasi.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
