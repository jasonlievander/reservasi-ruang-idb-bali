import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.notification.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.slotBlock.deleteMany();
  await prisma.roomManager.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.room.deleteMany();
  console.log("Data reservasi, blokir, organisasi, dan ruangan demo dihapus.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
