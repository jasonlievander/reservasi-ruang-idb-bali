export type OrganizationCategory = "UKM" | "HMJ";

export type OrganizationCatalogEntry = {
  name: string;
  category: OrganizationCategory;
};

export const ORGANIZATION_CATALOG: OrganizationCatalogEntry[] = [
  { name: "Putra Putri Kampus", category: "UKM" },
  { name: "Creativepreneur", category: "UKM" },
  { name: "Euphemia Chatra (PHETRA)", category: "UKM" },
  { name: "Mapala Widya Bhuana", category: "UKM" },
  { name: "Densoft 66", category: "UKM" },
  { name: "Kamala Rajni", category: "UKM" },
  { name: "Obscura", category: "UKM" },
  { name: "Thunder Dance", category: "UKM" },
  { name: "Gravity Football Club", category: "UKM" },
  { name: "Lontar", category: "UKM" },
  { name: "Gravity Music Squad (GMS)", category: "UKM" },
  { name: "Perkamen", category: "UKM" },
  { name: "Teater Biru Jingga", category: "UKM" },
  { name: "Goldmonk Yoga", category: "UKM" },
  { name: "Bluerange E-Sport", category: "UKM" },
  { name: "Gravity (DKV)", category: "HMJ" },
  { name: "Wicwakarma (DI)", category: "HMJ" },
  { name: "Damoda (DM)", category: "HMJ" },
  { name: "Executive (BD)", category: "HMJ" },
  { name: "Theorema (MB)", category: "HMJ" },
  { name: "Creanova (STI)", category: "HMJ" },
  { name: "Citrakara (Arsitek)", category: "HMJ" },
];

export const CATEGORY_LABELS: Record<OrganizationCategory, string> = {
  UKM: "UKM — Unit Kegiatan Mahasiswa",
  HMJ: "HMJ — Himpunan Mahasiswa Jurusan",
};

export const CATEGORY_ORDER: OrganizationCategory[] = ["UKM", "HMJ"];
