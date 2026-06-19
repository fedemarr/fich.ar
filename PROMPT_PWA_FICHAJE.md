# Fich.ar — PWA de fichaje por QR (sin WhatsApp)

## Contexto
Canal alternativo al bot de WhatsApp para registrar fichadas.
El empleado escanea el QR, se abre una página web en el celu,
pide la ubicación GPS y registra la entrada o salida.
Sin descargar nada. Sin WhatsApp. Sin depender de Meta.

Este canal convive con el bot de WhatsApp — son dos formas de fichar
que llegan al mismo resultado en la misma tabla `fichadas`.

---

## Cómo funciona

```
1. Empleado escanea el QR físico del punto
        ↓
2. Se abre el navegador del celu con la URL:
   https://app.fich.ar/fichar/[qr_token]
        ↓
3. Página pide permiso de ubicación GPS
        ↓
4. Empleado toca "Fichar entrada" o "Fichar salida"
        ↓
5. Sistema valida GPS contra coordenadas del punto
        ↓
6. Registra Fichada en DB
        ↓
7. Pantalla de confirmación con nombre y hora
```

---

## Pantallas a implementar

### Ruta: `/fichar/[token]`

Esta ruta es PÚBLICA — no requiere login.
El token identifica el punto de fichaje.

#### Estado 1 — Cargando
```
┌─────────────────────────────┐
│                             │
│      [Logo Fich.ar]         │
│                             │
│      Verificando punto...   │
│      [spinner]              │
│                             │
└─────────────────────────────┘
```

#### Estado 2 — Pedir ubicación
```
┌─────────────────────────────┐
│   [Logo empresa]            │
│   Olimpia Oficina           │
│                             │
│   Para fichar necesitamos   │
│   tu ubicación actual       │
│                             │
│   [📍 Permitir ubicación]   │
│                             │
│   Tu ubicación solo se usa  │
│   para verificar que estás  │
│   en el lugar de trabajo    │
└─────────────────────────────┘
```

#### Estado 3 — Elegir entrada o salida
```
┌─────────────────────────────┐
│   Hola, Lucero Gabriela 👋  │
│   Olimpia Oficina           │
│   Lunes 18/06 · 09:03 AM   │
│                             │
│   ┌─────────┐ ┌─────────┐  │
│   │  📥     │ │  📤     │  │
│   │ Entrada │ │ Salida  │  │
│   └─────────┘ └─────────┘  │
│                             │
│   Ubicación verificada ✓    │
└─────────────────────────────┘
```

#### Estado 4 — Confirmación
```
┌─────────────────────────────┐
│                             │
│         ✅                  │
│                             │
│   Entrada registrada        │
│   09:03 AM                  │
│                             │
│   Lucero Gabriela           │
│   Olimpia Oficina           │
│                             │
│   Podés cerrar esta página  │
│                             │
└─────────────────────────────┘
```

#### Estado — Error GPS lejos
```
┌─────────────────────────────┐
│         ❌                  │
│                             │
│   Ubicación muy lejana      │
│                             │
│   Estás a 450m del punto    │
│   Máximo permitido: 200m    │
│                             │
│   Asegurate de estar en     │
│   el lugar de trabajo       │
│                             │
│   [Reintentar]              │
└─────────────────────────────┘
```

#### Estado — Empleado no reconocido
```
┌─────────────────────────────┐
│   No encontramos tu perfil  │
│                             │
│   Ingresá tu DNI para       │
│   identificarte             │
│                             │
│   [____________] DNI        │
│                             │
│   [Continuar]               │
└─────────────────────────────┘
```

---

## Identificación del empleado

El sistema identifica al empleado en este orden:

```typescript
// 1. Por sesión guardada en localStorage
//    Si ya fichó antes desde este celu, recuerda quién es
const sesionGuardada = localStorage.getItem('fichar_colaborador_id')

// 2. Si no hay sesión → pedir DNI
// Buscar en DB por identificacion = DNI ingresado

// 3. Una vez identificado → guardar en localStorage
localStorage.setItem('fichar_colaborador_id', colaborador.id)
localStorage.setItem('fichar_colaborador_nombre', colaborador.nombre)

// Así la próxima vez no tiene que ingresar el DNI de nuevo
```

---

## Endpoint nuevo: POST /api/fichar/qr

