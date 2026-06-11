# Fich.ar — Sistema SaaS de RRHH y Control de Asistencia

## Contexto del producto

**Fich.ar** es un sistema SaaS de gestión de RRHH y control de asistencia para empresas argentinas.
El primer cliente es **Olimpia** (empresa de administración y logística, Buenos Aires).
El sistema debe estar listo para escalar a múltiples empresas desde el día 1.

Reemplaza a **Qontact** (qeeptouch.com) — mismo concepto pero con:
- Bot de WhatsApp propio (Meta Business API)
- Asistente IA integrado (Claude de Anthropic)
- Multi-tenant real (cada empresa tiene su slug)
- Código 100% propio

**Dominio objetivo:** fich.ar
**URL local:** http://localhost:3000
**URL producción:** https://app.fich.ar/[slug]/resumen

---

## Stack tecnológico

```
Framework:        Next.js 14 (App Router) — monolito full-stack
Lenguaje:         TypeScript strict (nunca usar "any")
Estilos:          Tailwind CSS + shadcn/ui
ORM:              Prisma
Base de datos:    PostgreSQL (Railway)
Cache/Sesiones:   Redis (Upstash) — obligatorio para estado del bot WA
Auth:             NextAuth v5 (Auth.js)
Formularios:      React Hook Form + Zod
Estado servidor:  TanStack Query v5
Estado cliente:   Zustand
Íconos:           Lucide React
Animaciones:      Framer Motion
Gráficos:         Recharts
QR:               qrcode (generación PNG) + html5-qrcode (lectura)
WhatsApp:         Meta Business API (webhooks)
IA:               Anthropic API — claude-sonnet-4-20250514 con tool use
Export Excel:     xlsx (SheetJS)
Email:            Resend
Cron jobs:        Vercel Cron Jobs
Deploy:           Vercel (app) + Railway (PostgreSQL)
```

---

## Variables de entorno

Crear `.env.local` con:

```env
DATABASE_URL="postgresql://user:pass@host:5432/fichar"
NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
META_WA_TOKEN="EAAxxxxxxxx"
META_WA_PHONE_NUMBER_ID="1234567890"
META_WA_VERIFY_TOKEN="fichar-webhook-verify-2026"
META_APP_SECRET="para-verificar-firma-hmac"
ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"
UPSTASH_REDIS_URL="https://xxx.upstash.io"
UPSTASH_REDIS_TOKEN="xxxxxxxx"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Fich.ar"
```

---

## Schema Prisma completo

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum RolUsuario { SUPER_ADMIN ADMIN MANAGER }
enum EstadoColaborador { ACTIVO INACTIVO DESACTIVADO }
enum TipoNovedad { P PT AU VAC EN FR FE HDO C DES VIR }
enum TipoFichada { ENTRADA SALIDA }
enum MetodoFichada { QR_WHATSAPP MANUAL }
enum AnalisisFichada { LLEGADA_EN_TIEMPO LLEGADA_TARDE SALIDA_ANTICIPADA SALIDA_EN_TIEMPO SIN_SALIDA FUERA_DE_RANGO }
enum EstadoNotificacion { NO_LEIDA LEIDA }
enum TipoNotificacion { FALLA_FICHADA INASISTENCIA SISTEMA COMUNICACION_NUEVA }

model Empresa {
  id         String    @id @default(uuid())
  nombre     String
  slug       String    @unique
  logo_url   String?
  activa     Boolean   @default(true)
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  usuarios       Usuario[]
  colaboradores  Colaborador[]
  puntos_fichaje PuntoFichaje[]
  jornadas       Jornada[]
  fichadas       Fichada[]
  novedades      Novedad[]
  comunicaciones Comunicacion[]
  notificaciones Notificacion[]
  @@map("empresas")
}

