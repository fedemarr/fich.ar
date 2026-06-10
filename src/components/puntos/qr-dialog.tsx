"use client"

import { useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { PuntoFichaje } from "@/generated/prisma/client"

interface QrDialogProps {
  punto: PuntoFichaje
  onClose: () => void
}

export function QrDialog({ punto, onClose }: QrDialogProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const waNumber = process.env.NEXT_PUBLIC_META_WA_NUMBER ?? ""
  const texto = encodeURIComponent(`FICHAR ${punto.qr_token}`)
  const url = `https://wa.me/${waNumber}?text=${texto}`

  function descargar() {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    canvas.width = 320
    canvas.height = 320
    const ctx = canvas.getContext("2d")!
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, 320, 320)
      ctx.drawImage(img, 0, 0, 320, 320)
      const link = document.createElement("a")
      link.download = `qr-${punto.nombre.toLowerCase().replace(/\s+/g, "-")}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    }
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)))
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR — {punto.nombre}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-lg border border-gray-100 p-4 bg-white">
            <QRCodeSVG
              ref={svgRef}
              value={url}
              size={248}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>
          <p className="text-xs text-gray-400 text-center">
            Radio permitido: {punto.radio_metros}m
          </p>
          <Button
            className="w-full gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
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
