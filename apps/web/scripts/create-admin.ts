// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

import { prisma } from "@voxnexus/db";
import { hash } from "bcryptjs";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <password>");
    process.exit(1);
  }

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("User already exists. Updating password...");
    const passwordHash = await hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
    console.log("Password updated successfully!");
    return;
  }

  // Create user
  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
      passwordHash,
      emailVerified: true,
    },
  });

  // Create default organization
  const org = await prisma.organization.create({
    data: {
      name: "My Organization",
      slug: `org-${user.id.slice(0, 8)}`,
      plan: "free",
    },
  });

  // Link user to organization
  await prisma.organizationUser.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: "owner",
    },
  });

  console.log(`Created admin user: ${email}`);
  console.log(`Organization: ${org.name} (${org.id})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
