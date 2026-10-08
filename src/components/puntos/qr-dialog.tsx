"use client"

import { useRef, useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Printer, Smartphone, Globe } from "lucide-react"
import type { PuntoFichaje } from "@/generated/prisma/client"
import { abrirVentanaImpresion, cargarImagenBase64, generarQrPng, imprimirFichas } from "@/lib/ficha-qr"

interface QrDialogProps {
  punto: PuntoFichaje
  empresaNombre: string
  empresaLogoUrl: string | null
  onClose: () => void
}

export function QrDialog({ punto, empresaNombre, empresaLogoUrl, onClose }: QrDialogProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fich-ar.lat"
  const waNumber = process.env.NEXT_PUBLIC_META_WA_NUMBER ?? ""

  const [modo, setModo] = useState<"pwa" | "wa">("pwa")
  const urlPwa = `${appUrl}/fichar/${punto.qr_token}`
  const urlWa = waNumber
    ? `https://api.whatsapp.com/send/?phone=${waNumber}&text=FICHAR%20${punto.qr_token}&type=phone_number&app_absent=0`
    : ""
  const url = modo === "wa" && urlWa ? urlWa : urlPwa

  const [logoBase64, setLogoBase64] = useState<string>("")

  useEffect(() => {
    if (!empresaLogoUrl) return
    cargarImagenBase64(empresaLogoUrl).then(setLogoBase64)
  }, [empresaLogoUrl])

  function svgToPngDataUrl(size: number): Promise<string> {
    return new Promise((resolve) => {
      const svg = svgRef.current
      if (!svg) { resolve(""); return }
      const xml = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement("canvas")
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext("2d")!
      const img = new Image()
      img.onload = () => {
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        resolve(canvas.toDataURL("image/png"))
      }
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)))
    })
  }

  async function descargar() {
    const dataUrl = await svgToPngDataUrl(320)
    const link = document.createElement("a")
    link.download = `qr-${punto.nombre.toLowerCase().replace(/\s+/g, "-")}.png`
    link.href = dataUrl
    link.click()
  }

  async function imprimirFicha() {
    const ventana = abrirVentanaImpresion()
    if (!ventana) { alert("Permitir ventanas emergentes para imprimir"); return }
    // QR limpio, sin logo al centro: escanea mejor y el logo ya va grande arriba de la ficha
    const qrDataUrl = await generarQrPng(url, "", modo === "wa" ? "#075E54" : "#000000")
    imprimirFichas(ventana, `Ficha QR — ${punto.nombre}`, [{
      nombrePunto: punto.nombre,
      empresaNombre,
      url,
      qrDataUrl,
      modo,
      conLogo: !!logoBase64,
    }], logoBase64)
  }

  const logoSize = 48

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR — {punto.nombre}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {/* Toggle modo */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden w-full">
            <button
              onClick={() => setModo("pwa")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                modo === "pwa" ? "bg-[#2563EB] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Globe size={13} /> App Web
            </button>
            <button
              onClick={() => setModo("wa")}
              disabled={!urlWa}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                modo === "wa" ? "bg-[#25D366] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Smartphone size={13} /> WhatsApp
            </button>
          </div>

          {modo === "wa" && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-full text-center">
              Al escanear este QR se abre WhatsApp y el colaborador sigue el flujo del bot
            </p>
          )}

          <div className="rounded-lg border border-gray-100 p-4 bg-white">
            <QRCodeSVG
              ref={svgRef}
              value={url}
              size={248}
              bgColor="#ffffff"
              fgColor={modo === "wa" ? "#075E54" : "#000000"}
              level="H"
              imageSettings={logoBase64 ? {
                src: logoBase64,
                height: logoSize,
                width: logoSize,
                excavate: true,
              } : undefined}
            />
          </div>
          {logoBase64 && (
            <p className="text-xs text-gray-400 -mt-2">Logo de {empresaNombre} en el centro del QR</p>
          )}
          <p className="text-xs text-gray-400 text-center break-all">{url}</p>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 gap-2" onClick={descargar}>
              <Download size={15} />
              PNG
            </Button>
            <Button
              className={`flex-1 gap-2 text-white ${modo === "wa" ? "bg-[#25D366] hover:bg-[#1ebe5d]" : "bg-[#2563EB] hover:bg-[#1D4ED8]"}`}
              onClick={imprimirFicha}
            >
              <Printer size={15} />
              Imprimir ficha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
