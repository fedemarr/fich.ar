"use client"

import { useRef, useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Printer, Smartphone, Globe } from "lucide-react"
import type { PuntoFichaje } from "@/generated/prisma/client"

interface QrDialogProps {
  punto: PuntoFichaje
  empresaNombre: string
  empresaLogoUrl: string | null
  onClose: () => void
}

// Si ya es data URL la devuelve directamente; si es URL externa la convierte via canvas
function cargarImagenBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) return Promise.resolve(url)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext("2d")!.drawImage(img, 0, 0)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => resolve("")
    img.src = url
  })
}

export function QrDialog({ punto, empresaNombre, empresaLogoUrl, onClose }: QrDialogProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fich-ar.lat"
  const waNumber = process.env.NEXT_PUBLIC_META_WA_NUMBER ?? ""

  const [modo, setModo] = useState<"pwa" | "wa">("pwa")
  const urlPwa = `${appUrl}/fichar/${punto.qr_token}`
  const urlWa = waNumber
    ? `https://wa.me/${waNumber}?text=FICHAR%20${punto.qr_token}`
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
    const qrDataUrl = await svgToPngDataUrl(600)
    const nombrePunto = punto.nombre

    // El logo se pasa por referencia al window del popup para evitar embeber base64 enorme en el HTML
    const logoHtml = logoBase64
      ? `<div class="logo-wrapper"><img id="__logo__" class="empresa-logo" /></div>`
      : `<span class="empresa-nombre-text">${empresaNombre}</span>`

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
      padding: 24px 32px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .logo-wrapper {
      background: white;
      border-radius: 10px;
      padding: 8px 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .empresa-logo {
      height: 44px;
      max-width: 160px;
      object-fit: contain;
    }
    .empresa-nombre-text {
      font-size: 20px;
      font-weight: 800;
      color: white;
      letter-spacing: -0.3px;
    }
    .logo-fichar {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255,255,255,0.6);
      letter-spacing: 0.05em;
    }
    .punto-nombre {
      font-size: 15px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      background: rgba(255,255,255,0.15);
      border-radius: 20px;
      padding: 4px 14px;
    }
    .cuerpo {
      padding: 28px 40px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .titulo {
      font-size: 19px;
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
      padding: 14px;
    }
    .qr-wrap img {
      display: block;
      width: 210px;
      height: 210px;
    }
    .url {
      font-size: 10px;
      color: #9CA3AF;
      text-align: center;
      word-break: break-all;
      margin-top: -6px;
    }
    .pasos {
      width: 100%;
      background: #F9FAFB;
      border-radius: 12px;
      padding: 16px 20px;
    }
    .pasos-titulo {
      font-size: 11px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 11px;
    }
    .paso {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 9px;
    }
    .paso:last-child { margin-bottom: 0; }
    .paso-num {
      width: 22px;
      height: 22px;
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
      padding: 12px 32px;
      text-align: center;
    }
    .footer p {
      font-size: 11px;
      color: #9CA3AF;
    }
    .footer strong { color: #2563EB; font-weight: 700; }
    @media print {
      body { padding: 0; min-height: unset; }
      .ficha { box-shadow: none; border: 1.5px solid #E5E7EB; }
    }
  </style>
</head>
<body>
  <div class="ficha">
    <div class="header">
      ${logoHtml}
      <span class="logo-fichar">powered by Fich.ar</span>
      <span class="punto-nombre">📍 ${nombrePunto}</span>
    </div>
    <div class="cuerpo">
      <p class="titulo">Registrá tu<br/><em>asistencia</em></p>
      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="QR Fich.ar" />
      </div>
      <p class="url">${url}</p>
      <div class="pasos">
        <p class="pasos-titulo">¿Cómo fichar?</p>
        ${modo === "wa" ? `
        <div class="paso"><div class="paso-num">1</div><div>
          <div class="paso-texto">Escaneá el QR</div>
          <div class="paso-sub">Se abre WhatsApp automáticamente</div>
        </div></div>
        <div class="paso"><div class="paso-num">2</div><div>
          <div class="paso-texto">Enviá el mensaje</div>
          <div class="paso-sub">Tocá "Enviar" en WhatsApp</div>
        </div></div>
        <div class="paso"><div class="paso-num">3</div><div>
          <div class="paso-texto">Elegí Entrada o Salida</div>
          <div class="paso-sub">Tocá el botón del bot</div>
        </div></div>
        <div class="paso"><div class="paso-num">4</div><div>
          <div class="paso-texto">Compartí tu ubicación</div>
          <div class="paso-sub">¡Listo! Fichada registrada</div>
        </div></div>
        ` : `
        <div class="paso"><div class="paso-num">1</div><div>
          <div class="paso-texto">Escaneá el código QR</div>
          <div class="paso-sub">Con la cámara de tu celular</div>
        </div></div>
        <div class="paso"><div class="paso-num">2</div><div>
          <div class="paso-texto">Ingresá tu DNI</div>
          <div class="paso-sub">Para identificarte en el sistema</div>
        </div></div>
        <div class="paso"><div class="paso-num">3</div><div>
          <div class="paso-texto">Elegí Entrada o Salida</div>
          <div class="paso-sub">Tocá el botón que corresponda</div>
        </div></div>
        <div class="paso"><div class="paso-num">4</div><div>
          <div class="paso-texto">Permitís tu ubicación</div>
          <div class="paso-sub">¡Listo! Tu fichada queda registrada</div>
        </div></div>
        `}
      </div>
    </div>
    <div class="footer">
      <p>Sistema de control de asistencia <strong>Fich.ar</strong></p>
    </div>
  </div>
  <script>
    var img = document.getElementById('__logo__');
    if (img && window.__logo) img.src = window.__logo;
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`

    const ventana = window.open("", "_blank", "width=700,height=900")
    if (!ventana) { alert("Permitir ventanas emergentes para imprimir"); return }
    // Exponer el logo en el window del popup antes de escribir el HTML
    if (logoBase64) {
      (ventana as Window & { __logo: string }).__logo = logoBase64
    }
    ventana.document.write(html)
    ventana.document.close()
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
