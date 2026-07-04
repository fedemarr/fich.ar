import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const waNumber = process.env.NEXT_PUBLIC_META_WA_NUMBER ?? ""

  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: token },
    select: { activo: true, nombre: true },
  })

  if (!punto?.activo || !waNumber) {
    return new Response("QR inválido", { status: 404 })
  }

  const mensaje = encodeURIComponent(`FICHAR ${token}`)
  // whatsapp:// scheme abre WA directamente; wa.me es el fallback web
  const urlDirect = `whatsapp://send?phone=${waNumber}&text=${mensaje}`
  const urlFallback = `https://wa.me/${waNumber}?text=${mensaje}`
  const nombre = punto.nombre

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <title>Fichar en ${nombre}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#f0fdf4;min-height:100vh;display:flex;align-items:center;
         justify-content:center;padding:20px}
    .card{background:white;border-radius:20px;padding:36px 28px;text-align:center;
          box-shadow:0 8px 32px rgba(0,0,0,.08);max-width:340px;width:100%}
    .logo{font-size:48px;margin-bottom:4px}
    h2{font-size:20px;font-weight:700;color:#111827;margin:12px 0 6px}
    .sub{font-size:14px;color:#6b7280;margin-bottom:28px}
    .btn{display:block;background:#25D366;color:white;padding:16px 24px;
         border-radius:14px;text-decoration:none;font-weight:700;font-size:17px;
         letter-spacing:-.2px;margin-bottom:14px}
    .btn:active{opacity:.85}
    .btn-sm{display:block;color:#9ca3af;font-size:13px;text-decoration:none}
    .punto{display:inline-block;background:#f0fdf4;color:#16a34a;border-radius:20px;
           padding:3px 12px;font-size:13px;font-weight:500;margin-bottom:20px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">💬</div>
    <h2>Fichar por WhatsApp</h2>
    <div class="punto">📍 ${nombre}</div>
    <p class="sub">Tocá el botón para abrir WhatsApp y registrar tu asistencia.</p>
    <a class="btn" href="${urlDirect}">Abrir WhatsApp →</a>
    <a class="btn-sm" href="${urlFallback}">Abrir en el navegador</a>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
