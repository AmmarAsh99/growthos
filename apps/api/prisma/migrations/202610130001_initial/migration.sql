-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" UUID NOT NULL,
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 120,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Riyadh',
    "weekStart" SMALLINT NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "icon" VARCHAR(40),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "activityDate" DATE NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_slug_key" ON "categories"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_userId_key" ON "categories"("id", "userId");

-- CreateIndex
CREATE INDEX "activities_userId_activityDate_idx" ON "activities"("userId", "activityDate" DESC);

-- CreateIndex
CREATE INDEX "activities_userId_categoryId_activityDate_idx" ON "activities"("userId", "categoryId", "activityDate" DESC);

-- CreateIndex
CREATE INDEX "refresh_sessions_userId_expiresAt_idx" ON "refresh_sessions"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "categories"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_duration_check" CHECK ("durationMinutes" BETWEEN 1 AND 1440); ALTER TABLE "user_settings" ADD CONSTRAINT "settings_goal_check" CHECK ("dailyGoalMinutes" BETWEEN 1 AND 1440), ADD CONSTRAINT "settings_week_check" CHECK ("weekStart" = 1);
