import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export default function setup() {
  const root = path.resolve(__dirname, "..");
  const databasePath = path.join(root, "prisma", "test.db");
  const prismaCli = path.join(
    root,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );

  for (const file of [databasePath, `${databasePath}-journal`]) {
    if (fs.existsSync(file)) {
      fs.rmSync(file);
    }
  }

  execFileSync(
    process.execPath,
    [prismaCli, "db", "push", "--skip-generate", "--accept-data-loss"],
    {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: "file:./test.db",
      },
      stdio: "inherit",
    },
  );
}
