import { expireOverdueReservations } from "../src/lib/approvals";
import { prisma } from "../src/lib/prisma";

async function main() {
  const expired = await expireOverdueReservations({ db: prisma });
  console.log(`Reservasi kedaluwarsa: ${expired}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
