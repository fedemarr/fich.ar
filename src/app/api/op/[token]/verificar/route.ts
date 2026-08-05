import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

const client = new Anthropic()

export const maxDuration = 60

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

  const criterio = et.tarea.criterio_verificacion
    ?? `La tarea "${et.tarea.nombre}" fue realizada. Confirmá que la foto muestra evidencia de eso.`

  const prompt = `Sos un verificador automático de tareas operativas. Tu trabajo es confirmar si una tarea fue hecha, no buscar perfección.

TAREA: "${et.tarea.nombre}"${et.tarea.descripcion ? `\nDESCRIPCIÓN: ${et.tarea.descripcion}` : ""}
CRITERIO: ${criterio}

REGLAS ESTRICTAS:
1. Si la foto muestra evidencia razonable de que la tarea fue completada → aprobada: true, requiere_revision_humana: false
2. Si la foto claramente NO muestra que la tarea fue completada → aprobada: false, requiere_revision_humana: false
3. requiere_revision_humana: true SOLO si la foto es TÉCNICAMENTE INUTILIZABLE: completamente negra, tan borrosa que no se ve nada, o muestra algo absolutamente irrelevante
4. Si aprobada es true → requiere_revision_humana SIEMPRE es false
5. Una foto clara de una tarea realizada = aprobá sin dudar

Respondé ÚNICAMENTE con este JSON exacto sin texto adicional:
{"aprobada":true,"confianza":"alta","observacion":"lo que ves en la foto","requiere_revision_humana":false}`

  let verificacion: {
    aprobada: boolean
    confianza: string
    observacion: string
    requiere_revision_humana: boolean
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
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
    // Regex greedy para capturar el JSON completo aunque tenga } dentro de strings
    const match = texto.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Partial<typeof verificacion>
        const aprobada = typeof parsed.aprobada === "boolean" ? parsed.aprobada : false
        // Regla forzada: si aprobada=true, nunca requiere revisión humana
        const requiere_revision_humana = aprobada
          ? false
          : (typeof parsed.requiere_revision_humana === "boolean" ? parsed.requiere_revision_humana : false)
        verificacion = {
          aprobada,
          confianza: ["alta", "media", "baja"].includes(parsed.confianza ?? "") ? (parsed.confianza as string) : "media",
          observacion: typeof parsed.observacion === "string" ? parsed.observacion : "Sin observación",
          requiere_revision_humana,
        }
      } catch {
        verificacion = { aprobada: false, confianza: "baja", observacion: "No se pudo interpretar la respuesta de IA", requiere_revision_humana: false }
      }
    } else {
      verificacion = { aprobada: false, confianza: "baja", observacion: "La IA no devolvió una respuesta válida", requiere_revision_humana: false }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error("[verificar] Error Anthropic API:", errMsg)
    return NextResponse.json({
      foto_id: null,
      verificacion: {
        aprobada: false,
        confianza: "baja",
        observacion: `DEBUG ERROR: ${errMsg}`,
        requiere_revision_humana: false,
      },
      tarea_completada: false,
      debug_error: errMsg,
    })
  }

  const imagenUrl = `data:${tipo_mime};base64,${foto_base64}`

  const foto = await prisma.fotoOperacion.create({
    data: {
      empresa_id: punto.empresa_id,
      ejecucion_tarea_id,
      colaborador_id,
      imagen_url: imagenUrl,
      estado_subida: "SUBIDA",
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
