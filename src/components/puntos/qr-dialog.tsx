"use client"

import { useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Printer } from "lucide-react"
import type { PuntoFichaje } from "@/generated/prisma/client"

interface QrDialogProps {
  punto: PuntoFichaje
  onClose: () => void
}

export function QrDialog({ punto, onClose }: QrDialogProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fich-ar.vercel.app"
  const url = `${appUrl}/fichar/${punto.qr_token}`

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
    const qrDataUrl = await svgToPngDataUrl(600)
    const nombrePunto = punto.nombre
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Ficha QR — ${nombrePunto}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .ficha {
      width: 500px;
      background: white;
      border: 2.5px solid #E5E7EB;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background: #2563EB;
      padding: 28px 32px 24px;
      text-align: center;
    }
    .logo {
      font-size: 22px;
      font-weight: 900;
      color: white;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .logo span { opacity: 0.7; font-weight: 400; }
    .punto-nombre {
      font-size: 17px;
      font-weight: 600;
      color: rgba(255,255,255,0.95);
      margin-top: 4px;
    }
    .cuerpo {
      padding: 32px 40px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    .titulo {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      text-align: center;
      line-height: 1.3;
    }
    .titulo em {
      font-style: normal;
      color: #2563EB;
    }
    .qr-wrap {
      background: white;
      border: 3px solid #F3F4F6;
      border-radius: 16px;
      padding: 16px;
    }
    .qr-wrap img {
      display: block;
      width: 220px;
      height: 220px;
    }
    .url {
      font-size: 10px;
      color: #9CA3AF;
      text-align: center;
      word-break: break-all;
      margin-top: -8px;
    }
    .pasos {
      width: 100%;
      background: #F9FAFB;
      border-radius: 12px;
      padding: 18px 22px;
    }
    .pasos-titulo {
      font-size: 11px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
    }
    .paso {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .paso:last-child { margin-bottom: 0; }
    .paso-num {
      width: 24px;
      height: 24px;
      background: #2563EB;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .paso-texto {
      font-size: 13px;
      color: #374151;
      font-weight: 500;
    }
    .paso-sub {
      font-size: 11px;
      color: #9CA3AF;
      margin-top: 1px;
    }
    .footer {
      background: #F9FAFB;
      border-top: 1px solid #E5E7EB;
      padding: 14px 32px;
      text-align: center;
    }
    .footer p {
      font-size: 11px;
      color: #9CA3AF;
    }
    .footer strong {
      color: #2563EB;
      font-weight: 700;
    }
    @media print {
      body { padding: 0; min-height: unset; }
      .ficha { box-shadow: none; border: 1.5px solid #E5E7EB; }
    }
  </style>
</head>
<body>
  <div class="ficha">
    <div class="header">
      <div class="logo">Fich<span>.ar</span></div>
      <div class="punto-nombre">📍 ${nombrePunto}</div>
    </div>
    <div class="cuerpo">
      <p class="titulo">Fichá tu asistencia<br/>escaneando el <em>código QR</em></p>
      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="QR Fich.ar" />
      </div>
      <p class="url">${url}</p>
      <div class="pasos">
        <p class="pasos-titulo">¿Cómo fichar?</p>
        <div class="paso">
          <div class="paso-num">1</div>
          <div>
            <div class="paso-texto">Abrí la cámara de tu celular</div>
            <div class="paso-sub">Cualquier cámara moderna reconoce el QR</div>
          </div>
        </div>
        <div class="paso">
          <div class="paso-num">2</div>
          <div>
            <div class="paso-texto">Apuntá al código QR y tocá el link</div>
            <div class="paso-sub">Se abre automáticamente en tu navegador</div>
          </div>
        </div>
        <div class="paso">
          <div class="paso-num">3</div>
          <div>
            <div class="paso-texto">Ingresá tu DNI la primera vez</div>
            <div class="paso-sub">Después el sistema te recuerda</div>
          </div>
        </div>
        <div class="paso">
          <div class="paso-num">4</div>
          <div>
            <div class="paso-texto">Elegí Entrada o Salida y confirmá</div>
            <div class="paso-sub">¡Listo! Tu fichada queda registrada</div>
          </div>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Sistema de control de asistencia <strong>Fich.ar</strong></p>
    </div>
  </div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`

    const ventana = window.open("", "_blank", "width=700,height=900")
    if (!ventana) { alert("Permitir ventanas emergentes para imprimir"); return }
    ventana.document.write(html)
    ventana.document.close()
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
          <p className="text-xs text-gray-400 text-center break-all">{url}</p>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={descargar}
            >
              <Download size={15} />
              PNG
            </Button>
            <Button
              className="flex-1 gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
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
