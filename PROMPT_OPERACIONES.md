# MÓDULO OPERACIONES — Jornada.OH
## Prompt maestro · construcción por fases

---

# CÓMO TRABAJAMOS

Este documento describe un módulo completo dividido en 5 fases. **No construyas todo de una.**

1. **Empezá explorando el repo.** Antes de escribir nada, entendé cómo están implementados los puntos QR, la validación GPS, el multi-tenant, los roles, la PWA de fichaje, los jobs automáticos y el audit log.
2. **Antes de cada fase, mostrame un plan** y esperá mi confirmación: qué modelos, qué archivos, qué rutas, en qué orden.
3. **Construí solo la fase que te indique.** Si no te digo cuál, arrancá por Fase 0 y después Fase 1.
4. **Al terminar una fase, pará.** Decime qué quedó hecho, qué habría que probar en producción, y esperá mi confirmación.
5. **Si algo es ambiguo o contradice el sistema actual, preguntá.** No asumas.
6. **No agregues dependencias nuevas sin justificarlo.**

Regla número uno: **REUTILIZAR, NO RECONSTRUIR.**

---

# CONTEXTO DEL SISTEMA ACTUAL

Jornada.OH (repo fich-ar) es un SaaS multi-tenant de control de asistencia, en producción.

**Ya existe y funciona:**
- Multi-tenant por slug de empresa. Toda query filtra por tenant.
- Puntos QR con coordenadas GPS y radio de tolerancia configurable.
- Validación de distancia por GPS al fichar (Haversine).
- PWA de fichaje que abre al escanear un QR.
- Canal WhatsApp Business API para fichar.
- Nómina de colaboradores, jornadas presenciales y virtuales.
- Roles: SUPER_ADMIN / ADMIN / MANAGER.
- Módulos: Resumen, Mi Equipo, Listado del día, Novedades, Comunicaciones, Notificaciones.
- Jobs automáticos diarios (recordatorio 8:45, ausencia automática 10:00).
- Audit log.

**Todo eso se reutiliza. No construyas versiones paralelas.**

Terminología obligatoria: se dice **asociados** (nunca "empleados") y **Supervisor** (nunca "Jefe").

---

# OBJETIVO GENERAL

Que una empresa defina procedimientos operativos (ej: "Apertura del local"), que se generen automáticamente cada día según turno, que los asociados los ejecuten desde la PWA aportando evidencia (foto, checklist, QR, comentario), y que el supervisor vea todo en tiempo real.

A futuro: validación asistida por IA, incidencias, analítica operativa y autoservicio.

---

# PRINCIPIOS DE DISEÑO (aplican a todo el módulo)

Estos principios están por encima de cualquier funcionalidad puntual. Si algo en este documento parece contradecirlos, preguntá.

**1. Nunca dejar a un asociado trabado.**
Ningún mecanismo (validación, bloqueo, dependencia) puede impedirle a una persona seguir trabajando. Siempre tiene que haber una válvula de escape. Un sistema que deja a alguien parado a las 6 AM sin supervisor disponible se deja de usar en una semana.

**2. El dato falseado es peor que la ausencia de dato.**
Si el sistema es demasiado rígido, la gente aprende a mentirle: tilda tareas sin hacerlas para poder avanzar. Preferimos registrar "se salteó el orden, motivo X" antes que forzar un cumplimiento ficticio.

**3. La IA asiste, no sentencia.**
La IA opina y explica. La decisión final con consecuencias operativas es humana, salvo en casos de altísima confianza y solo después de haber medido su desempeño real contra supervisores.

**4. Medir, no castigar.**
Los tiempos estimados sirven para detectar desvíos y mejorar procesos, no para sancionar. Una demora se marca y se informa; nunca impide completar la tarea.

**5. El asociado también tiene que ganar algo.**
Esto se percibe como vigilancia. Para que funcione, el asociado necesita ver su propio cumplimiento, tener respaldo documentado cuando lo acusan injustamente, y que reportar un problema efectivamente se lo resuelva.

---

# FASE 0 — DECISIONES PREVIAS

**No es código.** Son decisiones que condicionan todo y cambiarlas después obliga a migrar datos.

Analizá el repo y proponeme una recomendación para cada punto, con trade-offs. Esperá mi decisión antes de implementar.

## 0.1 — Arquitectura de evidencia fotográfica

Las fotos son el costo variable del producto y donde más fácil se rompe la escalabilidad. Volumen estimado: 50 asociados × 8 tareas con foto × 22 días ≈ **9.000 fotos/mes por cliente**.

