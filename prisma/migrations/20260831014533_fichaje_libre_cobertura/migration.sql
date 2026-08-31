-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "fichaje_libre" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "fichadas" ADD COLUMN     "es_cobertura" BOOLEAN NOT NULL DEFAULT false;
