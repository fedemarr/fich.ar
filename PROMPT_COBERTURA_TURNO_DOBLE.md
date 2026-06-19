# Fich.ar — Coberturas y turno doble

## Contexto
Olimpia tiene operarios que pueden:
1. Cubrir a un compañero que faltó en otro punto (cobertura)
2. Trabajar en dos puntos distintos el mismo día (turno doble)

Ambos casos se manejan desde la PWA de fichaje y el dashboard.
Leer CLAUDE.md y PROMPT_PWA_FICHAJE.md antes de implementar.

---

## ESCENARIO 1 — Cobertura de ausente

### Qué pasa
```
Juan faltó en Depósito Logística
María va a cubrir su turno
María escanea el QR del Depósito
En la proyección del mes, María NO figura en ese punto ese día
→ Sistema detecta que no está asignada
→ Muestra pantalla "Asistencia pendiente"
→ Admin aprueba desde el dashboard
→ Queda registrado como COBERTURA
```

### Pantalla en la PWA — "Asistencia pendiente"
```
┌─────────────────────────────────┐
│  [Logo Fich.ar]                 │
│                                 │
│  Deposito Logística             │
│  Lunes 18 de junio · 14:03     │
│                                 │
│  ⏳                             │
│                                 │
│  Asistencia pendiente           │
│  de confirmación                │
│                                 │
│  Hola María, no figurás         │
│  asignada a este punto hoy.     │
│                                 │
│  Tu solicitud fue enviada al    │
│  administrador para que la      │
│  confirme.                      │
│                                 │
│  Te avisamos cuando esté        │
│  aprobada. Podés cerrar         │
│  esta página.                   │
└─────────────────────────────────┘
```

---

## ESCENARIO 2 — Turno doble (en proyección)

### Qué pasa
```
Pedro tiene en la proyección del mes:
  - Mañana: Oficina 9:00 a 13:00
  - Tarde:  Depósito 14:00 a 18:00

Pedro escanea QR Oficina a las 9 → entrada normal ✅
Pedro escanea QR Depósito a las 14 → entrada normal ✅

El sistema matchea los dos turnos con la proyección
y los registra como fichadas válidas sin intervención del admin
```

### Lógica de matcheo con proyección
```typescript
// Al recibir una fichada de Pedro en el Depósito a las 14hs:
// 1. Buscar en AsignacionMensual si Pedro tiene turno en ese punto hoy
// 2. Si tiene turno Y la hora coincide con el rango → fichada normal
// 3. Si NO tiene turno → cobertura pendiente de aprobación

const asignacion = await prisma.asignacionMensual.findFirst({
  where: {
    colaborador_id:   colaborador.id,
    punto_fichaje_id: punto.id,
    proyeccion: {
      mes:  currentMonth,
      anio: currentYear,
    }
  }
})

const diaActual = `dia_${String(new Date().getDate()).padStart(2, '0')}`
const horasAsignadas = asignacion?.[diaActual]

if (!asignacion || !horasAsignadas || horasAsignadas === 0) {
  // No está asignado → cobertura pendiente
  return crearSolicitudCobertura(colaborador, punto, latitud, longitud)
}

// Está asignado → fichada normal
return registrarFichada(colaborador, punto, 'ENTRADA', latitud, longitud)
```

---

## Schema — nuevas tablas

### SolicitudCobertura
```prisma
model SolicitudCobertura {
  id               String              @id @default(uuid())
  empresa_id       String
  colaborador_id   String
  punto_fichaje_id String
  fecha            DateTime            @default(now())
  latitud_real     Float?
  longitud_real    Float?
  distancia_metros Int?
  estado           EstadoCobertura     @default(PENDIENTE)
  aprobada_por_id  String?
  aprobada_at      DateTime?
  rechazada_por_id String?
  rechazada_at     DateTime?
  motivo_rechazo   String?
  fichada_id       String?             // se crea cuando se aprueba

  empresa        Empresa       @relation(fields: [empresa_id], references: [id])
  colaborador    Colaborador   @relation(fields: [colaborador_id], references: [id])
  punto_fichaje  PuntoFichaje  @relation(fields: [punto_fichaje_id], references: [id])
  aprobada_por   Usuario?      @relation("AprobadorCobertura", fields: [aprobada_por_id], references: [id])
  fichada        Fichada?      @relation(fields: [fichada_id], references: [id])

  @@index([empresa_id])
  @@index([estado])
  @@index([empresa_id, estado])
  @@map("solicitudes_cobertura")
}

enum EstadoCobertura {
  PENDIENTE
  APROBADA
  RECHAZADA
}
```

### Agregar en TipoNovedad
```prisma
enum TipoNovedad {
  // ...existentes...
  COB  // Cobertura — cubrió a un compañero ausente
}
```