**0.1.a — Dónde se guardan.**
En PostgreSQL va solo la referencia (key), nunca el binario. Evaluá considerando que el deploy es Vercel y que el supervisor va a ver esas fotos varias veces (egreso):
- Vercel Blob — nativo, cero config, más caro por GB
- Cloudflare R2 — sin costo de egreso, más barato a volumen
- AWS S3 — más barato aún, más configuración

**0.1.b — Cómo suben (crítico).**
**No subir a través de la API.** Las funciones serverless de Vercel tienen límite de body y se paga tiempo de ejecución.

Flujo correcto, **presigned URL**:
1. La PWA pide a la API permiso de subida para esa tarea
2. La API valida (asociado tiene esa tarea, está en curso, tenant correcto) y devuelve URL firmada con vencimiento corto
3. El navegador sube **directo al storage**
4. La PWA confirma a la API y ahí se persiste la referencia

**0.1.c — Compresión en el cliente (no negociable).**
Foto de celular = 3-8 MB. Antes de subir, la PWA redimensiona y comprime en el navegador: lado mayor ~1600px, JPEG calidad ~0.8 → 200-400 KB. **De ~5 MB a ~300 KB es 94% menos de almacenamiento, ancho de banda y tiempo de subida.** Para un asociado con señal floja es la diferencia entre que funcione o no.

**0.1.d — Thumbnails.**
Generar miniatura (~300px, ~20 KB) al subir. La grilla del supervisor muestra thumbnails; la foto completa solo al abrir el detalle.

**0.1.e — Acceso privado, nunca URLs públicas.**
Las fotos muestran instalaciones, mercadería y a veces personas de una empresa cliente. Bucket privado. Para mostrar, la API genera URL firmada de lectura con vencimiento corto, validando tenant y permisos. Nunca URL permanente ni adivinable.

**0.1.f — Organización de keys.**
```
{tenant}/{año}/{mes}/{ejecucion_tarea_id}/{uuid}.jpg
{tenant}/{año}/{mes}/{ejecucion_tarea_id}/{uuid}_thumb.jpg
```
Permite borrar por cliente (obligación legal al dar de baja) y archivar por período.

**0.1.g — Retención.**
Proponeme política. Punto de partida: 0-12 meses estándar, 12+ meses archivado o eliminación, cliente dado de baja se elimina a los X días con aviso previo. Configurable por empresa (algunos rubros tienen obligaciones de conservación distintas).

## 0.2 — Identidad del asociado en la PWA
Hoy el fichaje identifica por celular con DNI como fallback, sin sesión persistente. Para ejecutar tareas hace falta sesión. Opciones: link mágico, PIN corto, o sesión que persiste tras el primer fichaje del día.

## 0.3 — Comportamiento sin señal
Un asociado en cámara fría, depósito o sótano no tiene datos. Si la PWA no funciona ahí, el módulo no sirve. Decidir si se permite completar tareas offline con sincronización posterior. Si sí, hay que diseñarlo desde el modelo de datos.

## 0.4 — Tareas no realizadas
¿Quedan pendientes indefinidamente? ¿Se cierran al terminar el turno? ¿Piden justificación? Recomendación a evaluar: al cerrar el turno pasan a "no realizada" y requieren motivo.

## 0.5 — Multi-sede
Hoy es una empresa = un tenant. Una cadena con 40 sucursales necesita ver consolidado y por sucursal. Definir **ahora** si se agrega Sede/Sucursal como nivel intermedio entre empresa y punto QR. Agregarlo después obliga a migrar todo.

---

# FASE 1 — NÚCLEO OPERATIVO

**Objetivo:** que una empresa defina procedimientos y sus asociados los ejecuten con evidencia.

## Entidades

**Procedimiento** (plantilla reutilizable)
Empresa, nombre, descripción, turno asociado, días de la semana en que aplica, estado activo/inactivo.

**Tarea** (dentro de un procedimiento)
Nombre, descripción, orden, punto QR requerido (opcional, referencia a punto QR existente), requisitos de evidencia, tiempo estimado en minutos (opcional), obligatoria u omitible, **es_critica** (bool — ver sección de orden).

**ChecklistItem**
Texto + marcado sí/no.

**Turno**
Nombre, hora inicio, hora fin. Por empresa.

**EjecucionProcedimiento** (instancia diaria)
Procedimiento origen, fecha, turno, estado (pendiente / en curso / completado / incompleto).

**EjecucionTarea** (instancia)
Tarea origen, asociado que la ejecutó, estado (pendiente / en curso / completada / omitida / rechazada), hora inicio, hora fin, coordenadas GPS al completar, comentario, checklist marcado, estado de validación, validada por quién, **se_salteo_orden** (bool) y **motivo_salteo** (texto).

