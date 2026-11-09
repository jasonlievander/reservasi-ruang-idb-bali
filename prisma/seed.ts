import { PrismaClient } from "@prisma/client";
import { ORGANIZATION_CATALOG } from "../src/lib/organizations";

const prisma = new PrismaClient();

type RoomSeed = {
  name: string;
  building: string;
  floor: string;
  capacity: number;
  facilities: string[];
  roomType: string;
  photoUrl: string;
  openTime?: string;
  closeTime?: string;
  requiresApproval?: boolean;
  maxDurationMinutes?: number;
  cancellationDeadlineMinutes?: number;
  attachmentRequired?: boolean;
};

const room = (data: RoomSeed) => ({
  ...data,
  facilities: JSON.stringify(data.facilities),
  openTime: data.openTime ?? "08:00",
  closeTime: data.closeTime ?? "17:00",
  requiresApproval: data.requiresApproval ?? true,
  maxDurationMinutes: data.maxDurationMinutes ?? 120,
  cancellationDeadlineMinutes: data.cancellationDeadlineMinutes ?? 60,
  attachmentRequired: data.attachmentRequired ?? false,
});

const rooms = [
  room({
    name: "A.1.1 (Studio Pola)",
    building: "Gedung A",
    floor: "1",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/lab-fashion.jpg",
    facilities: ["meja potong", "mesin jahit", "AC", "papan pola"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  }),
  room({
    name: "A.1.2 (Lect 1A)",
    building: "Gedung A",
    floor: "1",
    capacity: 40,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-kelas.jpg",
    facilities: ["proyektor", "AC", "whiteboard", "kursi"],
  }),
  room({
    name: "A.1.3 (Lab 1C)",
    building: "Gedung A",
    floor: "1",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-komputer.jpg",
    facilities: ["komputer", "AC", "proyektor"],
  }),
  room({
    name: "A.2.1 (Lab 2B)",
    building: "Gedung A",
    floor: "2",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-imac.jpg",
    facilities: ["iMac", "AC", "proyektor"],
  }),
  room({
    name: "A.2.2 (Lab 2C)",
    building: "Gedung A",
    floor: "2",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-komputer.jpg",
    facilities: ["komputer", "AC", "proyektor"],
  }),
  room({
    name: "A.2.3 (Lect 2D)",
    building: "Gedung A",
    floor: "2",
    capacity: 40,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-kelas.jpg",
    facilities: ["proyektor", "AC", "whiteboard", "kursi"],
  }),
  room({
    name: "B.2.1 (International)",
    building: "Gedung B",
    floor: "2",
    capacity: 36,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-meeting.jpg",
    facilities: ["TV", "AC", "whiteboard", "meja rapat"],
    maxDurationMinutes: 180,
  }),
  room({
    name: "B.1.3 (Studio 3)",
    building: "Gedung B",
    floor: "1",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/studio-gambar.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "whiteboard"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  }),
  room({
    name: "B.1.4 (Lab Fashion)",
    building: "Gedung B",
    floor: "1",
    capacity: 24,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-fashion.jpg",
    facilities: ["mesin jahit", "meja potong", "AC", "papan pola"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  }),
  room({
    name: "C.1.1 (Lab 1A)",
    building: "Gedung C",
    floor: "1",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-imac.jpg",
    facilities: ["iMac", "AC", "proyektor"],
  }),
  room({
    name: "C.1.2 (Lab STI)",
    building: "Gedung C",
    floor: "1",
    capacity: 32,
    roomType: "laboratorium",
    photoUrl: "/rooms/lab-komputer.jpg",
    facilities: ["komputer", "AC", "proyektor"],
  }),
  room({
    name: "C.1.3 (Lect 1)",
    building: "Gedung C",
    floor: "1",
    capacity: 40,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-kelas.jpg",
    facilities: ["proyektor", "AC", "whiteboard", "kursi"],
  }),
  room({
    name: "C.2.1 (Lect 2A)",
    building: "Gedung C",
    floor: "2",
    capacity: 40,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-kelas.jpg",
    facilities: ["proyektor", "AC", "whiteboard", "kursi"],
  }),
  room({
    name: "C.2.2 (Lect 2B)",
    building: "Gedung C",
    floor: "2",
    capacity: 40,
    roomType: "kelas",
    photoUrl: "/rooms/ruang-kelas.jpg",
    facilities: ["proyektor", "AC", "whiteboard", "kursi"],
  }),
  room({
    name: "C.2.3 (Studio 2C)",
    building: "Gedung C",
    floor: "2",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/studio-maket.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "whiteboard"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  }),
  room({
    name: "C.3.1 (Studio 3A)",
    building: "Gedung C",
    floor: "3",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/studio-gambar.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "whiteboard"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  }),
  room({
    name: "C.3.2 (Studio 3B)",
    building: "Gedung C",
    floor: "3",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/studio-maket.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "whiteboard"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  }),
  room({
    name: "C.3.3 (Studio 3C)",
    building: "Gedung C",
    floor: "3",
    capacity: 24,
    roomType: "studio",
    photoUrl: "/rooms/studio-produksi.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "whiteboard"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  }),
  room({
    name: "AULA IDB BALI",
    building: "Gedung A",
    floor: "1",
    capacity: 200,
    roomType: "aula",
    photoUrl: "/rooms/aula.jpg",
    facilities: ["sound system", "proyektor", "AC", "panggung"],
    closeTime: "22:00",
    maxDurationMinutes: 480,
    attachmentRequired: true,
  }),
  room({
    name: "STUDIO FOTO IDB BALI",
    building: "Gedung B",
    floor: "1",
    capacity: 20,
    roomType: "studio",
    photoUrl: "/rooms/studio-produksi.jpg",
    facilities: ["lampu studio", "backdrop", "AC", "kamera"],
    closeTime: "21:00",
    maxDurationMinutes: 180,
  }),
  room({
    name: "ROOFTOP IDB BALI",
    building: "Gedung B",
    floor: "Atap",
    capacity: 80,
    roomType: "luar",
    photoUrl: "/rooms/gedung.jpg",
    facilities: ["area terbuka", "listrik", "pemandangan kampus"],
    openTime: "06:00",
    closeTime: "22:00",
    requiresApproval: false,
    maxDurationMinutes: 240,
    cancellationDeadlineMinutes: 0,
  }),
  room({
    name: "INBIS IDB BALI",
    building: "Gedung B",
    floor: "2",
    capacity: 40,
    roomType: "rapat",
    photoUrl: "/rooms/ruang-meeting.jpg",
    facilities: ["TV", "AC", "whiteboard", "meja rapat"],
    maxDurationMinutes: 180,
  }),
  room({
    name: "HALAMAN IDB BALI GEDUNG A",
    building: "Gedung A",
    floor: "Halaman",
    capacity: 100,
    roomType: "luar",
    photoUrl: "/rooms/gedung.jpg",
    facilities: ["area terbuka", "listrik", "parkir"],
    openTime: "06:00",
    closeTime: "22:00",
    requiresApproval: false,
    maxDurationMinutes: 240,
    cancellationDeadlineMinutes: 0,
  }),
  room({
    name: "HALAMAN IDB BALI GEDUNG B",
    building: "Gedung B",
    floor: "Halaman",
    capacity: 100,
    roomType: "luar",
    photoUrl: "/rooms/gedung.jpg",
    facilities: ["area terbuka", "listrik", "parkir"],
    openTime: "06:00",
    closeTime: "22:00",
    requiresApproval: false,
    maxDurationMinutes: 240,
    cancellationDeadlineMinutes: 0,
  }),
  room({
    name: "HALAMAN IDB BALI GEDUNG C",
    building: "Gedung C",
    floor: "Halaman",
    capacity: 100,
    roomType: "luar",
    photoUrl: "/rooms/gedung.jpg",
    facilities: ["area terbuka", "listrik", "parkir"],
    openTime: "06:00",
    closeTime: "22:00",
    requiresApproval: false,
    maxDurationMinutes: 240,
    cancellationDeadlineMinutes: 0,
  }),
  room({
    name: "GEDUNG SERBA GUNA IDB BALI - Lt.1",
    building: "Gedung Serba Guna",
    floor: "1",
    capacity: 150,
    roomType: "serbaguna",
    photoUrl: "/rooms/serbaguna.jpg",
    facilities: ["sound system", "proyektor", "AC", "panggung"],
    closeTime: "22:00",
    maxDurationMinutes: 480,
    attachmentRequired: true,
  }),
  room({
    name: "GEDUNG SERBA GUNA IDB BALI - Lt.2",
    building: "Gedung Serba Guna",
    floor: "2",
    capacity: 150,
    roomType: "serbaguna",
    photoUrl: "/rooms/serbaguna.jpg",
    facilities: ["sound system", "proyektor", "AC", "panggung"],
    closeTime: "22:00",
    maxDurationMinutes: 480,
    attachmentRequired: true,
  }),
  room({
    name: "GEDUNG SERBA GUNA IDB BALI - Lt.3",
    building: "Gedung Serba Guna",
    floor: "3",
    capacity: 150,
    roomType: "serbaguna",
    photoUrl: "/rooms/serbaguna.jpg",
    facilities: ["sound system", "proyektor", "AC", "panggung"],
    closeTime: "22:00",
    maxDurationMinutes: 480,
    attachmentRequired: true,
  }),
  room({
    name: "GEDUNG B (Gear inc)",
    building: "Gedung B",
    floor: "1",
    capacity: 40,
    roomType: "studio",
    photoUrl: "/rooms/creative-gallery.jpg",
    facilities: ["meja kerja", "AC", "proyektor", "peralatan kreatif"],
    closeTime: "21:00",
    maxDurationMinutes: 240,
  }),
];

const witaMidnight = (offsetDays: number) => {
  const shifted = new Date(Date.now() + 8 * 3_600_000);
  const day = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + offsetDays,
    ),
  );
  return new Date(day.getTime() - 8 * 3_600_000);
};

const witaTime = (day: Date, hour: number, minute = 0) =>
  new Date(day.getTime() + hour * 3_600_000 + minute * 60_000);

type DemoScheduleInput = {
  borrowerId: string;
  secondBorrowerId: string;
  managerId: string;
  adminId: string;
};

async function seedDemoSchedule(input: DemoScheduleInput) {
  await prisma.reservation.deleteMany({
    where: { idempotencyKey: { startsWith: "demo-" } },
  });
  await prisma.slotBlock.deleteMany({
    where: { reason: { startsWith: "Demo:" } },
  });

  const lontar = await prisma.organization.findUnique({
    where: { name: "Lontar" },
  });

  const plan: Array<{
    room: string;
    day: number;
    start: number;
    end: number;
    status: "MENUNGGU_PERSETUJUAN" | "TERKONFIRMASI";
    owner: keyof DemoScheduleInput;
    activity: string;
    participants: number;
    organization?: boolean;
  }> = [
    {
      room: "A.1.1 (Studio Pola)",
      day: 1,
      start: 9,
      end: 11,
      status: "TERKONFIRMASI",
      owner: "borrowerId",
      activity: "Penjelasan pola(STUDIO POLA)",
      participants: 18,
    },
    {
      room: "A.1.2 (Lect 1A)",
      day: 1,
      start: 13,
      end: 15,
      status: "MENUNGGU_PERSETUJUAN",
      owner: "secondBorrowerId",
      activity: "Kuliah umum Creativepreneur",
      participants: 32,
    },
    {
      room: "A.2.1 (Lab 2B)",
      day: 1,
      start: 10,
      end: 12,
      status: "TERKONFIRMASI",
      owner: "managerId",
      activity: "Praktikum iMac",
      participants: 24,
    },
    {
      room: "A.1.3 (Lab 1C)",
      day: 0,
      start: 9,
      end: 11,
      status: "TERKONFIRMASI",
      owner: "adminId",
      activity: "Uji advisori proyek",
      participants: 12,
    },
    {
      room: "B.1.3 (Studio 3)",
      day: 0,
      start: 14,
      end: 17,
      status: "TERKONFIRMASI",
      owner: "borrowerId",
      activity: "Sesi foto produk",
      participants: 14,
    },
    {
      room: "C.1.3 (Lect 1)",
      day: 0,
      start: 8,
      end: 10,
      status: "MENUNGGU_PERSETUJUAN",
      owner: "secondBorrowerId",
      activity: "Sharing karya mahasiswa",
      participants: 30,
    },
    {
      room: "AULA IDB BALI",
      day: 0,
      start: 10,
      end: 13,
      status: "TERKONFIRMASI",
      owner: "managerId",
      activity: "Panggung karya Lontar",
      participants: 120,
      organization: true,
    },
    {
      room: "HALAMAN IDB BALI GEDUNG A",
      day: 0,
      start: 16,
      end: 18,
      status: "TERKONFIRMASI",
      owner: "adminId",
      activity: "Pameran camera wajib",
      participants: 60,
    },
    {
      room: "C.3.1 (Studio 3A)",
      day: 2,
      start: 10,
      end: 12,
      status: "TERKONFIRMASI",
      owner: "borrowerId",
      activity: "Latihan maket",
      participants: 16,
    },
    {
      room: "B.1.4 (Lab Fashion)",
      day: 2,
      start: 13,
      end: 15,
      status: "MENUNGGU_PERSETUJUAN",
      owner: "secondBorrowerId",
      activity: "Menjahit busana karya",
      participants: 20,
    },
  ];

  for (const item of plan) {
    const day = witaMidnight(item.day);
    const room = await prisma.room.findFirst({
      where: { name: item.room },
    });

    if (!room) {
      continue;
    }

    await prisma.reservation.create({
      data: {
        userId: input[item.owner],
        roomId: room.id,
        organizationId: item.organization && lontar ? lontar.id : null,
        start: witaTime(day, item.start),
        end: witaTime(day, item.end),
        type: item.organization ? "ORGANISASI" : "PRIBADI",
        activityName: item.activity,
        participantCount: item.participants,
        status: item.status,
        idempotencyKey: `demo-${item.room}-${day.toISOString().slice(0, 10)}`,
      },
    });
  }

  const blocks: Array<{
    room: string;
    day: number;
    start: number;
    end: number;
    reason: string;
  }> = [
    {
      room: "GEDUNG SERBA GUNA IDB BALI - Lt.1",
      day: 0,
      start: 9,
      end: 17,
      reason: "Demo: acara kampus",
    },
    {
      room: "ROOFTOP IDB BALI",
      day: 0,
      start: 17,
      end: 21,
      reason: "Demo: pentas Alongside",
    },
  ];

  for (const item of blocks) {
    const room = await prisma.room.findFirst({
      where: { name: item.room },
    });

    if (!room) {
      continue;
    }

    const day = witaMidnight(item.day);

    await prisma.slotBlock.create({
      data: {
        roomId: room.id,
        start: witaTime(day, item.start),
        end: witaTime(day, item.end),
        reason: item.reason,
        createdById: input.managerId,
      },
    });
  }
}

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.test" },
    update: {},
    create: {
      name: "Admin Sintetis",
      email: "admin@example.test",
      role: "ADMIN",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "pengelola@example.test" },
    update: {},
    create: {
      name: "Pengelola Sintetis",
      email: "pengelola@example.test",
      role: "PENGELOLA",
    },
  });

  const borrower = await prisma.user.upsert({
    where: { email: "peminjam@example.test" },
    update: {},
    create: {
      name: "Peminjam Sintetis",
      email: "peminjam@example.test",
      role: "PEMINJAM",
    },
  });

  const secondBorrower = await prisma.user.upsert({
    where: { email: "peminjam2@example.test" },
    update: {},
    create: {
      name: "Peminjam Sintetis Dua",
      email: "peminjam2@example.test",
      role: "PEMINJAM",
    },
  });

  const organization = await prisma.organization.upsert({
    where: { name: "Lontar" },
    update: { category: "UKM" },
    create: {
      name: "Lontar",
      category: "UKM",
      advisor: "Pembina Sintetis",
    },
  });

  for (const entry of ORGANIZATION_CATALOG) {
    await prisma.organization.upsert({
      where: { name: entry.name },
      update: { category: entry.category },
      create: { name: entry.name, category: entry.category },
    });
  }

  const gravity = await prisma.organization.upsert({
    where: { name: "Gravity (DKV)" },
    update: { category: "HMJ" },
    create: { name: "Gravity (DKV)", category: "HMJ" },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: borrower.id,
        organizationId: organization.id,
      },
    },
    update: { role: "PENGURUS" },
    create: {
      userId: borrower.id,
      organizationId: organization.id,
      role: "PENGURUS",
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: secondBorrower.id,
        organizationId: organization.id,
      },
    },
    update: { role: "ANGGOTA" },
    create: {
      userId: secondBorrower.id,
      organizationId: organization.id,
      role: "ANGGOTA",
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: secondBorrower.id,
        organizationId: gravity.id,
      },
    },
    update: { role: "ANGGOTA" },
    create: {
      userId: secondBorrower.id,
      organizationId: gravity.id,
      role: "ANGGOTA",
    },
  });

  for (const roomData of rooms) {
    const savedRoom = await prisma.room.upsert({
      where: {
        name_building_floor: {
          name: roomData.name,
          building: roomData.building,
          floor: roomData.floor,
        },
      },
      update: roomData,
      create: roomData,
    });

    await prisma.roomManager.upsert({
      where: {
        roomId_userId: {
          roomId: savedRoom.id,
          userId: manager.id,
        },
      },
      update: {},
      create: {
        roomId: savedRoom.id,
        userId: manager.id,
      },
    });
  }

  await prisma.systemConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      maxActiveReservations: 3,
      maxAdvanceDays: 30,
    },
  });

  await seedDemoSchedule({
    borrowerId: borrower.id,
    secondBorrowerId: secondBorrower.id,
    managerId: manager.id,
    adminId: admin.id,
  });

  console.log(
    `Seed selesai: ${rooms.length} ruangan, admin=${admin.email}, pengelola=${manager.email}, peminjam=${borrower.email}`,
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
