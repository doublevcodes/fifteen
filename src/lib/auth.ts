import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function requireDbUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    null;

  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    create: { clerkId: userId, email },
    update: email ? { email } : {},
  });

  return user;
}

export async function getDbUserOrNull() {
  const { userId } = await auth();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { clerkId: userId } });
}
