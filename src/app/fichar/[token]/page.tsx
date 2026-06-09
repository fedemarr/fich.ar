import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function FicharPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: token },
    select: { nombre: true, activo: true },
  })

  if (!punto || !punto.activo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-lg font-semibold text-gray-700">Código QR inválido</p>
          <p className="text-sm text-gray-400 mt-2">Este código no existe o está desactivado.</p>
        </div>
      </div>
    )
  }

  // Redirect to WhatsApp with the token pre-filled
  const mensaje = encodeURIComponent(`FICHAR ${token}`)
  const waNumber = process.env.META_WA_PHONE_NUMBER || ""
  const waUrl = waNumber
    ? `https://wa.me/${waNumber}?text=${mensaje}`
    : `https://wa.me/?text=${mensaje}`

  redirect(waUrl)
}
