-- AlterTable
ALTER TABLE "empresas" ADD COLUMN "stats_token" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "empresas_stats_token_key" ON "empresas"("stats_token");
