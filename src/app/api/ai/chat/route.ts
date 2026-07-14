import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { ETIQUETAS_NOVEDAD } from "@/types"
import type { TipoNovedad } from "@/generated/prisma/client"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIPOS_NOVEDAD = ["P","PT","ST","AU","VAC","EN","FR","FE","HDO","C","DES","VIR"] as const

const msgSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
})

const TOOLS: Anthropic.Tool[] = [
  {
    name: "query_fichadas",
    description: "Consulta fichadas de un día o rango. Devuelve entradas y salidas con análisis.",
    input_schema: {
      type: "object" as const,
      properties: {
        fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD (hoy si se omite)" },
        colaborador_nombre: { type: "string", description: "Filtrar por nombre o apellido" },
      },
    },
  },
  {
    name: "query_novedades",
    description: "Consulta novedades registradas (ausencias, vacaciones, licencias, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        desde: { type: "string", description: "Fecha inicio YYYY-MM-DD" },
        hasta: { type: "string", description: "Fecha fin YYYY-MM-DD" },
      },
    },
  },
  {
    name: "get_resumen_dia",
    description: "Devuelve KPIs del día: presentes, ausentes, ingresos, salidas.",
    input_schema: {
      type: "object" as const,
      properties: {
        fecha: { type: "string", description: "Fecha YYYY-MM-DD (hoy si se omite)" },
      },
    },
  },
  {
    name: "crear_novedad",
    description: "Registra una novedad para un colaborador (ausencia, vacaciones, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        colaborador_id: { type: "string" },
        fecha: { type: "string", description: "YYYY-MM-DD" },
        tipo: { type: "string", enum: TIPOS_NOVEDAD },
        observacion: { type: "string" },
      },
      required: ["colaborador_id", "fecha", "tipo"],
    },
  },
  {
    name: "crear_comunicacion",
    description: "Publica un aviso en la cartelera de comunicaciones.",
    input_schema: {
      type: "object" as const,
      properties: {
        texto: { type: "string" },
        fecha_fin: { type: "string", description: "Fecha de vencimiento YYYY-MM-DD" },
      },
      required: ["texto", "fecha_fin"],
    },
  },
  {
    name: "listar_colaboradores",
    description: "Lista los colaboradores activos de la empresa con su estado.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
]

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const parsed = msgSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const empresaId = session.user.empresaId
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })

  const systemPrompt = `Sos el asistente de RRHH de *${empresa?.nombre ?? "la empresa"}* en el sistema Jornada.OH.
Hoy es ${hoy} (zona horaria Argentina).
Ayudás a gestionar fichadas, novedades, comunicaciones y colaboradores.
Respondés siempre en español argentino, de forma concisa y profesional.
Cuando el usuario te pida información, usá las tools disponibles para obtenerla de la base de datos real.
No inventes datos. Si no encontrás algo, decílo claramente.`

  const messages: Anthropic.MessageParam[] = parsed.data.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // Agentic loop
  let iteraciones = 0
  const MAX = 5

  while (iteraciones < MAX) {
    iteraciones++

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    })

    if (response.stop_reason === "end_turn") {
      const texto = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
      return NextResponse.json({ reply: texto })
    }

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      )

      messages.push({ role: "assistant", content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const tu of toolUses) {
        const result = await ejecutarTool(tu.name, tu.input as Record<string, string>, empresaId)
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        })
      }

      messages.push({ role: "user", content: toolResults })
      continue
    }

    break
  }

  return NextResponse.json({ reply: "No pude procesar la consulta. Intentá de nuevo." })
}