model Usuario {
  id         String     @id @default(uuid())
  empresa_id String
  nombre     String
  email      String     @unique
  password   String
  rol        RolUsuario @default(ADMIN)
  activo     Boolean    @default(true)
  created_at DateTime   @default(now())
  updated_at DateTime   @updatedAt
  deleted_at DateTime?
  empresa           Empresa   @relation(fields: [empresa_id], references: [id])
  fichadas_manuales Fichada[] @relation("FichadaManualUsuario")
  @@index([empresa_id])
  @@map("usuarios")
}

model Colaborador {
  id             String            @id @default(uuid())
  empresa_id     String
  nombre         String
  apellido       String
  celular        String
  identificacion String?
  legajo         String?
  email          String?
  avatar_url     String?
  sector         String?
  estado         EstadoColaborador @default(ACTIVO)
  fecha_ingreso  DateTime?
  created_at     DateTime          @default(now())
  updated_at     DateTime          @updatedAt
  deleted_at     DateTime?
  empresa        Empresa              @relation(fields: [empresa_id], references: [id])
  fichadas       Fichada[]
  novedades      Novedad[]
  notificaciones Notificacion[]
  jornadas       ColaboradorJornada[]
  @@index([empresa_id])
  @@index([celular])
  @@map("colaboradores")
}

model PuntoFichaje {
  id           String   @id @default(uuid())
  empresa_id   String
  nombre       String
  latitud      Float
  longitud     Float
  radio_metros Int      @default(200)
  qr_token     String   @unique @default(uuid())
  activo       Boolean  @default(true)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  empresa  Empresa    @relation(fields: [empresa_id], references: [id])
  fichadas Fichada[]
  jornadas Jornada[]
  @@index([empresa_id])
  @@index([qr_token])
  @@map("puntos_fichaje")
}

model Jornada {
  id               String  @id @default(uuid())
  empresa_id       String
  punto_fichaje_id String
  nombre           String
  hora_inicio      String
  hora_fin         String
  tolerancia_min   Int     @default(15)
  lunes_presencial     Boolean @default(false)
  martes_presencial    Boolean @default(false)
  miercoles_presencial Boolean @default(false)
  jueves_presencial    Boolean @default(false)
  viernes_presencial   Boolean @default(false)
  sabado_presencial    Boolean @default(false)
  domingo_presencial   Boolean @default(false)
  lunes_virtual     Boolean @default(false)
  martes_virtual    Boolean @default(false)
  miercoles_virtual Boolean @default(false)
  jueves_virtual    Boolean @default(false)
  viernes_virtual   Boolean @default(false)
  sabado_virtual    Boolean @default(false)
  domingo_virtual   Boolean @default(false)
  activo     Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
  empresa       Empresa              @relation(fields: [empresa_id], references: [id])
  punto_fichaje PuntoFichaje         @relation(fields: [punto_fichaje_id], references: [id])
  colaboradores ColaboradorJornada[]
  @@index([empresa_id])
  @@index([punto_fichaje_id])
  @@map("jornadas")
}

model ColaboradorJornada {
  id             String    @id @default(uuid())
  colaborador_id String
  jornada_id     String
  fecha_desde    DateTime  @default(now())
  fecha_hasta    DateTime?
  colaborador Colaborador @relation(fields: [colaborador_id], references: [id])
  jornada     Jornada     @relation(fields: [jornada_id], references: [id])
  @@index([colaborador_id])
  @@index([jornada_id])
  @@map("colaborador_jornadas")
}

model Fichada {
  id                String           @id @default(uuid())
  empresa_id        String
  colaborador_id    String
  punto_fichaje_id  String?
  tipo              TipoFichada
  metodo            MetodoFichada    @default(QR_WHATSAPP)
  timestamp         DateTime         @default(now())
  latitud_real      Float?
  longitud_real     Float?
  distancia_metros  Int?
  analisis          AnalisisFichada?
  es_valida         Boolean          @default(true)
  nota_manual       String?
  usuario_manual_id String?
  usuario_manual Usuario?      @relation("FichadaManualUsuario", fields: [usuario_manual_id], references: [id])
  empresa        Empresa       @relation(fields: [empresa_id], references: [id])
  colaborador    Colaborador   @relation(fields: [colaborador_id], references: [id])
  punto_fichaje  PuntoFichaje? @relation(fields: [punto_fichaje_id], references: [id])
  created_at DateTime @default(now())
  @@index([empresa_id])
  @@index([colaborador_id])
  @@index([empresa_id, timestamp])
  @@index([colaborador_id, timestamp])
  @@map("fichadas")
}