**Foto**
Referencia a EjecucionTarea, key del original, key del thumbnail, tamaño en bytes, dimensiones, timestamp de captura, **coordenadas GPS del momento de la captura**, asociado que la subió, estado de subida (pendiente / completa / fallida), **hash del contenido**.

> **Guardá el hash desde Fase 1 aunque no lo uses todavía.** Es lo que después permite detectar fotos reutilizadas. Calcularlo retroactivamente sobre decenas de miles de imágenes es un dolor evitable.

> **No agregues un nivel intermedio de "Actividades" entre Tarea y Checklist.** Tres niveles (Procedimiento → Tarea → Checklist) alcanzan. Un cuarto se paga en cada pantalla, cada query y cada formulario.

## Configuración de evidencia por tarea

- **Fotos:** cantidad mínima (0 = no requiere), cantidad máxima, e **instrucción para el asociado** (texto libre: "sacá la foto mostrando el piso y el dispenser de jabón")
- **Comentario:** requerido sí/no
- **Checklist:** ítems configurables
- **QR:** punto requerido, opcional

> La instrucción de foto es más importante de lo que parece: hace que las fotos sean comparables entre sucursales y turnos, y **en Fase 3 es la base de lo que la IA va a verificar.**

## Orden de tareas — bloqueo blando

Las tareas se muestran en orden. El comportamiento por defecto es **bloqueo blando**:

- Las tareas posteriores aparecen visualmente como "bloqueadas"
- Pero tienen un botón **"hacer igual"** que pide un motivo breve
- Al usarlo, se registra `se_salteo_orden = true` y el motivo
- El asociado sigue trabajando

**Excepción — tareas críticas.** El admin puede marcar una tarea como `es_critica`. Solo esas tienen bloqueo duro real (caso de uso: no podés limpiar la máquina sin cortar la energía primero). Debe ser una decisión explícita y excepcional, no el default.

**Por qué así:** el orden del papel no es el orden real. Llegó el camión antes de lo previsto, la máquina no arranca y mientras espera al técnico hace otra cosa. Si el sistema bloquea, el asociado aprende a tildar tareas sin hacerlas para desbloquear las siguientes — y ahí el dato se vuelve basura. Registrar el salteo con motivo es información valiosa: si el 80% saltea siempre en el mismo punto, el procedimiento está mal diseñado.

## Tiempos

El tiempo estimado por tarea sirve para **medir, no para castigar**. Si se excede, se marca demorada y se informa al supervisor. **Nunca impide completar la tarea.** A veces se tardó más porque la situación estaba peor de lo normal, y eso es información, no infracción.

## Flujos

**1. Configuración (panel admin)**
Crear/editar/desactivar procedimientos · agregar y ordenar tareas · configurar evidencia requerida · marcar tareas críticas · asociar a punto QR existente · crear y editar turnos · listado de procedimientos.

Usá **formularios normales**. NO construyas editor visual ni drag-and-drop en esta fase.

**2. Generación automática diaria**
Job de madrugada que, por cada empresa, genera las ejecuciones del día de los procedimientos activos cuyo turno y día de semana correspondan. Si ya existe para esa fecha, no duplicar.

**3. Ejecución desde la PWA (asociado)**

Ve sus tareas del día agrupadas por procedimiento, en orden, con estado.

Al abrir una tarea:
- Si requiere QR: escanearlo. Validar punto correcto y dentro del radio (**reutilizar lógica de fichaje existente**)
- Si requiere foto: ve la instrucción, toca el botón y **se abre la cámara directamente** (no el selector de galería). La imagen se comprime en el navegador, se pide presigned URL, sube directo al storage, y se muestra preview con opción de descartar y repetir
- Si requiere checklist: marcar ítems
- Si requiere comentario: escribirlo
- Botón completar habilitado solo cuando se cumplieron todos los requisitos

Al completar se registra hora, GPS y evidencia.

**Manejo de fallas de subida:** si falla por señal, la foto queda en cola local y se reintenta. La tarea no se marca completada hasta confirmar la subida. El asociado ve el estado claramente ("subiendo…", "1 de 2 fotos subidas").

**Sobre forzar cámara:** usar el atributo que abre cámara directamente en vez de permitir galería. No es infalible, pero elimina el atajo fácil. La detección seria de fotos reutilizadas viene con el hash y la IA en Fase 3.

**4. Vista supervisor**

