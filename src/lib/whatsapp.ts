import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

const WA_API = "https://graph.facebook.com/v21.0"
const PHONE_ID = process.env.META_WA_PHONE_NUMBER_ID!
const TOKEN = process.env.META_WA_TOKEN!

interface ButtonMessage {
  to: string
  body: string
  buttons: { id: string; title: string }[]
}

interface TextMessage {
  to: string
  body: string
}

async function waPost(payload: Record<string, unknown>) {
  const to = (payload as { to?: string }).to
  const url = `${WA_API}/${PHONE_ID}/messages`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.text()
    const msg = `[WA_SEND_ERR] status=${res.status} to=${to} phone_id=${PHONE_ID} body=${err.slice(0, 400)}`
    console.error(msg)
    try { await redis.set("wa:last_send_error", msg, { ex: 600 }) } catch { /* ignore */ }
  }
  return res
}

export async function enviarTexto({ to, body }: TextMessage) {
  return waPost({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  })
}

export async function enviarBotones({ to, body, buttons }: ButtonMessage) {
  return waPost({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  })
}

export async function identificarColaborador(fromNumber: string, empresaId: string) {
  // Buscar con y sin el "9" de los celulares argentinos en WhatsApp
  const conMas = "+" + fromNumber
  const sinNueve = /^549\d{10}$/.test(fromNumber) ? "+54" + fromNumber.slice(3) : null

  return prisma.colaborador.findFirst({
    where: {
      empresa_id: empresaId,
      celular: { in: [conMas, ...(sinNueve ? [sinNueve] : [])] },
      estado: "ACTIVO",
      deleted_at: null,
    },
  })
}

export async function identificarPorDNI(dni: string, empresaId: string) {
  return prisma.colaborador.findFirst({
    where: {
      empresa_id: empresaId,
      identificacion: dni.replace(/\./g, "").trim(),
      estado: "ACTIVO",
      deleted_at: null,
    },
  })
}

export async function enviarPlantilla(to: string, templateName: string, params: string[]) {
  return waPost({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es_AR" },
      components: params.length > 0
        ? [{
            type: "body",
            parameters: params.map((p) => ({ type: "text", text: p })),
          }]
        : [],
    },
  })
}

export async function solicitarUbicacion(to: string) {
  return waPost({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "location_request_message",
      body: { text: "Enviá tu ubicación actual para verificar que estás en el lugar de trabajo." },
      action: { name: "send_location" },
    },
  })
}