```typescript
// Ruta pública — no requiere auth de usuario
// Pero valida el qr_token para obtener la empresa

export async function POST(req: Request) {
  const { qr_token, colaborador_id, dni, tipo, latitud, longitud } = await req.json()

  // 1. Buscar punto por token
  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token },
    include: { empresa: true }
  })
  if (!punto || !punto.activo) {
    return NextResponse.json({ error: 'Punto no encontrado' }, { status: 404 })
  }

  // 2. Identificar colaborador
  let colaborador = null
  if (colaborador_id) {
    colaborador = await prisma.colaborador.findFirst({
      where: { id: colaborador_id, empresa_id: punto.empresa_id, estado: 'ACTIVO' }
    })
  }
  if (!colaborador && dni) {
    const dniLimpio = dni.replace(/\./g, '').trim()
    colaborador = await prisma.colaborador.findFirst({
      where: { identificacion: dniLimpio, empresa_id: punto.empresa_id, estado: 'ACTIVO' }
    })
  }
  if (!colaborador) {
    return NextResponse.json({ error: 'Colaborador no encontrado', needsDni: true }, { status: 404 })
  }

  // 3. Validar GPS
  const distancia = calcularDistanciaMetros(latitud, longitud, punto.latitud, punto.longitud)
  if (distancia > punto.radio_metros) {
    return NextResponse.json({
      error: 'Ubicación fuera de rango',
      distancia: Math.round(distancia),
      radio: punto.radio_metros
    }, { status: 400 })
  }

  // 4. Determinar tipo si no viene
  let tipoFichada = tipo
  if (!tipoFichada) {
    const ultimaFichada = await prisma.fichada.findFirst({
      where: {
        colaborador_id: colaborador.id,
        timestamp: { gte: startOfDay(new Date()) }
      },
      orderBy: { timestamp: 'desc' }
    })
    tipoFichada = !ultimaFichada || ultimaFichada.tipo === 'SALIDA' ? 'ENTRADA' : 'SALIDA'
  }

  // 5. Calcular análisis
  const jornada = await obtenerJornadaActiva(colaborador.id)
  const analisis = calcularAnalisis(new Date(), tipoFichada, jornada)

  // 6. Registrar fichada
  const fichada = await prisma.fichada.create({
    data: {
      empresa_id:       punto.empresa_id,
      colaborador_id:   colaborador.id,
      punto_fichaje_id: punto.id,
      tipo:             tipoFichada,
      metodo:           'QR_WEB',  // nuevo método
      latitud_real:     latitud,
      longitud_real:    longitud,
      distancia_metros: Math.round(distancia),
      analisis,
      es_valida:        true,
    }
  })

  // 7. Notificar si hay anomalía
  if (analisis === 'LLEGADA_TARDE') {
    await prisma.notificacion.create({
      data: {
        empresa_id:     punto.empresa_id,
        colaborador_id: colaborador.id,
        tipo:           'FALLA_FICHADA',
        titulo:         `${colaborador.nombre} ${colaborador.apellido} llegó tarde`,
        metadata:       { fichada_id: fichada.id, analisis }
      }
    })
  }

  return NextResponse.json({
    ok: true,
    fichada: {
      tipo:    tipoFichada,
      hora:    format(fichada.timestamp, 'HH:mm'),
      analisis
    },
    colaborador: {
      id:     colaborador.id,
      nombre: `${colaborador.nombre} ${colaborador.apellido}`
    },
    punto: { nombre: punto.nombre }
  })
}
```

---

## Endpoint GET /api/fichar/qr/[token]

Para cargar los datos del punto al abrir la página:

```typescript
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: params.token },
    select: {
      id: true,
      nombre: true,
      activo: true,
      empresa: {
        select: { nombre: true, logo_url: true, slug: true }
      }
    }
  })

  if (!punto || !punto.activo) {
    return NextResponse.json({ error: 'Punto no válido' }, { status: 404 })
  }

  return NextResponse.json({ punto })
}
```

---

## Schema — agregar QR_WEB al enum MetodoFichada

```prisma
enum MetodoFichada {
  QR_WHATSAPP
  QR_WEB        // ← NUEVO — fichaje por página web
  MANUAL
}
```

```bash
npx prisma migrate dev --name add-qr-web-method
```

---

## PWA — configuración

Para que se pueda instalar como app en el celu:

### public/manifest.json
```json
{
  "name": "Fich.ar",
  "short_name": "Fich.ar",
  "description": "Control de asistencia",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0F172A",
  "theme_color": "#2563EB",
  "icons": [
    { "src": "/logo-fichar.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/logo-fichar.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### src/app/layout.tsx — agregar meta tags PWA
```typescript
export const metadata = {
  manifest: '/manifest.json',
  themeColor: '#2563EB',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fich.ar',
  },
}
```

---

## Diseño visual de la página de fichaje

```
Colores:
- Fondo:     #0F172A (navy oscuro — se ve bien al sol en obra)
- Card:      #1E293B
- Primario:  #2563EB (azul)
- Entrada:   #10B981 (verde)
- Salida:    #EF4444 (rojo)
- Texto:     #F8FAFC (blanco suave)

