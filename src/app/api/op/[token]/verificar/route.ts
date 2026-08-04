import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

const client = new Anthropic()

const schema = z.object({
  ejecucion_tarea_id: z.string().uuid(),
  colaborador_id: z.string().uuid(),
  foto_base64: z.string().min(1),
  tipo_mime: z.string().default("image/jpeg"),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const punto = await prisma.puntoFichaje.findFirst({
    where: { operaciones_token: token, activo: true },
    select: { id: true, empresa_id: true, empresa: { select: { modulo_operaciones: true } } },
  })
  if (!punto) return NextResponse.json({ error: "QR inválido" }, { status: 404 })
  if (!punto.empresa.modulo_operaciones) return NextResponse.json({ error: "Módulo no activo" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { ejecucion_tarea_id, colaborador_id, foto_base64, tipo_mime } = parsed.data

  // Verificar que la ejecución de tarea pertenece a la empresa
  const et = await prisma.ejecucionTarea.findFirst({
    where: {
      id: ejecucion_tarea_id,
      ejecucion_procedimiento: { empresa_id: punto.empresa_id },
    },
    include: {
      tarea: {
        select: {
          nombre: true,
          descripcion: true,
          foto_instruccion: true,
          criterio_verificacion: true,
          foto_min: true,
        },
      },
      fotos: { select: { id: true } },
    },
  })
  if (!et) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 })
  if (et.fotos.length >= 10) return NextResponse.json({ error: "Máximo de fotos alcanzado" }, { status: 400 })

  // Construir prompt para Claude Vision
  const criterio = et.tarea.criterio_verificacion
    ?? `Verificar que la tarea "${et.tarea.nombre}" fue realizada correctamente.`

  const prompt = `Sos un verificador de calidad para tareas operativas.
Tarea: "${et.tarea.nombre}"
${et.tarea.descripcion ? `Descripción: ${et.tarea.descripcion}` : ""}
Criterio de verificación: ${criterio}

Analizá la foto y respondé en JSON con este formato exacto:
{
  "aprobada": true/false,
  "confianza": "alta"/"media"/"baja",
  "observacion": "texto corto explicando qué ves y por qué aprobás o rechazás",
  "requiere_revision_humana": true/false
}

Sé estricto pero justo. Si la foto es borrosa o no muestra claramente la tarea, indicá requiere_revision_humana: true.`

  let verificacion: {
    aprobada: boolean
    confianza: string
    observacion: string
    requiere_revision_humana: boolean
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: tipo_mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: foto_base64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    })

    const texto = response.content[0].type === "text" ? response.content[0].text : ""
    const match = texto.match(/\{[\s\S]*\}/)
    verificacion = match ? JSON.parse(match[0]) : {
      aprobada: false,
      confianza: "baja",
      observacion: "No se pudo analizar la respuesta",
      requiere_revision_humana: true,
    }
  } catch {
    verificacion = {
      aprobada: false,
      confianza: "baja",
      observacion: "Error al analizar la imagen",
      requiere_revision_humana: true,
    }
  }

  // Guardar foto con resultado IA
  const foto = await prisma.fotoOperacion.create({
    data: {
      empresa_id: punto.empresa_id,
      ejecucion_tarea_id,
      colaborador_id,
      estado_subida: "PENDIENTE",
      verificacion_ia: verificacion as object,
    },
  })

  // Si la IA aprueba y no requiere revisión humana, marcar tarea como COMPLETADA automáticamente
  if (verificacion.aprobada && !verificacion.requiere_revision_humana) {
    await prisma.ejecucionTarea.update({
      where: { id: ejecucion_tarea_id },
      data: {
        estado: "COMPLETADA",
        colaborador_id,
        hora_fin: new Date(),
        validacion_estado: "APROBADA",
      },
    })

    // Actualizar estado ejecución padre
    const tareas = await prisma.ejecucionTarea.findMany({
      where: { ejecucion_procedimiento_id: et.ejecucion_procedimiento_id },
      select: { estado: true },
    })
    const todas = tareas.length
    const completadas = tareas.filter((t) => t.estado === "COMPLETADA" || t.estado === "OMITIDA").length
    const enCurso = tareas.some((t) => t.estado === "EN_CURSO")
    let estadoPadre = "PENDIENTE"
    if (completadas === todas) estadoPadre = "COMPLETADO"
    else if (enCurso || completadas > 0) estadoPadre = "EN_CURSO"
    await prisma.ejecucionProcedimiento.update({
      where: { id: et.ejecucion_procedimiento_id },
      data: { estado: estadoPadre },
    })
  }

  return NextResponse.json({
    foto_id: foto.id,
    verificacion,
    tarea_completada: verificacion.aprobada && !verificacion.requiere_revision_humana,
  })
}