### Agregar en MetodoFichada
```prisma
enum MetodoFichada {
  QR_WHATSAPP
  QR_WEB
  MANUAL
  COBERTURA  // ← aprobada por admin desde solicitud
}
```

```bash
npx prisma migrate dev --name add-coberturas-turno-doble
```

---

## Endpoint POST /api/fichar/qr — lógica actualizada

```typescript
// Después de validar GPS y identificar colaborador:

// Verificar si está en la proyección del día
const estaEnProyeccion = await verificarProyeccion(
  colaborador.id,
  punto.id,
  new Date()
)

if (!estaEnProyeccion) {
  // Crear solicitud de cobertura pendiente
  const solicitud = await prisma.solicitudCobertura.create({
    data: {
      empresa_id:       punto.empresa_id,
      colaborador_id:   colaborador.id,
      punto_fichaje_id: punto.id,
      latitud_real:     latitud,
      longitud_real:    longitud,
      distancia_metros: Math.round(distancia),
      estado:           'PENDIENTE',
    }
  })

  // Notificar al admin
  await prisma.notificacion.create({
    data: {
      empresa_id:     punto.empresa_id,
      tipo:           'SISTEMA',
      titulo:         `Cobertura pendiente — ${colaborador.nombre} ${colaborador.apellido}`,
      descripcion:    `Quiere fichar en ${punto.nombre} pero no figura en la proyección de hoy`,
      metadata:       { solicitud_id: solicitud.id }
    }
  })

  return NextResponse.json({
    ok:      true,
    estado:  'PENDIENTE_APROBACION',
    mensaje: 'Tu solicitud fue enviada al administrador',
    colaborador: {
      nombre: `${colaborador.nombre} ${colaborador.apellido}`
    },
    punto: { nombre: punto.nombre }
  })
}

// Está en proyección → fichada normal
// ...código existente
```

---

## Dashboard — nueva sección en Notificaciones

### Tab nuevo: "Coberturas pendientes"

```
Notificaciones
├── Sistema
├── Fallas de fichadas
└── Coberturas pendientes  ← NUEVO (con badge si hay pendientes)
```

### Vista de coberturas pendientes
```
┌────────────────────────────────────────────────────────────┐
│ Coberturas pendientes          3 pendientes                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [MA] María Avalos                    Hoy 14:03           │
│       Deposito Logística                                   │
│       No figura en proyección · GPS verificado ✓ (45m)   │
│                                    [✓ Aprobar] [✗ Rechazar]│
├────────────────────────────────────────────────────────────┤
│  [RC] Rodrigo Castillo               Hoy 09:15            │
│       Ohlimpia Oficina                                     │
│       No figura en proyección · GPS verificado ✓ (80m)   │
│                                    [✓ Aprobar] [✗ Rechazar]│
├────────────────────────────────────────────────────────────┤
│  [LG] Lucero Gabriela                Ayer 17:45           │
│       Deposito Logística                                   │
│       No figura en proyección · GPS verificado ✓ (120m)  │
│                                    [✓ Aprobar] [✗ Rechazar]│
└────────────────────────────────────────────────────────────┘
```

---

## Endpoint POST /api/coberturas/[id]/aprobar

```typescript
export async function POST(req: Request, { params }) {
  const { error, session } = await verificarAcceso('APROBAR_NOVEDAD')
  if (error) return error

  const solicitud = await prisma.solicitudCobertura.findUnique({
    where: { id: params.id },
    include: { colaborador: true, punto_fichaje: true }
  })

  if (!solicitud || solicitud.empresa_id !== session.user.empresa_id) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  if (solicitud.estado !== 'PENDIENTE') {
    return NextResponse.json({ error: 'Ya fue procesada' }, { status: 400 })
  }

  // Crear la fichada real
  const fichada = await prisma.fichada.create({
    data: {
      empresa_id:       solicitud.empresa_id,
      colaborador_id:   solicitud.colaborador_id,
      punto_fichaje_id: solicitud.punto_fichaje_id,
      tipo:             'ENTRADA',
      metodo:           'COBERTURA',
      timestamp:        solicitud.fecha,  // hora original del escaneo
      latitud_real:     solicitud.latitud_real,
      longitud_real:    solicitud.longitud_real,
      distancia_metros: solicitud.distancia_metros,
      analisis:         'LLEGADA_EN_TIEMPO',
      es_valida:        true,
      nota_manual:      'Cobertura aprobada por administrador',
    }
  })

  // Crear novedad COB
  await prisma.novedad.upsert({
    where: {
      colaborador_id_fecha: {
        colaborador_id: solicitud.colaborador_id,
        fecha:          startOfDay(solicitud.fecha)
      }
    },
    update: { tipo: 'COB' },
    create: {
      empresa_id:     solicitud.empresa_id,
      colaborador_id: solicitud.colaborador_id,
      fecha:          startOfDay(solicitud.fecha),
      tipo:           'COB',
      observacion:    `Cobertura en ${solicitud.punto_fichaje.nombre}`,
      aprobada:       true,
    }
  })

  // Actualizar solicitud
  await prisma.solicitudCobertura.update({
    where: { id: params.id },
    data: {
      estado:          'APROBADA',
      aprobada_por_id: session.user.id,
      aprobada_at:     new Date(),
      fichada_id:      fichada.id,
    }
  })

  // Registrar en audit log
  await registrarAudit({
    empresa_id: session.user.empresa_id,
    usuario_id: session.user.id,
    rol:        session.user.rol,
    accion:     'APROBAR_COBERTURA',
    entidad:    'solicitud_cobertura',
    entidad_id: params.id,
  })

  return NextResponse.json({ ok: true, fichada_id: fichada.id })
}
```

