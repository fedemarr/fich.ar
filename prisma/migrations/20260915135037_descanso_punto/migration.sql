-- AlterTable
ALTER TABLE "puntos_fichaje" ADD COLUMN     "descanso_activo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "descanso_inicio" TIMESTAMP(3);