model Novedad {
  id             String      @id @default(uuid())
  empresa_id     String
  colaborador_id String
  fecha          DateTime    @db.Date
  tipo           TipoNovedad
  observacion    String?
  aprobada       Boolean     @default(false)
  created_at     DateTime    @default(now())
  updated_at     DateTime    @updatedAt
  empresa     Empresa     @relation(fields: [empresa_id], references: [id])
  colaborador Colaborador @relation(fields: [colaborador_id], references: [id])
  @@unique([colaborador_id, fecha])
  @@index([empresa_id])
  @@index([empresa_id, fecha])
  @@map("novedades")
}

model Comunicacion {
  id           String    @id @default(uuid())
  empresa_id   String
  texto        String
  fecha_inicio DateTime  @default(now())
  fecha_fin    DateTime
  activa       Boolean   @default(true)
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  deleted_at   DateTime?
  empresa Empresa @relation(fields: [empresa_id], references: [id])
  @@index([empresa_id])
  @@map("comunicaciones")
}

model Notificacion {
  id             String             @id @default(uuid())
  empresa_id     String
  colaborador_id String?
  tipo           TipoNotificacion
  titulo         String
  descripcion    String?
  estado         EstadoNotificacion @default(NO_LEIDA)
  metadata       Json?
  created_at     DateTime           @default(now())
  empresa     Empresa      @relation(fields: [empresa_id], references: [id])
  colaborador Colaborador? @relation(fields: [colaborador_id], references: [id])
  @@index([empresa_id])
  @@index([empresa_id, estado])
  @@map("notificaciones")
}

