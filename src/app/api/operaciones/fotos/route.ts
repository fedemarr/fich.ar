import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  ejecucion_tarea_id: z.string().uuid(),
  empresa_id: z.string().uuid(),
  colaborador_id: z.string().uuid(),
  latitud_captura: z.number().optional(),
  longitud_captura: z.number().optional(),
  ancho: z.number().int().positive().optional(),
  alto: z.number().int().positive().optional(),
  bytes: z.number().int().positive().optional(),
})

// Registra el stub de una foto (sin upload real aún — R2 pendiente)
// El cliente sube la foto → en la respuesta recibe el id para mostrarla localmente
// Cuando se integre R2: agregar key/thumbnail_key y actualizar estado_subida
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { ejecucion_tarea_id, empresa_id, colaborador_id, latitud_captura, longitud_captura, ancho, alto, bytes } =
    parsed.data

  // Verificar que la ejecución de tarea pertenece a la empresa
  const et = await prisma.ejecucionTarea.findFirst({
    where: {
      id: ejecucion_tarea_id,
      ejecucion_procedimiento: { empresa_id },
    },
    select: { id: true, tarea: { select: { foto_max: true } }, fotos: { select: { id: true } } },
  })
  if (!et) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  if (et.fotos.length >= et.tarea.foto_max) {
    return NextResponse.json({ error: "Máximo de fotos alcanzado" }, { status: 400 })
  }

  const foto = await prisma.fotoOperacion.create({
    data: {
      empresa_id,
      ejecucion_tarea_id,
      colaborador_id,
      latitud_captura: latitud_captura ?? null,
      longitud_captura: longitud_captura ?? null,
      ancho: ancho ?? null,
      alto: alto ?? null,
      bytes: bytes ?? null,
      estado_subida: "PENDIENTE",
    },
  })

  return NextResponse.json({ id: foto.id, estado: "PENDIENTE" }, { status: 201 })
}
