import { NextResponse } from "next/server"
import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

const NOMBRES_PROTEGIDOS = ["Ohlimpia Oficina", "Deposito Logistica"]

export async function DELETE(_req: Request) {
  const { error, session } = await verificarAcceso("ELIMINAR_PUNTO")
  if (error) return error

  const resultado = await prisma.puntoFichaje.updateMany({
    where: {
      empresa_id: session.user.empresaId,
      activo: true,
      nombre: { notIn: NOMBRES_PROTEGIDOS },
    },
    data: { activo: false },
  })

  return NextResponse.json({ eliminados: resultado.count })
}
