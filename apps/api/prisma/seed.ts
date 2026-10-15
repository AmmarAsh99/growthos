import '../src/config.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash, argon2id } from 'argon2';
import { addDays, today } from '../src/analytics/calendar.js';
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
  console.log('Synthetic demo data created. Sign in using the credentials you supplied.');
} finally {
  await db.$disconnect();
}
