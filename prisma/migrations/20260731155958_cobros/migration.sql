-- CreateTable
CREATE TABLE "cobros" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "periodo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" TIMESTAMP(3),
    "fecha_pago" TIMESTAMP(3),
    "nota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cobros_empresa_id_idx" ON "cobros"("empresa_id");

-- CreateIndex
CREATE INDEX "cobros_estado_idx" ON "cobros"("estado");

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
