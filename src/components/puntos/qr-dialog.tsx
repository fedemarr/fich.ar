"use client"

import { useEffect, useRef } from "react"
import QRCode from "qrcode"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { PuntoFichaje } from "@/generated/prisma/client"

interface QrDialogProps {
  punto: PuntoFichaje
  onClose: () => void
}

export function QrDialog({ punto, onClose }: QrDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/fichar/${punto.qr_token}`
    QRCode.toCanvas(canvasRef.current, url, { width: 280, margin: 2 })
  }, [punto.qr_token])

  function descargar() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `qr-${punto.nombre.toLowerCase().replace(/\s+/g, "-")}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR — {punto.nombre}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <canvas ref={canvasRef} className="rounded-lg border border-gray-100" />
          <p className="text-xs text-gray-400 text-center">
            Radio permitido: {punto.radio_metros}m
          </p>
          <Button
            className="w-full gap-2 bg-[#E8593C] hover:bg-[#D04828] text-white"
            onClick={descargar}
          >
            <Download size={15} />
            Descargar PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
