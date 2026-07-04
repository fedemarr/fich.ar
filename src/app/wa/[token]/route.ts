import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const waNumber = process.env.NEXT_PUBLIC_META_WA_NUMBER ?? ""

  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: token },
    select: { activo: true },
  })

  if (!punto?.activo || !waNumber) {
    return new Response("QR inválido", { status: 404 })
  }

  const mensaje = encodeURIComponent(`FICHAR ${token}`)
  const urlWA = `whatsapp://send?phone=${waNumber}&text=${mensaje}`
  const urlFallback = `https://wa.me/${waNumber}?text=${mensaje}`

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Abriendo WhatsApp…</title>
  <style>
    body { margin:0; font-family: -apple-system, sans-serif; background:#f0fdf4;
           display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:white; border-radius:16px; padding:32px 24px; text-align:center;
            box-shadow:0 4px 24px rgba(0,0,0,.08); max-width:320px; }
    .icon { font-size:48px; margin-bottom:12px; }
    h2 { margin:0 0 8px; font-size:18px; color:#111827; }
    p  { margin:0 0 20px; font-size:14px; color:#6b7280; }
    a  { display:inline-block; background:#25D366; color:white; padding:12px 24px;
         border-radius:12px; text-decoration:none; font-weight:600; font-size:15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">💬</div>
    <h2>Abriendo WhatsApp…</h2>
    <p>Si no abre automáticamente, tocá el botón.</p>
    <a href="${urlFallback}">Abrir WhatsApp</a>
  </div>
  <script>
    // Intenta abrir WhatsApp directamente con el esquema nativo
    window.location.replace("${urlWA}");
  </script>
</body>
</html>`

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