Para el día actual:
- Procedimientos y su avance ("Apertura del local — 4 de 7")
- Tareas pendientes, completadas, demoradas y salteadas (con su motivo)
- Evidencia de cada tarea completada: thumbnails en grilla; al tocar uno se abre la foto completa con **hora exacta de captura, ubicación GPS, quién la subió, y si hubo diferencia entre la ubicación de la foto y la del punto QR**
- Navegar entre las fotos de esa tarea sin cerrar el visor
- Aprobar o rechazar la tarea. **Al rechazar, poder indicar cuál foto es el problema y por qué** — si solo puede rechazar la tarea entera sin decir qué estuvo mal, el asociado no aprende y repite el error

## No incluir en Fase 1
Validación IA · dependencias complejas entre tareas · editor visual · reportes analíticos · incidencias · asignación individual · firma digital · notificaciones push por tarea.

Dejá en el modelo el campo de estado de validación con la opción "pendiente de validación IA", pero en esta fase la validación es **100% humana**.

## Criterio de cierre
Una empresa real usa el módulo un mes completo sin intervención del desarrollador, y los supervisores dejaron de pedir la información por WhatsApp.

---

# FASE 2 — CONFIABILIDAD OPERATIVA

**Objetivo:** que el módulo aguante la realidad del terreno.

**Incidencias** (lo más importante de esta fase)
El asociado puede reportar que algo salió mal: máquina rota, falta insumo, riesgo de seguridad, situación anormal. Con foto, ubicación GPS y categoría configurable. Esto convierte a cada asociado en un sensor de la empresa — para muchos clientes va a ser más valioso que el checklist en sí.

**Excepciones y justificaciones**
Tarea no realizada requiere motivo de una lista configurable por empresa ("no había insumo", "cliente no permitió acceso", "falta de tiempo"). Esos motivos agregados son el mapa de dónde se rompe la operación.

**Asignación de tareas**
Asignar a un asociado específico, a un sector, o dejar abiertas para cualquiera del turno.

**Ventanas horarias**
Hora esperada de inicio y fin por tarea. Al excederse se marca demorada y notifica.

**Dependencias entre tareas**
Ahora sí, con criterio: **con los datos de salteo de la Fase 1 vas a saber qué secuencias importan de verdad y cuáles bloquear habría sido un error.** Antes de implementar, analizá esos datos y proponeme qué dependencias tienen sustento.

**Notificaciones operativas**
Al supervisor: incidencia reportada, tarea crítica demorada, procedimiento incompleto al cerrar turno.

**Entidades nuevas:** Incidencia · MotivoExcepcion · AsignacionTarea · DependenciaTarea

**Criterio de cierre:** el supervisor se entera de los problemas por el sistema antes que por un llamado telefónico.

---

# FASE 3 — VALIDACIÓN ASISTIDA POR IA

**Objetivo:** reducir la carga de validación humana sin romper la operación.

**Se hace acá y no antes** porque necesita las miles de fotos que las Fases 1 y 2 validaron a mano. Ese es el dataset de calibración y el benchmark. Sin eso, la IA se calibra con supuestos.

## Cómo debe funcionar

**Criterios en lenguaje natural.**
El admin escribe qué debe verificarse: "que el piso esté limpio, que haya papel higiénico y jabón, que no haya residuos". Texto libre que el modelo interpreta. **La instrucción de foto definida en Fase 1 es el punto de partida de esto.**

**Tres salidas, no un puntaje.**
- **Aprobada** con confianza alta → se cierra sola
- **Dudosa** → pasa al supervisor humano, con la observación de la IA como ayuda
- **Rechazada** con confianza alta → se pide nueva evidencia

**Nunca devolver un número tipo "6/10".** Un puntaje no le sirve a nadie: si sacó 6, ¿qué corrige? El asociado necesita saber *"falta jabón en el dispenser"*, no una nota. Además, un umbral fijo es arbitrario y no puede ser el mismo para "limpiar baño" que para "verificar extintores".

**Modo sombra primero — NO bloqueante.**
Arranca opinando y registrando su veredicto, pero la decisión sigue siendo humana. Cuando midamos que coincide con el supervisor en un porcentaje aceptable, recién ahí decide sola.

**Tope de reintentos.**
Si la IA rechaza **dos veces** la misma tarea, esta pasa automáticamente a revisión humana y **el asociado sigue trabajando**. La decisión se resuelve después. Nunca se lo deja parado esperando que una IA se convenza.

**Explicación siempre.**
La IA devuelve por qué aprobó o rechazó, en castellano, visible para asociado y supervisor. Sin eso no hay confianza ni forma de discutir un rechazo.