async function ejecutarTool(name: string, input: Record<string, string>, empresaId: string): Promise<unknown> {
  if (name === "listar_colaboradores") {
    return prisma.colaborador.findMany({
      where: { empresa_id: empresaId, deleted_at: null },
      select: { id: true, nombre: true, apellido: true, estado: true, celular: true, legajo: true },
      orderBy: [{ apellido: "asc" }],
    })
  }

  if (name === "get_resumen_dia") {
    const fecha = input.fecha ?? new Date().toISOString().split("T")[0]
    const desde = new Date(fecha + "T00:00:00")
    const hasta = new Date(fecha + "T23:59:59")

    const [totalColabs, fichadas, novedadesAU] = await Promise.all([
      prisma.colaborador.count({ where: { empresa_id: empresaId, estado: "ACTIVO", deleted_at: null } }),
      prisma.fichada.findMany({
        where: { empresa_id: empresaId, timestamp: { gte: desde, lte: hasta } },
        include: { colaborador: { select: { nombre: true, apellido: true } } },
      }),
      prisma.novedad.count({ where: { empresa_id: empresaId, fecha: { gte: desde, lte: hasta }, tipo: "AU" } }),
    ])

    const presentes = new Set(fichadas.map((f) => f.colaborador_id)).size
    const ingresos = fichadas.filter((f) => f.tipo === "ENTRADA").length
    const salidas = fichadas.filter((f) => f.tipo === "SALIDA").length

    return { fecha, totalColaboradores: totalColabs, presentes, ingresos, salidas, ausentes: novedadesAU }
  }

  if (name === "query_fichadas") {
    const fecha = input.fecha ?? new Date().toISOString().split("T")[0]
    const desde = new Date(fecha + "T00:00:00")
    const hasta = new Date(fecha + "T23:59:59")

    const fichadas = await prisma.fichada.findMany({
      where: { empresa_id: empresaId, timestamp: { gte: desde, lte: hasta } },
      include: {
        colaborador: { select: { nombre: true, apellido: true } },
        punto_fichaje: { select: { nombre: true } },
      },
      orderBy: { timestamp: "asc" },
    })

    const filtradas = input.colaborador_nombre
      ? fichadas.filter((f) => {
          const texto = `${f.colaborador.nombre} ${f.colaborador.apellido}`.toLowerCase()
          return texto.includes((input.colaborador_nombre ?? "").toLowerCase())
        })
      : fichadas

    return filtradas.map((f) => ({
      colaborador: `${f.colaborador.apellido}, ${f.colaborador.nombre}`,
      tipo: f.tipo,
      hora: new Date(f.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }),
      punto: f.punto_fichaje?.nombre ?? "—",
      analisis: f.analisis,
      es_valida: f.es_valida,
    }))
  }

  if (name === "query_novedades") {
    const desde = input.desde ? new Date(input.desde + "T00:00:00") : new Date()
    const hasta = input.hasta ? new Date(input.hasta + "T23:59:59") : new Date()

    const novedades = await prisma.novedad.findMany({
      where: { empresa_id: empresaId, fecha: { gte: desde, lte: hasta } },
      include: { colaborador: { select: { nombre: true, apellido: true } } },
      orderBy: { fecha: "desc" },
    })

    return novedades.map((n) => ({
      colaborador: `${n.colaborador.apellido}, ${n.colaborador.nombre}`,
      fecha: new Date(n.fecha).toLocaleDateString("es-AR"),
      tipo: ETIQUETAS_NOVEDAD[n.tipo],
      observacion: n.observacion,
      aprobada: n.aprobada,
    }))
  }

  if (name === "crear_novedad") {
    const colaborador = await prisma.colaborador.findFirst({
      where: { id: input.colaborador_id, empresa_id: empresaId },
    })
    if (!colaborador) return { error: "Colaborador no encontrado" }

    const novedad = await prisma.novedad.create({
      data: {
        empresa_id: empresaId,
        colaborador_id: input.colaborador_id,
        fecha: new Date(input.fecha + "T12:00:00.000Z"),
        tipo: input.tipo as TipoNovedad,
        observacion: input.observacion ?? null,
      },
    })

    return {
      ok: true,
      id: novedad.id,
      mensaje: `Novedad ${ETIQUETAS_NOVEDAD[novedad.tipo]} creada para ${colaborador.apellido}, ${colaborador.nombre}`,
    }
  }

  if (name === "crear_comunicacion") {
    const com = await prisma.comunicacion.create({
      data: {
        empresa_id: empresaId,
        texto: input.texto,
        fecha_inicio: new Date(),
        fecha_fin: new Date(input.fecha_fin),
      },
    })
    return { ok: true, id: com.id, mensaje: "Comunicación publicada exitosamente" }
  }

  return { error: `Tool desconocida: ${name}` }
}
