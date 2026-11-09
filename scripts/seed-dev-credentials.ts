import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "../src/lib/auth/password";
import { prisma } from "../src/lib/prisma";

const emails = [
  "admin@example.test",
  "pengelola@example.test",
  "peminjam@example.test",
  "peminjam2@example.test",
];

async function main() {
  const credentials: Array<{
    email: string;
    password: string;
    role: string;
  }> = [];

  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      continue;
    }

    const password = randomBytes(15).toString("base64url");
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });

    credentials.push({ email, password, role: user.role });
  }

  const target = path.join(process.cwd(), ".dev-credentials.json");
  fs.writeFileSync(target, JSON.stringify(credentials, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });

  console.log(
    `Kredensial dev untuk ${credentials.length} akun ditulis ke .dev-credentials.json`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
