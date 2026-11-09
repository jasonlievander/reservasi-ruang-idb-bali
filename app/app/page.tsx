import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CATEGORY_ORDER } from "@/lib/organizations";
import { Workspace } from "./workspace";
import type { OrganizationCatalogItem } from "./types";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
  const user = await getSessionUser(token);

  if (!user) {
    redirect("/login");
  }

  const [organizations] = await Promise.all([
    prisma.organization.findMany({
      select: { id: true, name: true, category: true },
    }),
  ]);

  const catalog: OrganizationCatalogItem[] = organizations
    .map((organization) => ({
      id: organization.id,
      name: organization.name,
      category:
        organization.category === "HMJ"
          ? ("HMJ" as const)
          : ("UKM" as const),
    }))
    .sort((first, second) => {
      const groupOrder =
        CATEGORY_ORDER.indexOf(first.category) -
        CATEGORY_ORDER.indexOf(second.category);
      if (groupOrder !== 0) {
        return groupOrder;
      }
      return first.name.localeCompare(second.name);
    });

  return <Workspace user={user} organizationCatalog={catalog} />;
}
