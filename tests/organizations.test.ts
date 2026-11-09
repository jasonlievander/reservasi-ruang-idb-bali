import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  ORGANIZATION_CATALOG,
} from "@/lib/organizations";

describe("katalog organisasi IDB Bali", () => {
  it("memuat 15 UKM dan 7 HMJ sesuai daftar resmi", () => {
    const ukm = ORGANIZATION_CATALOG.filter(
      (item) => item.category === "UKM",
    );
    const hmj = ORGANIZATION_CATALOG.filter(
      (item) => item.category === "HMJ",
    );

    expect(ukm).toHaveLength(15);
    expect(hmj).toHaveLength(7);
    expect(ORGANIZATION_CATALOG).toHaveLength(22);
  });

  it("memuat nama organisasi yang diminta tanpa duplikat", () => {
    const names = ORGANIZATION_CATALOG.map((item) => item.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        "Putra Putri Kampus",
        "Creativepreneur",
        "Euphemia Chatra (PHETRA)",
        "Mapala Widya Bhuana",
        "Densoft 66",
        "Kamala Rajni",
        "Obscura",
        "Thunder Dance",
        "Gravity Football Club",
        "Lontar",
        "Gravity Music Squad (GMS)",
        "Perkamen",
        "Teater Biru Jingga",
        "Goldmonk Yoga",
        "Bluerange E-Sport",
        "Gravity (DKV)",
        "Wicwakarma (DI)",
        "Damoda (DM)",
        "Executive (BD)",
        "Theorema (MB)",
        "Creanova (STI)",
        "Citrakara (Arsitek)",
      ]),
    );
  });

  it("menyediakan label kelompok untuk dropdown", () => {
    expect(CATEGORY_ORDER).toEqual(["UKM", "HMJ"]);
    expect(CATEGORY_LABELS.UKM).toContain("Unit Kegiatan Mahasiswa");
    expect(CATEGORY_LABELS.HMJ).toContain("Himpunan Mahasiswa Jurusan");
  });
});