Tipografía: Calibri o Arial — seguras, se ven bien en cualquier celu
Botones: grandes, mínimo 60px de alto — fáciles de tocar con guantes de obra
```

---

## Actualizar la generación del QR en Puntos QR

El QR ahora debe apuntar a la URL web en vez del link de WhatsApp:

```typescript
// src/lib/qr.ts — actualizar la URL del QR
// ANTES (WhatsApp):
const qrUrl = `https://wa.me/${WA_NUMBER}?text=FICHAR-${punto.qr_token}`

// AHORA (Web):
const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL}/fichar/${punto.qr_token}`

// Generar QR PNG
import QRCode from 'qrcode'
const qrDataUrl = await QRCode.toDataURL(qrUrl, {
  width: 400,
  margin: 2,
  color: { dark: '#0F172A', light: '#FFFFFF' }
})
```

---

## Archivos a crear/modificar

```
NUEVOS:
src/app/fichar/[token]/page.tsx        ← página pública de fichaje
src/app/fichar/[token]/loading.tsx     ← skeleton loader
src/app/api/fichar/qr/route.ts         ← POST registrar fichada
src/app/api/fichar/qr/[token]/route.ts ← GET datos del punto
public/manifest.json                   ← PWA manifest

MODIFICAR:
prisma/schema.prisma                   ← agregar QR_WEB
src/lib/qr.ts                          ← nueva URL del QR
src/app/layout.tsx                     ← meta tags PWA
```

---

## Seguridad de esta ruta pública

La ruta `/fichar/[token]` es pública pero segura porque:

1. El token del QR es un UUID imposible de adivinar
2. La ubicación GPS es obligatoria — sin ella no registra
3. El colaborador se identifica por sesión guardada o DNI
4. El punto valida que pertenezca a una empresa activa
5. Rate limiting: máx 5 fichadas por IP por minuto

Agregar rate limiting en el endpoint:
```typescript
const { success } = await rateLimitAPI.limit(
  req.headers.get('x-forwarded-for') ?? 'unknown'
)
if (!success) return new Response('Too Many Requests', { status: 429 })
```

---

## Orden de implementación

1. Schema → agregar QR_WEB → migración
2. GET /api/fichar/qr/[token] → datos del punto
3. POST /api/fichar/qr → registrar fichada
4. Página /fichar/[token] con todos los estados
5. Actualizar generación de QR con nueva URL
6. PWA manifest + meta tags
7. Testear en celu real escaneando el QR
8. Verificar que la fichada aparece en el Listado del dashboard
9. Actualizar CLAUDE.md ✅

---

## Reglas obligatorias

1. La ruta /fichar/[token] es PÚBLICA — no pedir login
2. El empresa_id siempre viene del punto, nunca del body
3. GPS es obligatorio — sin coordenadas no registra
4. localStorage para recordar al empleado entre visitas
5. Botones grandes (min 60px) — se usa en obra con guantes
6. Fondo oscuro — se ve bien al sol
7. Nunca usar any en TypeScript
8. Rate limiting en el endpoint público

---

## ACTUALIZACIÓN — Diseño visual correcto para Fich.ar / Olimpia

Reemplazar la sección "Diseño visual" anterior por esta:

```
Colores — paleta exacta de Fich.ar:
- Fondo página:  #F8FAFC (gris muy claro, igual al dashboard)
- Card:          #FFFFFF (blanco con sombra suave)
- Primario:      #2563EB (azul Fich.ar)
- Gradiente:     linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)
- Entrada:       #10B981 (verde)
- Salida:        #EF4444 (rojo)
- Texto:         #0F172A (navy oscuro)
- Subtexto:      #475569

Tipografía: misma que el sistema — Calibri/Arial
Botones: tamaño normal — mismo estilo que el resto del sistema
Bordes: rounded-xl (igual que las cards del dashboard)
Sombras: sutiles, igual que las cards del resumen
Logo: mostrar logo-fichar.png arriba, igual que en el login
```

La página tiene que verse como una extensión del sistema Fich.ar,
no como algo aparte. Mismo header, mismo estilo de cards, mismos colores.
El empleado tiene que sentir que es parte del mismo producto.

### Header de la página
```
┌─────────────────────────────┐
│  [Logo Fich.ar]             │
│                             │
│  Olimpia Oficina            │
│  Lunes 18 de junio · 09:03  │
└─────────────────────────────┘
```

Usar los mismos componentes shadcn/ui que ya están en el proyecto:
Button, Card, Badge — no inventar componentes nuevos.
