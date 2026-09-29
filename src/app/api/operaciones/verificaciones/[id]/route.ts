import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  foto_url: z.string().optional(),
  foto_hash: z.string().optional(),
  foto_timestamp: z.string().datetime().optional(),
  foto_latitud: z.number().optional(),
  foto_longitud: z.number().optional(),
  controles_presenciales: z.record(z.string(), z.boolean()),
  resultado_final: z.enum(["APROBADO", "RECHAZADO"]),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const verificacion = await prisma.verificacionSector.findFirst({
    where: { id, empresa_id: session.user.empresaId },
    select: { id: true, puntaje_ia: true, resultado_final: true },
  })
  if (!verificacion) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const contradijo_ia =
    verificacion.puntaje_ia !== null &&
    parsed.data.resultado_final === "APROBADO" &&
    verificacion.puntaje_ia < 80
      ? true
      : verificacion.puntaje_ia !== null &&
        parsed.data.resultado_final === "RECHAZADO" &&
        verificacion.puntaje_ia >= 80
      ? true
      : false

  const updated = await prisma.verificacionSector.update({
    where: { id },
    data: {
      foto_url: parsed.data.foto_url,
      foto_hash: parsed.data.foto_hash,
      foto_latitud: parsed.data.foto_latitud,
      foto_longitud: parsed.data.foto_longitud,
      foto_timestamp: parsed.data.foto_timestamp ? new Date(parsed.data.foto_timestamp) : undefined,
      controles_presenciales: parsed.data.controles_presenciales,
      resultado_final: parsed.data.resultado_final,
      supervisor_id: session.user.id,
      contradijo_ia,
    },
  })

  // Verificar si la ronda quedó completada
  const ronda = await prisma.rondaMuestreo.findFirst({
    where: { id: updated.ronda_id },
    include: { verificaciones: { select: { resultado_final: true } } },
  })
  if (ronda && ronda.verificaciones.every((v) => v.resultado_final !== null)) {
    await prisma.rondaMuestreo.update({
      where: { id: ronda.id },
      data: { estado: "COMPLETADA" },
    })
  }

  return NextResponse.json({ ok: true, contradijo_ia })
}
