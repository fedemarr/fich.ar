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
  console.log("[WA] Enviando a:", (payload as { to?: string }).to)
  const res = await fetch(`${WA_API}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error("[WA] Error:", err)
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
