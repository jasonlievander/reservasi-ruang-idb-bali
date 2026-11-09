"use client";

import { useCallback, useEffect, useState } from "react";
import { Refresh, Search } from "@/app/_components/icons";
import { useToast } from "./toast";
import { EmptyState, ErrorNote, Skeleton, initials, roleLabel } from "./ui";
import type { AdminUser, Role } from "@/app/app/types";

export function AdminUsers() {
  const { notify } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gagal memuat akun.");
      }
      setUsers(payload.users ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat akun.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (
    user: AdminUser,
    patch: { role?: Role; active?: boolean },
  ) => {
    setSavingId(user.id);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Perubahan gagal disimpan.");
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, ...payload.user } : item,
        ),
      );
      notify("Akun diperbarui dan tercatat di audit log.", "success");
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "Perubahan gagal disimpan.",
        "error",
      );
    } finally {
      setSavingId(null);
    }
  };

  const filtered = users.filter((user) => {
    const text = `${user.name} ${user.email}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  return (
    <div className="stack-xl">
      <section className="page-head page-head--row">
        <div>
          <p className="mono-label">Administrasi akun</p>
          <h1>Peran yang rapi, akses yang jelas.</h1>
          <p className="page-head__lead">
            Ubah peran dan status aktif. Setiap perubahan dicatat atas nama
            admin yang bertindak.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          <Refresh size={17} /> Muat ulang
        </button>
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading--row">
          <div>
            <p className="mono-label">Daftar akun</p>
            <h2>{users.length} pengguna</h2>
          </div>
          <label className="search-input">
            <Search size={17} />
            <span className="sr-only">Cari pengguna</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama atau email"
            />
          </label>
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {loading ? (
          <Skeleton lines={5} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Pengguna tidak ditemukan">
            Coba kata kunci lain atau muat ulang daftar.
          </EmptyState>
        ) : (
          <div className="admin-table" role="table" aria-label="Daftar akun">
            <div className="admin-table__head" role="row">
              <span role="columnheader">Pengguna</span>
              <span role="columnheader">Peran</span>
              <span role="columnheader">Status</span>
            </div>
            {filtered.map((user) => (
              <div className="admin-table__row" role="row" key={user.id}>
                <div className="admin-user-cell" role="cell">
                  <span className="avatar avatar--sm" aria-hidden="true">
                    {initials(user.name)}
                  </span>
                  <span>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </span>
                </div>
                <div role="cell">
                  <label className="sr-only" htmlFor={`role-${user.id}`}>
                    Peran {user.name}
                  </label>
                  <select
                    id={`role-${user.id}`}
                    className="table-select"
                    value={user.role}
                    disabled={savingId === user.id}
                    onChange={(event) =>
                      void update(user, {
                        role: event.target.value as Role,
                      })
                    }
                  >
                    {(["PEMINJAM", "PENGELOLA", "ADMIN"] as Role[]).map(
                      (role) => (
                        <option key={role} value={role}>
                          {roleLabel[role]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div role="cell">
                  <button
                    type="button"
                    className={`switch${user.active ? " is-on" : ""}`}
                    aria-pressed={user.active}
                    disabled={savingId === user.id}
                    onClick={() =>
                      void update(user, { active: !user.active })
                    }
                  >
                    <span className="switch__track" aria-hidden="true">
                      <span className="switch__thumb" />
                    </span>
                    {user.active ? "Aktif" : "Nonaktif"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
