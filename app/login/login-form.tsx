"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, AlertCircle } from "@/app/_components/icons";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          response.status === 429
            ? "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi."
            : payload?.error?.message ?? "Email atau password salah.",
        );
        return;
      }

      router.replace("/app");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Email kampus</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nama@idbbali.ac.id"
          required
        />
      </label>

      <label className="field">
        <span>Password</span>
        <span className="input-with-action">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            type="button"
            className="input-action"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword ? "Sembunyikan password" : "Tampilkan password"
            }
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>

      {error ? (
        <p className="form-error" role="alert">
          <AlertCircle size={18} />
          {error}
        </p>
      ) : null}

      <button className="btn btn--primary btn--wide" type="submit" disabled={busy} aria-busy={busy}>
        {busy ? "Memeriksa..." : "Masuk"}
        {busy ? null : <ArrowRight size={18} />}
      </button>

      <p className="login-help">
        Belum punya akses? Hubungi pengelola sarana prasarana kampus.
      </p>
    </form>
  );
}