## Endpoint POST /api/coberturas/[id]/rechazar

```typescript
// Similar al aprobar pero:
// - NO crea fichada
// - Actualiza estado a RECHAZADA
// - Acepta motivo_rechazo en el body
// - Crea notificación para el colaborador (si tiene celu registrado)
```

---

## Lógica de verificación de proyección

```typescript
// src/lib/proyeccion.ts

export async function verificarProyeccion(
  colaborador_id: string,
  punto_fichaje_id: string,
  fecha: Date
): Promise<boolean> {
  const mes  = fecha.getMonth() + 1
  const anio = fecha.getFullYear()
  const dia  = `dia_${String(fecha.getDate()).padStart(2, '0')}`

  const asignacion = await prisma.asignacionMensual.findFirst({
    where: {
      colaborador_id,
      punto_fichaje_id,
      proyeccion: { mes, anio }
    }
  })

  if (!asignacion) return false

  // Verificar que ese día específico tiene horas asignadas
  const horasDelDia = asignacion[dia as keyof typeof asignacion] as number | null
  return horasDelDia !== null && horasDelDia > 0
  // null = no laboral, 0 = franco, número = tiene horas → debe fichar
}
```

---

## Resumen visual del flujo completo

```
Empleado escanea QR
        ↓
¿Está en la proyección del día?
        │
   SÍ ─┤─ NO
        │     ↓
        │   Pantalla "Asistencia pendiente"
        │   Notificación al admin
        │   Admin ve en "Coberturas pendientes"
        │   [Aprobar] → crea Fichada + Novedad COB
        │   [Rechazar] → descarta
        │
        ↓
¿Tiene más de un turno hoy? (turno doble en proyección)
        │
   SÍ ─┤─ NO
        │     ↓
        │   Fichada normal ✅
        │
        ↓
Primera fichada del día en ese punto → ENTRADA
Segunda fichada → SALIDA
Tercera (turno doble, nuevo punto) → ENTRADA del segundo turno
```

---

## Archivos a crear/modificar

```
NUEVOS:
src/lib/proyeccion.ts
src/app/api/coberturas/[id]/aprobar/route.ts
src/app/api/coberturas/[id]/rechazar/route.ts
src/app/api/coberturas/route.ts            ← GET lista pendientes
src/components/notificaciones/coberturas-tab.tsx

MODIFICAR:
prisma/schema.prisma                       ← SolicitudCobertura + enums
src/app/api/fichar/qr/route.ts             ← lógica de cobertura
src/app/(dashboard)/[slug]/notificaciones/page.tsx ← tab coberturas
```

---

## Orden de implementación

1. Schema + migración
2. src/lib/proyeccion.ts → verificarProyeccion()
3. Actualizar /api/fichar/qr → detectar cobertura
4. Actualizar PWA → pantalla "Asistencia pendiente"
5. GET /api/coberturas → lista pendientes
6. POST /api/coberturas/[id]/aprobar
7. POST /api/coberturas/[id]/rechazar
8. Tab "Coberturas pendientes" en Notificaciones
9. Testear los dos escenarios end-to-end
10. Actualizar CLAUDE.md ✅

---

## Reglas obligatorias

1. La cobertura guarda la hora ORIGINAL del escaneo — no la hora de aprobación
2. El GPS se valida igual que una fichada normal — sin GPS no hay cobertura
3. Solo ADMIN y MANAGER pueden aprobar/rechazar coberturas
4. El turno doble en proyección no necesita aprobación — es automático
5. Una solicitud solo se puede aprobar/rechazar una vez
6. Nunca usar any en TypeScript
7. Siempre filtrar por empresa_id
