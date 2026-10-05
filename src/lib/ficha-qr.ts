import QRCode from "qrcode"

export type ModoQr = "pwa" | "wa"

export interface FichaQrDatos {
  nombrePunto: string
  empresaNombre: string
  url: string
  qrDataUrl: string
  modo: ModoQr
  conLogo: boolean
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const PASOS_PWA: [string, string][] = [
  ["Escaneá el código QR", "Con la cámara de tu celular"],
  ["Ingresá tu DNI", "Para identificarte en el sistema"],
  ["Elegí Entrada o Salida", "Tocá el botón que corresponda"],
  ["Permitís tu ubicación", "¡Listo! Tu fichada queda registrada"],
]

const PASOS_WA: [string, string][] = [
  ["Escaneá el QR", "Se abre WhatsApp automáticamente"],
  ["Enviá el mensaje", "Tocá \"Enviar\" en WhatsApp"],
  ["Elegí Entrada o Salida", "Tocá el botón del bot"],
  ["Compartí tu ubicación", "¡Listo! Fichada registrada"],
]

const FICHA_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; }
  .pagina {
    width: 210mm; height: 297mm;
    display: flex; align-items: center; justify-content: center;
    page-break-after: always; break-after: page;
  }
  .pagina:last-child { page-break-after: auto; break-after: auto; }
  .ficha {
    width: 500px; background: white;
    border: 1.5px solid #E5E7EB; border-radius: 20px; overflow: hidden;
  }
  .header {
    background: #2563EB; padding: 24px 32px 20px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .logo-wrapper {
    background: white; border-radius: 10px; padding: 8px 16px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .empresa-logo { height: 44px; max-width: 160px; object-fit: contain; }
  .empresa-nombre-text { font-size: 20px; font-weight: 800; color: white; letter-spacing: -0.3px; }
  .logo-fichar { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6); letter-spacing: 0.05em; }
  .punto-nombre {
    font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.9);
    background: rgba(255,255,255,0.15); border-radius: 20px; padding: 4px 14px;
  }
  .cuerpo { padding: 28px 40px 24px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
  .titulo { font-size: 19px; font-weight: 700; color: #111827; text-align: center; line-height: 1.3; }
  .titulo em { font-style: normal; color: #2563EB; }
  .qr-wrap { background: white; border: 3px solid #F3F4F6; border-radius: 16px; padding: 14px; }
  .qr-wrap img { display: block; width: 210px; height: 210px; }
  .url { font-size: 10px; color: #9CA3AF; text-align: center; word-break: break-all; margin-top: -6px; }
  .pasos {
    width: 100%; background: #F9FAFB; border-radius: 12px; padding: 16px 20px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .pasos-titulo {
    font-size: 11px; font-weight: 700; color: #6B7280;
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 11px;
  }
  .paso { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
  .paso:last-child { margin-bottom: 0; }
  .paso-num {
    width: 22px; height: 22px; background: #2563EB; color: white; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; flex-shrink: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .paso-texto { font-size: 13px; color: #374151; font-weight: 500; }
  .paso-sub { font-size: 11px; color: #9CA3AF; margin-top: 1px; }
  .footer {
    background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 12px 32px; text-align: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .footer p { font-size: 11px; color: #9CA3AF; }
  .footer strong { color: #2563EB; font-weight: 700; }
`

function fichaHtml(d: FichaQrDatos): string {
  const logoHtml = d.conLogo
    ? `<div class="logo-wrapper"><img class="empresa-logo __logo__" /></div>`
    : `<span class="empresa-nombre-text">${escapar(d.empresaNombre)}</span>`
  const pasos = (d.modo === "wa" ? PASOS_WA : PASOS_PWA)
    .map(([texto, sub], i) => `
      <div class="paso"><div class="paso-num">${i + 1}</div><div>
        <div class="paso-texto">${escapar(texto)}</div>
        <div class="paso-sub">${escapar(sub)}</div>
      </div></div>`)
    .join("")

  return `
  <div class="pagina">
    <div class="ficha">
      <div class="header">
        ${logoHtml}
        <span class="logo-fichar">powered by Jornada.OH</span>
        <span class="punto-nombre">📍 ${escapar(d.nombrePunto)}</span>
      </div>
      <div class="cuerpo">
        <p class="titulo">Registrá tu<br/><em>asistencia</em></p>
        <div class="qr-wrap"><img src="${d.qrDataUrl}" alt="QR" /></div>
        <p class="url">${escapar(d.url)}</p>
        <div class="pasos">
          <p class="pasos-titulo">¿Cómo fichar?</p>
          ${pasos}
        </div>
      </div>
      <div class="footer"><p>Sistema de control de asistencia <strong>Jornada.OH</strong></p></div>
    </div>
  </div>`
}

// Abrir sincrónicamente dentro del click: si se abre después de un await el navegador bloquea el popup
export function abrirVentanaImpresion(): Window | null {
  const ventana = window.open("", "_blank", "width=800,height=900")
  if (ventana) {
    ventana.document.write(`<p style="font-family:sans-serif;padding:24px;color:#6B7280">Generando fichas QR...</p>`)
  }
  return ventana
}

// Escribe todas las fichas (una por hoja A4) y lanza el diálogo de impresión → "Guardar como PDF".
// El logo se pasa por referencia al window del popup para no repetir un base64 enorme en cada ficha.
export function imprimirFichas(ventana: Window, titulo: string, fichas: FichaQrDatos[], logoBase64: string): void {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${escapar(titulo)}</title>
  <style>${FICHA_CSS}</style>
</head>
<body>
  ${fichas.map(fichaHtml).join("")}
  <script>
    document.querySelectorAll('.__logo__').forEach(function (img) { if (window.__logo) img.src = window.__logo; });
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`

  if (logoBase64) {
    (ventana as Window & { __logo: string }).__logo = logoBase64
  }
  ventana.document.open()
  ventana.document.write(html)
  ventana.document.close()
}

// Si ya es data URL la devuelve directamente; si es URL externa la convierte via canvas
export function cargarImagenBase64(url: string): Promise<string> {
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

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Mismo resultado que el QRCodeSVG del diálogo: corrección H y logo centrado sobre un hueco blanco
export async function generarQrPng(url: string, logoBase64: string, color: string, size = 600): Promise<string> {
  const canvas = document.createElement("canvas")
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: "H",
    width: size,
    margin: 0,
    color: { dark: color, light: "#ffffff" },
  })
  if (logoBase64) {
    const logo = await cargarImagen(logoBase64)
    if (logo) {
      const ctx = canvas.getContext("2d")!
      const lado = Math.round(size * (48 / 248))
      const x = Math.round((size - lado) / 2)
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(x, x, lado, lado)
      ctx.drawImage(logo, x, x, lado, lado)
    }
  }
  return canvas.toDataURL("image/png")
}
