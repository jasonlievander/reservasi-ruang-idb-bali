import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password lokal", () => {
  it("menyimpan hash scrypt tanpa plaintext", async () => {
    const password = "rahasia-sintetis-uji";
    const hash = await hashPassword(password);

    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it("menggunakan salt berbeda untuk password yang sama", async () => {
    const password = "rahasia-sintetis-uji";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
    expect(await verifyPassword(password, second)).toBe(true);
  });

  it("menolak password yang salah dan hash yang rusak", async () => {
    const hash = await hashPassword("password-benar");

    expect(await verifyPassword("password-salah", hash)).toBe(false);
    expect(await verifyPassword("password-benar", null)).toBe(false);
    expect(await verifyPassword("password-benar", "bukan-hash")).toBe(false);
  });
});
