import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { authenticateRequest } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return jsonError(401, "UNAUTHENTICATED", "Anda harus login terlebih dahulu.");
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: auth.user.id },
    include: {
      organization: { select: { id: true, name: true, category: true } },
    },
  });

  const organizations = memberships
    .map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      category: membership.organization.category,
      role: membership.role,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));

  return NextResponse.json({ user: auth.user, organizations });
}