**Aprendizaje de correcciones.**
Cuando un supervisor revierte una decisión de la IA, se guarda. Con volumen, se ajustan los criterios de esa tarea específica.

**Detección de anomalías.**
Más allá de cumple/no cumple: **foto con hash idéntico a una anterior** (evidencia reutilizada), tarea completada sospechosamente rápido, GPS de la foto lejos del punto QR, patrón horario inusual.

**Entidades nuevas:** CriterioValidacion · ValidacionIA · CorreccionSupervisor

**Criterio de cierre:** la IA coincide con el supervisor humano en un porcentaje definido como aceptable, medido sobre datos reales de ese cliente.

---

# FASE 4 — INTELIGENCIA OPERATIVA

**Objetivo:** convertir el histórico en decisiones.

- **Dashboard que responde, no que muestra.** En vez de gráficos para interpretar: "3 sucursales tienen la apertura incompleta hoy", "control de stock se demora sistemáticamente los lunes", "turno noche cumple 30% menos que turno mañana"
- **Comparativas** entre sucursales, turnos, equipos, procedimientos y períodos
- **Cuellos de botella:** qué tareas se demoran siempre, dónde se acumulan incidencias, qué procedimientos nunca se completan enteros, **dónde se saltea el orden con más frecuencia**
- **Índice de cumplimiento** por sucursal/turno/equipo
- **Reportes exportables** a Excel y PDF, programables por email
- **Predicción de incumplimiento:** avisar que una sucursal va camino a no completar la apertura antes de que pase

**Criterio de cierre:** la gerencia toma decisiones mirando el sistema en vez de pedir un informe.

---

# FASE 5 — AUTOSERVICIO Y ENTERPRISE

**Objetivo:** escalar a muchos clientes sin horas de configuración manual por cada uno.

- **Constructor visual de procedimientos** (drag & drop). Recién acá, cuando ya sepamos qué configuran de verdad los clientes
- **Campos personalizados** por empresa
- **Roles y permisos granulares** configurables por el cliente
- **API pública** para integrar con otros sistemas
- **Multi-sede** con jerarquía y consolidación
- **Plantillas por rubro** precargadas (limpieza, gastronomía, seguridad, mantenimiento, logística)
- **Marca blanca** para clientes grandes

---

# RESTRICCIONES TÉCNICAS (todas las fases)

- Aislamiento multi-tenant en **absolutamente toda** query nueva
- Reutilizar puntos QR existentes. No crear sistema de QR paralelo
- Reutilizar la validación de distancia GPS ya implementada
- Respetar roles existentes: ADMIN configura, MANAGER supervisa, asociado ejecuta
- Toda aprobación o rechazo va al audit log existente
- Seguir convenciones de código, naming y estructura de carpetas del repo
- Terminología: **asociados**, **Supervisor**

---

# RIESGOS A TENER PRESENTES

**Costo de almacenamiento.** Crece lineal con clientes y no se nota hasta que duele. Por eso Fase 0.1.

**Fatiga de checklist.** Si un procedimiento tiene 40 tareas, el asociado tilda todo sin mirar y el dato se vuelve basura. Limitar cantidad de tareas por procedimiento y **medir tiempo de completado**: si alguien cierra 12 tareas en 40 segundos, algo está mal. Considerá agregar esa alerta.

**Resistencia del asociado.** Ver principio 5. Si es control unidireccional, la gente aprende a falsearlo.

**Conectividad.** Se subestima siempre. Por eso Fase 0.3.

**Dependencia de un solo cliente.** Si todo se diseña para la empresa actual, el segundo cliente va a necesitar la mitad distinto. Cada vez que agregues algo, preguntate si es específico o general.

---

# MÉTRICAS QUE HABILITAN PASAR DE FASE

| Fase | Métrica |
|---|---|
| 1 | % de tareas completadas con evidencia sobre generadas · % de tareas con orden salteado |
| 2 | Incidencias reportadas por semana · % de tareas con excepción justificada |
| 3 | % de coincidencia IA vs supervisor humano |
| 4 | Cantidad de decisiones de gestión que salen del dashboard |
| 5 | Tiempo de onboarding de un cliente nuevo sin intervención del desarrollador |

---

# ARRANCÁ ACÁ

1. Explorá el repo y contame cómo están implementados hoy: puntos QR, validación GPS, multi-tenant, roles, PWA de fichaje, jobs automáticos y audit log.
2. Dame tu recomendación para las decisiones de Fase 0, con trade-offs.
3. Esperá mi confirmación antes de escribir código.
