"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Refresh } from "@/app/_components/icons";
import { resetDemoData } from "@/lib/demo-store";
import { ToastProvider } from "./_components/toast";
import { initials, roleLabel } from "./_components/ui";
import { Overview } from "./_components/overview";
import { SearchExperience } from "./_components/search";
import { MyReservations } from "./_components/my-reservations";
import { ApprovalQueue } from "./_components/approvals";
import { RoomManager } from "./_components/room-manager";
import { ReportPanel } from "./_components/report-panel";
import { AdminUsers } from "./_components/admin-users";
import { CalendarView } from "./_components/calendar";
import type {
  OrganizationCatalogItem,
  Role,
  SessionUser,
} from "./types";

type TabId =
  | "ringkasan"
  | "cari"
  | "kalender"
  | "reservasi"
  | "persetujuan"
  | "ruangan"
  | "rekap"
  | "akun";

type Tab = {
  id: TabId;
  label: string;
};

const tabsByRole: Record<Role, Tab[]> = {
  PEMINJAM: [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "cari", label: "Cari ruangan" },
    { id: "kalender", label: "Kalender" },
    { id: "reservasi", label: "Reservasi saya" },
  ],
  PENGELOLA: [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "persetujuan", label: "Persetujuan" },
    { id: "kalender", label: "Kalender" },
    { id: "ruangan", label: "Ruangan" },
    { id: "rekap", label: "Rekap" },
  ],
  ADMIN: [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "persetujuan", label: "Persetujuan" },
    { id: "kalender", label: "Kalender" },
    { id: "ruangan", label: "Ruangan" },
    { id: "rekap", label: "Rekap" },
    { id: "akun", label: "Akun" },
  ],
};

export function Workspace({
  user,
  organizationCatalog,
}: {
  user: SessionUser;
  organizationCatalog: OrganizationCatalogItem[];
}) {
  const router = useRouter();
  const tabs = tabsByRole[user.role];
  const [tab, setTab] = useState<TabId>("ringkasan");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as TabId;
    if (tabs.some((item) => item.id === hash)) {
      setTab(hash);
    }
  }, [tabs]);

  useEffect(() => {
    const active = document.querySelector<HTMLElement>(
      '.app-nav__item[aria-current="page"]',
    );
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  const selectTab = (next: TabId) => {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  const resetDemo = () => {
    if (
      window.confirm(
        "Reset data demo? Reservasi yang dibuat dan perubahan status akan dihapus.",
      )
    ) {
      resetDemoData();
      window.location.reload();
    }
  };

  const content = useMemo(() => {
    switch (tab) {
      case "cari":
        return (
          <SearchExperience
            user={user}
            organizationCatalog={organizationCatalog}
            onViewReservations={() => selectTab("reservasi")}
          />
        );
      case "kalender":
        return <CalendarView />;
      case "reservasi":
        return <MyReservations user={user} />;
      case "persetujuan":
        return <ApprovalQueue user={user} />;
      case "ruangan":
        return <RoomManager />;
      case "rekap":
        return <ReportPanel role={user.role} />;
      case "akun":
        return <AdminUsers />;
      default:
        return (
          <Overview
            user={user}
            onNavigate={selectTab}
            canApprove={user.role !== "PEMINJAM"}
          />
        );
    }
  }, [tab, user, organizationCatalog]);

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header__inner">
            <button
              type="button"
              className="app-brand"
              onClick={() => selectTab("ringkasan")}
            >
              <Image
                src="/brand/idb-logo.png"
                alt="IDB Bali"
                width={104}
                height={68}
                className="app-brand__logo"
              />
              <span className="app-brand__rule" aria-hidden="true" />
              <span className="app-brand__text">
                <strong>SIRU</strong>
                <small>Sistem Reservasi Ruangan</small>
              </span>
            </button>

            <nav className="app-nav" aria-label="Navigasi utama">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`app-nav__item${tab === item.id ? " is-active" : ""}`}
                  onClick={() => selectTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="app-user">
              <span className="avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className="app-user__meta">
                <strong>{user.name}</strong>
                <small>{roleLabel[user.role]}</small>
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={logout}
                disabled={loggingOut}
                aria-label="Keluar"
                title="Keluar"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="app-main">{content}</main>

        <footer className="app-footer">
          <span>SIRU A� Sistem Reservasi Ruangan IDB Bali</span>
          <div className="app-footer__meta">
            <button type="button" className="text-button" onClick={resetDemo}>
              <Refresh size={14} /> Reset data demo
            </button>
            <span className="mono-label">WITA A� UTC+8</span>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
