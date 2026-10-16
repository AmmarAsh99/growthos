-- Additive migration: existing accounts, activities and sessions remain intact.
CREATE TABLE "finance_settings" (
  "userId" UUID NOT NULL PRIMARY KEY,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  CONSTRAINT "finance_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "finance_months" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL,
  "month" VARCHAR(7) NOT NULL,
  "salaryHalalas" INTEGER NOT NULL CHECK ("salaryHalalas" BETWEEN 0 AND 1000000000),
  "warningPercent" INTEGER NOT NULL DEFAULT 80 CHECK ("warningPercent" BETWEEN 1 AND 100),
  "categoryRules" JSONB NOT NULL,
  CONSTRAINT "finance_months_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "finance_month_format" CHECK ("month" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
);
CREATE UNIQUE INDEX "finance_months_userId_month_key" ON "finance_months"("userId","month");
CREATE UNIQUE INDEX "finance_months_id_userId_key" ON "finance_months"("id","userId");
CREATE TABLE "finance_envelopes" (
  "id" UUID NOT NULL PRIMARY KEY,
  "monthId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "key" VARCHAR(40) NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  "kind" VARCHAR(20) NOT NULL CHECK ("kind" IN ('expense','savings','emergency')),
  "discretionary" BOOLEAN NOT NULL DEFAULT false,
  "amountHalalas" INTEGER NOT NULL CHECK ("amountHalalas" BETWEEN 0 AND 1000000000),
  CONSTRAINT "finance_envelopes_monthId_userId_fkey" FOREIGN KEY ("monthId","userId") REFERENCES "finance_months"("id","userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "finance_envelopes_monthId_key_key" ON "finance_envelopes"("monthId","key");
CREATE UNIQUE INDEX "finance_envelopes_id_userId_key" ON "finance_envelopes"("id","userId");
CREATE TABLE "finance_categories" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  CONSTRAINT "finance_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "finance_categories_userId_name_key" ON "finance_categories"("userId","name");
CREATE UNIQUE INDEX "finance_categories_id_userId_key" ON "finance_categories"("id","userId");
CREATE TABLE "finance_transactions" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL,
  "categoryId" UUID,
  "envelopeId" UUID,
  "kind" VARCHAR(20) NOT NULL,
  "amountHalalas" INTEGER NOT NULL CHECK ("amountHalalas" BETWEEN 1 AND 1000000000),
  "date" DATE NOT NULL,
  "time" VARCHAR(5),
  "description" VARCHAR(160) NOT NULL,
  "notes" VARCHAR(2000),
  "merchant" VARCHAR(100),
  "frequency" VARCHAR(20),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "finance_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "finance_transactions_categoryId_userId_fkey" FOREIGN KEY ("categoryId","userId") REFERENCES "finance_categories"("id","userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_transactions_envelopeId_userId_fkey" FOREIGN KEY ("envelopeId","userId") REFERENCES "finance_envelopes"("id","userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_transaction_references" CHECK (
    ("kind"='expense' AND "categoryId" IS NOT NULL AND "envelopeId" IS NOT NULL) OR
    ("kind"='transfer' AND "categoryId" IS NULL AND "envelopeId" IS NOT NULL) OR
    ("kind"='income' AND "categoryId" IS NULL AND "envelopeId" IS NULL)
  )
);
CREATE INDEX "finance_transactions_userId_date_idx" ON "finance_transactions"("userId","date" DESC);
CREATE INDEX "finance_transactions_userId_envelopeId_date_idx" ON "finance_transactions"("userId","envelopeId","date");
