/**
 * Development seed data — deterministic and safe to re-run. Never
 * contains real secrets: the seeded password is a clearly-fake demo
 * value, hashed the same way a real registration would hash it.
 */
/* eslint-disable no-console -- a seed script's entire purpose is CLI feedback */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo-password-not-for-real-use';

const DEMO_USERS = [
  { email: 'alice@example.test', name: 'Alice Owner' },
  { email: 'bob@example.test', name: 'Bob Member' },
  { email: 'carol@example.test', name: 'Carol Viewer' },
] as const;

const QA_USERS = [
  { email: 'qa.arjun@tripnest.test', name: 'Arjun Mehta', upiId: 'arjun@upi' },
  { email: 'qa.priya@tripnest.test', name: 'Priya Sharma', upiId: 'priya@okicici' },
  { email: 'qa.rohan@tripnest.test', name: 'Rohan Verma', upiId: null },
  { email: 'qa.sneha@tripnest.test', name: 'Sneha Patel', upiId: null },
] as const;

async function main(): Promise<void> {
  console.log('Seeding TripNest development and QA data...');

  const allSeedEmails = [
    ...DEMO_USERS.map((u) => u.email),
    ...QA_USERS.map((u) => u.email),
  ];

  // Clean up previous runs of seeded data in explicit dependency order
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: allSeedEmails } },
    select: { id: true },
  });

  if (existingUsers.length > 0) {
    const userIds = existingUsers.map((u) => u.id);
    const trips = await prisma.trip.findMany({
      where: { members: { some: { userId: { in: userIds } } } },
      select: { id: true },
    });
    const tripIds = trips.map((t) => t.id);

    await prisma.expenseSplit.deleteMany({
      where: { tripMember: { tripId: { in: tripIds } } },
    });
    await prisma.settlementAttestation.deleteMany({
      where: { settlement: { tripId: { in: tripIds } } },
    });
    await prisma.settlement.deleteMany({
      where: { tripId: { in: tripIds } },
    });
    await prisma.expense.deleteMany({
      where: { tripId: { in: tripIds } },
    });
    await prisma.place.deleteMany({
      where: { tripId: { in: tripIds } },
    });
    await prisma.budgetCategory.deleteMany({
      where: { tripId: { in: tripIds } },
    });
    await prisma.activity.deleteMany({
      where: { tripId: { in: tripIds } },
    });
    await prisma.tripMember.deleteMany({
      where: { tripId: { in: tripIds } },
    });
    await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  // 1. Seed Demo Users & Trip
  const seededDemoUsers = await Promise.all(
    DEMO_USERS.map((u) => prisma.user.create({ data: { ...u, passwordHash } })),
  );
  const alice = seededDemoUsers[0]!;
  const bob = seededDemoUsers[1]!;
  const carol = seededDemoUsers[2]!;

  const goaTrip = await prisma.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        name: 'Goa Getaway',
        description: 'A seeded demo trip for local development.',
        destination: 'Goa, India',
        startDate: new Date('2026-02-10'),
        endDate: new Date('2026-02-15'),
        budget: 5000000n, // ₹50,000
        currency: 'INR',
      },
    });
    await tx.tripMember.create({ data: { tripId: created.id, userId: alice.id, role: 'OWNER' } });
    await tx.tripMember.create({ data: { tripId: created.id, userId: bob.id, role: 'MEMBER' } });
    await tx.tripMember.create({ data: { tripId: created.id, userId: carol.id, role: 'VIEWER' } });
    return created;
  });

  const aliceMember = await prisma.tripMember.findUniqueOrThrow({
    where: { tripId_userId: { tripId: goaTrip.id, userId: alice.id } },
  });
  const bobMember = await prisma.tripMember.findUniqueOrThrow({
    where: { tripId_userId: { tripId: goaTrip.id, userId: bob.id } },
  });
  const carolMember = await prisma.tripMember.findUniqueOrThrow({
    where: { tripId_userId: { tripId: goaTrip.id, userId: carol.id } },
  });

  const goaExpense = await prisma.expense.create({
    data: {
      tripId: goaTrip.id,
      paidById: aliceMember.id,
      description: 'Beachside hotel (2 nights)',
      amount: 1000000n, // ₹10,000
      category: 'Accommodation',
      date: new Date('2026-02-11'),
      splitType: 'EQUAL',
    },
  });
  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: goaExpense.id, tripMemberId: aliceMember.id, shareAmount: 333334n },
      { expenseId: goaExpense.id, tripMemberId: bobMember.id, shareAmount: 333333n },
      { expenseId: goaExpense.id, tripMemberId: carolMember.id, shareAmount: 333333n },
    ],
  });

  await prisma.place.create({
    data: {
      tripId: goaTrip.id,
      name: 'Baga Beach',
      category: 'beach',
      latitude: 15.5553,
      longitude: 73.7517,
      rating: 4.3,
    },
  });

  // 2. Seed Summer in Ladakh QA Trip
  const seededQaUsers = await Promise.all(
    QA_USERS.map((u) => prisma.user.create({ data: { ...u, passwordHash } })),
  );
  const arjun = seededQaUsers[0]!;
  const priya = seededQaUsers[1]!;
  const rohan = seededQaUsers[2]!;
  const sneha = seededQaUsers[3]!;

  const ladakhTrip = await prisma.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        name: 'Summer in Ladakh QA',
        description: 'Comprehensive QA seed trip for Map, Money, and Non-Custodial Settlements.',
        destination: 'Leh Ladakh, India',
        startDate: new Date('2026-06-15'),
        endDate: new Date('2026-06-22'),
        budget: 8000000n, // ₹80,000
        currency: 'INR',
      },
    });
    await tx.tripMember.create({ data: { tripId: created.id, userId: arjun.id, role: 'OWNER' } });
    await tx.tripMember.create({ data: { tripId: created.id, userId: priya.id, role: 'MEMBER' } });
    await tx.tripMember.create({ data: { tripId: created.id, userId: rohan.id, role: 'MEMBER' } });
    await tx.tripMember.create({ data: { tripId: created.id, userId: sneha.id, role: 'MEMBER' } });
    return created;
  });

  const arjunMember = await prisma.tripMember.findUniqueOrThrow({
    where: { tripId_userId: { tripId: ladakhTrip.id, userId: arjun.id } },
  });
  const priyaMember = await prisma.tripMember.findUniqueOrThrow({
    where: { tripId_userId: { tripId: ladakhTrip.id, userId: priya.id } },
  });
  const rohanMember = await prisma.tripMember.findUniqueOrThrow({
    where: { tripId_userId: { tripId: ladakhTrip.id, userId: rohan.id } },
  });
  const snehaMember = await prisma.tripMember.findUniqueOrThrow({
    where: { tripId_userId: { tripId: ladakhTrip.id, userId: sneha.id } },
  });

  // 4 Geocoded Places in Ladakh
  await prisma.place.createMany({
    data: [
      {
        tripId: ladakhTrip.id,
        name: 'Leh Palace',
        category: 'historic',
        address: 'Namgyal Hill, Leh',
        latitude: 34.1648,
        longitude: 77.5847,
        rating: 4.5,
      },
      {
        tripId: ladakhTrip.id,
        name: 'Shanti Stupa',
        category: 'monument',
        address: 'Chanspa, Leh',
        latitude: 34.1724,
        longitude: 77.5794,
        rating: 4.8,
      },
      {
        tripId: ladakhTrip.id,
        name: 'Pangong Lake',
        category: 'nature',
        address: 'Laddakh Highway',
        latitude: 33.7595,
        longitude: 78.6674,
        rating: 4.9,
      },
      {
        tripId: ladakhTrip.id,
        name: 'Nubra Valley',
        category: 'viewpoint',
        address: 'Diskit, Ladakh',
        latitude: 34.5428,
        longitude: 77.5673,
        rating: 4.7,
      },
    ],
  });

  // Shared Expenses
  const exp1 = await prisma.expense.create({
    data: {
      tripId: ladakhTrip.id,
      paidById: arjunMember.id,
      description: 'Taxi from Leh Airport',
      amount: 400000n, // ₹4,000
      category: 'Transport',
      date: new Date('2026-06-15'),
      splitType: 'EQUAL',
    },
  });
  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: exp1.id, tripMemberId: arjunMember.id, shareAmount: 100000n },
      { expenseId: exp1.id, tripMemberId: priyaMember.id, shareAmount: 100000n },
      { expenseId: exp1.id, tripMemberId: rohanMember.id, shareAmount: 100000n },
      { expenseId: exp1.id, tripMemberId: snehaMember.id, shareAmount: 100000n },
    ],
  });

  const exp2 = await prisma.expense.create({
    data: {
      tripId: ladakhTrip.id,
      paidById: priyaMember.id,
      description: 'Leh Hotel Stay',
      amount: 1600000n, // ₹16,000
      category: 'Accommodation',
      date: new Date('2026-06-16'),
      splitType: 'EQUAL',
    },
  });
  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: exp2.id, tripMemberId: arjunMember.id, shareAmount: 400000n },
      { expenseId: exp2.id, tripMemberId: priyaMember.id, shareAmount: 400000n },
      { expenseId: exp2.id, tripMemberId: rohanMember.id, shareAmount: 400000n },
      { expenseId: exp2.id, tripMemberId: snehaMember.id, shareAmount: 400000n },
    ],
  });

  console.log('Seed complete:');
  console.log(`  Goa Trip: ${goaTrip.name} (${goaTrip.id})`);
  console.log(`  Ladakh QA Trip: ${ladakhTrip.name} (${ladakhTrip.id})`);
  console.log(`  Demo Users: ${DEMO_USERS.map((u) => u.email).join(', ')}`);
  console.log(`  QA Users: ${QA_USERS.map((u) => u.email).join(', ')}`);
  console.log(`  Demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
