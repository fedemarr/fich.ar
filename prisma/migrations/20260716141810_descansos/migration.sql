-- CreateTable
CREATE TABLE "descansos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "descansos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "descansos_empresa_id_idx" ON "descansos"("empresa_id");

-- CreateIndex
CREATE INDEX "descansos_colaborador_id_idx" ON "descansos"("colaborador_id");

-- CreateIndex
CREATE INDEX "descansos_empresa_id_inicio_idx" ON "descansos"("empresa_id", "inicio");

-- AddForeignKey
ALTER TABLE "descansos" ADD CONSTRAINT "descansos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descansos" ADD CONSTRAINT "descansos_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
