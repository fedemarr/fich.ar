-- Add operaciones_token to puntos_fichaje
-- Step 1: add as nullable
ALTER TABLE "puntos_fichaje" ADD COLUMN "operaciones_token" TEXT;

-- Step 2: fill existing rows with uuid
UPDATE "puntos_fichaje" SET "operaciones_token" = gen_random_uuid()::text WHERE "operaciones_token" IS NULL;

-- Step 3: make NOT NULL and add unique constraint
ALTER TABLE "puntos_fichaje" ALTER COLUMN "operaciones_token" SET NOT NULL;
ALTER TABLE "puntos_fichaje" ADD CONSTRAINT "puntos_fichaje_operaciones_token_key" UNIQUE ("operaciones_token");

-- CreateIndex
CREATE INDEX "puntos_fichaje_operaciones_token_idx" ON "puntos_fichaje"("operaciones_token");
