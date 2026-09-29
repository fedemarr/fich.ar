/*
  Warnings:

  - Added the required column `supervisor_nombre` to the `supervisiones` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "supervisiones" DROP CONSTRAINT "supervisiones_usuario_id_fkey";

-- AlterTable
ALTER TABLE "colaboradores" ADD COLUMN     "es_supervisor" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "empresas" ALTER COLUMN "stats_token" DROP DEFAULT;

-- AlterTable
ALTER TABLE "supervisiones" ADD COLUMN     "colaborador_id" TEXT,
ADD COLUMN     "supervisor_nombre" TEXT NOT NULL,
ALTER COLUMN "usuario_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "supervisiones" ADD CONSTRAINT "supervisiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisiones" ADD CONSTRAINT "supervisiones_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
