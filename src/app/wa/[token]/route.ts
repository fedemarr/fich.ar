import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

// Redirige a WhatsApp con el mensaje FICHAR <token> pre-cargado.
// Se usa en el QR de WhatsApp — la cámara abre esta URL en el browser,
// el browser sigue el redirect a wa.me y WhatsApp abre el chat directamente.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const waNumber = process.env.NEXT_PUBLIC_META_WA_NUMBER ?? ""

  // Verificar que el token corresponde a un punto activo
  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: token },
    select: { activo: true },
  })

  if (!punto?.activo || !waNumber) {
    redirect("/")
  }

  const mensaje = encodeURIComponent(`FICHAR ${token}`)
  redirect(`https://wa.me/${waNumber}?text=${mensaje}`)
}
