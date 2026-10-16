import '../src/config.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash, argon2id } from 'argon2';
import { addDays, today } from '../src/analytics/calendar.js';
import { categoryNames, defaultAllocations } from '../src/finance/accounting.js';
if (process.env.NODE_ENV === 'production' || process.env.DEMO_SEED !== 'true')
  throw new Error('Demo seed requires DEMO_SEED=true outside production');
const email = process.env.DEMO_EMAIL?.trim().toLowerCase(),
  password = process.env.DEMO_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error('Supply DEMO_EMAIL and DEMO_PASSWORD (12+ characters); no built-in credentials');
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  if (await db.user.findUnique({ where: { email } }))
    throw new Error('Demo email already exists; choose another address');
  const names = ['DevOps & Cloud', 'Programming', 'Reading', 'Fitness', 'Career', 'Personal'];
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hash(password, { type: argon2id }),
      displayName: 'Demo Explorer',
      settings: { create: {} },
      categories: {
        create: names.map((name, i) => ({
          name,
          slug: 'demo-' + i,
          color: ['#8B5CF6', '#22D3EE', '#FBBF24', '#34D399', '#FB7185', '#A78BFA'][i],
          sortOrder: i,
        })),
      },
    },
    include: { categories: true },
  });
  await db.activity.createMany({
    data: Array.from({ length: 90 }, (_, i) => i)
      .filter((i) => i % 7 !== 4)
      .map((i) => ({
        userId: user.id,
        categoryId: user.categories[i % 6].id,
        activityDate: new Date(addDays(today('Asia/Riyadh'), -i)),
        title: `Demo: ${names[i % 6]} practice`,
        description: 'Explicitly seeded synthetic demonstration activity.',
        durationMinutes: [30, 60, 90, 120, 45, 75][i % 6],
      })),
  });
  const financeCategories = await Promise.all(
    categoryNames.map((name) => db.financeCategory.create({ data: { userId: user.id, name } })),
  );
  const currentDay = today('Asia/Riyadh');
  await db.financeSettings.create({ data: { userId: user.id } });
  const budget = await db.financeMonth.create({
    data: {
      userId: user.id,
      month: currentDay.slice(0, 7),
      salaryHalalas: 1320000,
      warningPercent: 80,
      categoryRules: financeCategories.map((c) => ({
        categoryId: c.id,
        envelopeKey:
          c.name === 'Food'
            ? 'food'
            : c.name === 'Family'
              ? 'family'
              : c.name === 'Rent'
                ? 'rent'
                : 'general',
        limitHalalas: 0,
      })),
      envelopes: { create: defaultAllocations.map((e) => ({ ...e })) },
    },
    include: { envelopes: true },
  });
  await db.financeTransaction.create({
    data: {
      userId: user.id,
      kind: 'income',
      date: new Date(currentDay.slice(0, 7) + '-01'),
      amountHalalas: 1320000,
      description: 'DEMO: salary received',
    },
  });
  for (const key of ['savings', 'emergency'])
    await db.financeTransaction.create({
      data: {
        userId: user.id,
        kind: 'transfer',
        date: new Date(currentDay),
        amountHalalas: key === 'savings' ? 400000 : 150000,
        envelopeId: budget.envelopes.find((e) => e.key === key)!.id,
        description: 'DEMO: actual ' + key + ' transfer',
      },
    });
  for (let day = 1; day <= Number(currentDay.slice(8)); day++) {
    const food = day % 2 === 0;
    await db.financeTransaction.create({
      data: {
        userId: user.id,
        kind: 'expense',
        date: new Date(currentDay.slice(0, 7) + '-' + String(day).padStart(2, '0')),
        amountHalalas: food ? 3500 : 6000,
        categoryId: financeCategories.find((c) => c.name === (food ? 'Food' : 'Shopping'))!.id,
        envelopeId: budget.envelopes.find((e) => e.key === (food ? 'food' : 'general'))!.id,
        description: 'DEMO: ' + (food ? 'healthy meal' : 'shopping purchase'),
        notes: 'Synthetic demonstration transaction, never a real payment.',
      },
    });
  }
  console.log(
    'Synthetic activity and finance demo data created. Sign in using the credentials you supplied.',
  );
} finally {
  await db.$disconnect();
}