model WebhookWA {
  id            String   @id @default(uuid())
  from_number   String
  body          String
  latitud       Float?
  longitud      Float?
  wa_message_id String   @unique
  procesado     Boolean  @default(false)
  error         String?
  created_at    DateTime @default(now())
  @@index([from_number])
  @@map("webhooks_wa")
}
```

---

## Estructura de carpetas

```
fichar/
├── CLAUDE.md
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── vercel.json
├── .env.local
├── .env.example
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/[slug]/
│   │   │   ├── layout.tsx
│   │   │   ├── resumen/page.tsx
│   │   │   ├── listado/page.tsx
│   │   │   ├── colaboradores/page.tsx
│   │   │   ├── colaboradores/[id]/page.tsx
│   │   │   ├── novedades/page.tsx
│   │   │   ├── puntos/page.tsx
│   │   │   ├── puntos/[id]/page.tsx
│   │   │   ├── comunicaciones/page.tsx
│   │   │   └── notificaciones/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── webhooks/whatsapp/route.ts
│   │       ├── cron/alertas/route.ts
│   │       ├── fichadas/route.ts
│   │       ├── colaboradores/route.ts
│   │       ├── novedades/route.ts
│   │       ├── puntos/route.ts
│   │       ├── comunicaciones/route.ts
│   │       ├── notificaciones/route.ts
│   │       └── ai/chat/route.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── dashboard/sidebar.tsx
│   │   ├── dashboard/header.tsx
│   │   ├── resumen/kpi-card.tsx
│   │   ├── resumen/grafico-fichadas.tsx
│   │   ├── listado/tabla-presentismo.tsx
│   │   ├── colaboradores/tabla-nomina.tsx
│   │   ├── novedades/calendario-reporte.tsx
│   │   ├── puntos/qr-display.tsx
│   │   └── ai/chat-widget.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── whatsapp.ts
│   │   ├── geo.ts
│   │   ├── jornadas.ts
│   │   └── utils.ts
│   └── types/index.ts
└── README.md
```

---

## Diseño visual

```css
--primary:       #E8593C   /* coral — color principal */
--primary-hover: #D04828
--primary-light: #FEF3F0   /* fondo item activo sidebar */
--sidebar-bg:    #FFFFFF
--bg-page:       #F9FAFB
--text-primary:  #111827
--text-muted:    #6B7280
--border:        #E5E7EB
```

Sidebar: fondo blanco, ícono Lucide + texto, activo con borde izquierdo coral y fondo `--primary-light`.
Logo "Fich.ar" en coral arriba del sidebar.
KPIs: Colaboradores (blanco/borde punteado), Ingresos (coral), Salidas (coral oscuro).

---

## Orden de implementación

### FASE 1 — Setup ✅
- [x] `npx create-next-app@latest fichar --typescript --tailwind --app`
- [x] Instalar: prisma @prisma/client next-auth bcryptjs zod react-hook-form @tanstack/react-query zustand lucide-react recharts framer-motion xlsx qrcode @upstash/redis
- [x] `npx shadcn@latest init` + componentes: button input label card table dialog select tabs badge avatar calendar popover dropdown-menu toast sheet
- [x] Schema Prisma + `npx prisma migrate dev --name init`
- [x] Seed con datos de Olimpia
- [x] NextAuth con credenciales
- [x] Layout dashboard + sidebar + header
- [ ] Middleware auth → redirige a `/[slug]/resumen` ⚠️ falta `src/middleware.ts` formal (auth funciona vía callbacks en auth.config.ts)

### FASE 2 — Core ✅
- [x] Resumen (KPIs + gráfico Recharts)
- [x] Listado (tabla + fichada manual + export Excel)
- [x] Colaboradores (CRUD + tabs + importar Excel)
- [x] Puntos QR (CRUD + jornadas + generar QR PNG)

### FASE 3 — Novedades y comunicación ✅
- [x] Novedades (inasistencias + calendario + export Excel)
- [x] Comunicaciones (cartelera + vencimiento)
- [x] Notificaciones (tabs + badge + marcar leídas)

### FASE 4 — Bot WhatsApp ✅
- [x] Webhook Meta (GET verificación + POST mensajes)
- [x] Flujo: token QR → botones → ubicación → validar GPS → fichar
- [x] Estado sesión en Redis
- [x] Cron alertas 13:00 UTC (10:00 ARG)

### FASE 5 — IA ✅
- [x] Chat widget flotante
- [x] `/api/ai/chat` con system prompt dinámico
- [x] Tools: query_fichadas, query_novedades, get_resumen_dia, crear_novedad, crear_comunicacion, listar_colaboradores

### FASE 6 — Proyección + Mejoras bot ✅
- [x] Schema Prisma: ProyeccionMensual + AsignacionMensual
- [x] Parser planilla Excel mensual (`src/lib/importar-planilla.ts`)
- [x] Página `/[slug]/proyeccion` con resumen, detalle y comparación
- [x] Endpoints `/api/proyeccion` + `/api/proyeccion/importar` + confirmar
- [x] Importar servicios para Puntos QR (`importar-servicios-modal.tsx`)
- [x] Sincronizar colaboradores — nuevo flujo con preview y desactivación
- [x] Bot WhatsApp: identificación por DNI como fallback
- [x] Bot WhatsApp: cruce con proyección mensual al fichar (avisar franco)
- [x] Sidebar: ítem Proyección agregado

### FASE 7 — Producción ← EMPEZAR AQUÍ
- [ ] `npx prisma migrate dev --name proyeccion` — ejecutar en DB
- [ ] `src/middleware.ts` formal con matcher de rutas
- [ ] Rate limiting en webhooks WhatsApp
- [ ] Validación de permisos por rol (SUPER_ADMIN / ADMIN / MANAGER) en todos los endpoints
- [ ] Tests de integración críticos (webhook WA, cron alertas, fichada GPS)
- [ ] Dominio fich.ar + deploy Vercel + Railway

---

## Lógica crítica

### lib/geo.ts
```typescript
export function calcularDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
```

### lib/jornadas.ts
```typescript
export function calcularAnalisis(timestamp: Date, tipo: 'ENTRADA'|'SALIDA', jornada?: {hora_inicio:string;hora_fin:string;tolerancia_min:number}) {
  if (!jornada) return tipo === 'ENTRADA' ? 'LLEGADA_EN_TIEMPO' : 'SALIDA_EN_TIEMPO'
  const hora = timestamp.getHours()*60 + timestamp.getMinutes()
  const [hI,mI] = jornada.hora_inicio.split(':').map(Number)
  const [hF,mF] = jornada.hora_fin.split(':').map(Number)
  if (tipo === 'ENTRADA') return hora <= hI*60+mI+jornada.tolerancia_min ? 'LLEGADA_EN_TIEMPO' : 'LLEGADA_TARDE'
  return hora >= hF*60+mF ? 'SALIDA_EN_TIEMPO' : 'SALIDA_ANTICIPADA'
}

// Cron alertas: sin jornada=no alertar, día virtual=no alertar, día no laboral=no alertar
// día presencial sin fichada = crear Novedad{tipo:'AU'} + Notificacion{tipo:'INASISTENCIA'}
```

### vercel.json
```json
{
  "crons": [{ "path": "/api/cron/alertas", "schedule": "0 13 * * *" }]
}
```

---

## Seed — Olimpia

```typescript
// Empresa
{ nombre: 'Olimpia', slug: 'olimpia' }

// Admin
{ email: 'admin@olimpia.com', password: bcrypt('admin123') }

// Puntos
{ nombre: 'Ohlimpia Oficina',   lat: -34.5724, lng: -58.4506, radio: 200 }
{ nombre: 'Deposito Logistica', lat: -34.5838, lng: -58.4504, radio: 300 }

// Jornadas (punto Oficina)
{ nombre: 'L-V 9 a 17',                 09:00-17:00, L/M/Mi/J/V presencial }
{ nombre: '4 dias + virtual miercoles', 09:00-17:00, L/M/J/V presencial, Mi virtual }
{ nombre: '2 dias presenciales',        09:00-17:00, L/M presencial }

// Jornada (punto Deposito)
{ nombre: 'Administracion', 09:00-17:00, L/M/Mi/J/V presencial }

// Colaboradores
{ nombre: 'Gabriela',          apellido: 'Lucero',             celular: '+5491136832051' }
{ nombre: 'Cecilia Raquel',    apellido: 'Recalde Samaniego',  celular: '+5491136830491' }
{ nombre: 'Lucas Valentin',    apellido: 'Maidana',            celular: '+5491133045658' }
{ nombre: 'Yolanda',           apellido: 'Panica Zulema',      celular: '+5491134736440' }
{ nombre: 'Florencia Beatriz', apellido: 'Puma',               celular: '+5491138075464', legajo: '2570' }
{ nombre: 'Martina Concepcion',apellido: 'Ramirez Benitez',    celular: '+5491122751376' }
{ nombre: 'Rocio Del Cielo',   apellido: 'Rodriguez Naara',    celular: '+5491136831803' }
{ nombre: 'Matilde',           apellido: 'Noceti',             celular: '+5491136855479' }
{ nombre: 'Sandra',            apellido: 'Luna',               celular: '+5491100000001' }
{ nombre: 'Jimena Mariel',     apellido: 'Martinez Guillen',   celular: '+5491100000002' }
```

---

## Reglas obligatorias

1. Nunca `any` en TypeScript
2. Nunca query sin `where: { empresa_id }` — el `empresa_id` SIEMPRE viene del JWT, nunca del body
3. Nunca procesar webhook WA sin verificar firma HMAC
4. Siempre Redis para estado del bot (nunca DB para esto)
5. Siempre loading + error + empty state en cada página
6. Siempre soft delete (`deleted_at`), nunca borrar datos reales
7. Al terminar cada fase marcar el checkbox ✅ en este archivo
