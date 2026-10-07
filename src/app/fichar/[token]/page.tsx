"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { MapPin, LogIn, LogOut, CheckCircle2, XCircle, Loader2, User, Coffee, ClipboardCheck, AlertCircle, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PuntoInfo {
  id: string
  nombre: string
  empresa_id: string
  operaciones_token: string
  descanso_activo: boolean
  descanso_inicio: string | null
  empresa: { nombre: string; logo_url: string | null; slug: string; modulo_operaciones: boolean; descanso_wa: boolean }
}

interface DescansoEstado {
  usado: boolean
  activo: boolean
  hora_inicio?: string
  hora_fin?: string
  duracion_min?: number
}

interface FichadaOk {
  tipo: "ENTRADA" | "SALIDA"
  hora: string
  analisis: string
  es_cobertura?: boolean
}

interface ColaboradorInfo {
  id: string
  nombre: string
  apellido: string
}

interface SupervisorInfo {
  id: string
  nombre: string
  tipo: "colaborador" | "usuario"
}

interface SupervisionOk {
  estado: "ok" | "novedad"
}

type Estado =
  | "cargando"
  | "token-invalido"
  | "pedir-ubicacion"
  | "obteniendo-gps"
  | "pedir-dni"
  | "eligiendo"
  | "fichando"
  | "confirmado"
  | "supervisando"
  | "supervision-confirmada"
  | "error-gps"
  | "gps-impreciso"
  | "gps-sin-permiso"
  | "error-generico"

const PRECISION_BUENA_M = 50
const PRECISION_ACEPTABLE_M = 150
const ESPERA_MAXIMA_GPS_MS = 25000

// Bot de WhatsApp como alternativa cuando la PWA no puede fichar
const WA_NUMERO = process.env.NEXT_PUBLIC_META_WA_NUMBER ?? ""

function FallbackWhatsApp({ qrToken }: { qrToken: string }) {
  const url = `https://api.whatsapp.com/send/?phone=${WA_NUMERO}&text=FICHAR%20${encodeURIComponent(qrToken)}&type=phone_number&app_absent=0`
  return (
    <div className="border-t border-gray-100 pt-4 space-y-2">
      <p className="text-sm font-semibold text-gray-700">¿No podés fichar? ¡Intentá por WhatsApp!</p>
      <a
        href={url}
        className="w-full h-12 bg-[#25D366] hover:bg-[#1ebe5d] active:bg-[#17a34a] text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 1 1 7.99 4.42zm8.02-17.45A11.3 11.3 0 0 0 12.04.75C5.8.75.72 5.83.72 12.07c0 2 .52 3.94 1.51 5.65L.62 23.25l5.66-1.48a11.3 11.3 0 0 0 5.76 1.47h.01c6.24 0 11.32-5.08 11.32-11.32 0-3.02-1.18-5.87-3.31-8z" />
        </svg>
        Fichar por WhatsApp
      </a>
    </div>
  )
}

const STORAGE_ID = "fichar_colaborador_id"
const STORAGE_NOMBRE = "fichar_colaborador_nombre"
const STORAGE_APELLIDO = "fichar_colaborador_apellido"

function comprimirImagen(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (ev) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width >= height) {
            height = Math.round((height * MAX) / width)
            width = MAX
          } else {
            width = Math.round((width * MAX) / height)
            height = MAX
          }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("canvas")); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.82))
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function FicharPage() {
  const { token } = useParams<{ token: string }>()

  const [estado, setEstado] = useState<Estado>("cargando")
  const [punto, setPunto] = useState<PuntoInfo | null>(null)
  const [colaborador, setColaborador] = useState<ColaboradorInfo | null>(null)
  const [nextTipo, setNextTipo] = useState<"ENTRADA" | "SALIDA" | null>(null)
  const [turnoAbiertoEn, setTurnoAbiertoEn] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsStatus, setGpsStatus] = useState("")
  const [dni, setDni] = useState("")
  const [dniError, setDniError] = useState("")
  const [fichada, setFichada] = useState<FichadaOk | null>(null)
  const [descanso, setDescanso] = useState<DescansoEstado | null>(null)
  const [supervisor, setSupervisor] = useState<SupervisorInfo | null>(null)
  const [supervisionOk, setSupervisionOk] = useState<SupervisionOk | null>(null)
  // Checklist supervisión
  const [svEstado, setSvEstado] = useState<"ok" | "novedad">("ok")
  const [svLimpieza, setSvLimpieza] = useState(false)
  const [svInsumos, setSvInsumos] = useState(false)
  const [svPersonal, setSvPersonal] = useState(false)
  const [svObservaciones, setSvObservaciones] = useState("")
  const [svGuardando, setSvGuardando] = useState(false)
  const [svError, setSvError] = useState("")
  const [svFotos, setSvFotos] = useState<string[]>([])
  const [accionandoDescanso, setAccionandoDescanso] = useState(false)
  const [errorGps, setErrorGps] = useState<{
    distancia: number
    radio: number
    punto_lat?: number
    punto_lon?: number
    usuario_lat?: number
    usuario_lon?: number
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [horaActual, setHoraActual] = useState("")

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const watchRef = useRef<number | null>(null)
  const bestAccuracyRef = useRef(Infinity)
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null)

  useEffect(() => {
    function tick() {
      setHoraActual(
        new Date().toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        })
      )
    }
    tick()
    timerRef.current = setInterval(tick, 10000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    return () => { detenerGPS() }
  }, [])

  useEffect(() => {
    if (!token) return
    fetch(`/api/fichar/qr/${token}`)
      .then((r) => r.json())
      .then((data: { punto?: PuntoInfo; error?: string }) => {
        if (!data.punto) { setEstado("token-invalido"); return }
        setPunto(data.punto)
        const savedId = localStorage.getItem(STORAGE_ID)
        const savedNombre = localStorage.getItem(STORAGE_NOMBRE)
        const savedApellido = localStorage.getItem(STORAGE_APELLIDO)
        if (savedId && savedNombre) {
          setColaborador({ id: savedId, nombre: savedNombre, apellido: savedApellido ?? "" })
        }
        setEstado("pedir-ubicacion")
      })
      .catch(() => setEstado("token-invalido"))
  }, [token])

  function detenerGPS() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }

  function pedirUbicacion(hasColaborador: boolean) {
    if (!navigator.geolocation) {
      setErrorMsg("Tu navegador no soporta GPS.")
      setEstado("error-generico")
      return
    }
    setEstado("obteniendo-gps")
    setGpsStatus("Buscando señal GPS...")
    detenerGPS()
    bestAccuracyRef.current = Infinity
    coordsRef.current = null

    let proceeded = false
    let softTimeout: ReturnType<typeof setTimeout> | null = null
    let esperaCumplida = false

    // Sin fix bueno no se valida: una lectura por antenas/wifi (±1–2 km) rechazaría a alguien que está en la puerta
    const hardTimeout = setTimeout(() => {
      if (proceeded) return
      if (softTimeout) clearTimeout(softTimeout)
      if (coordsRef.current && bestAccuracyRef.current <= PRECISION_ACEPTABLE_M) {
        proceed()
        return
      }
      proceeded = true
      detenerGPS()
      if (coordsRef.current) {
        setEstado("gps-impreciso")
      } else {
        setErrorMsg("No pudimos obtener tu ubicación. Si estás adentro, acercate a una ventana o salí a la vereda e intentá de nuevo.")
        setEstado("error-generico")
      }
    }, ESPERA_MAXIMA_GPS_MS)

    // Una vez que tenemos coords aceptables, validar en el servidor si hay colaborador guardado
    const validarYAvanzar = async (c: { lat: number; lon: number }) => {
      if (!hasColaborador) {
        setEstado("pedir-dni")
        return
      }

      // Para colaboradores guardados: validar GPS contra el servidor ANTES de mostrar eligiendo
      setGpsStatus("Verificando ubicación en el servidor...")
      try {
        const storedId = localStorage.getItem(STORAGE_ID)
        const res = await fetch("/api/fichar/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qr_token: token,
            colaborador_id: storedId,
            latitud: c.lat,
            longitud: c.lon,
            solo_identificar: true,
          }),
        })
        const data = await res.json() as {
          ok?: boolean
          distancia?: number
          radio?: number
          punto_lat?: number
          punto_lon?: number
          usuario_lat?: number
          usuario_lon?: number
          error?: string
          next_tipo?: "ENTRADA" | "SALIDA" | null
          turno_abierto_en?: string | null
          es_supervisor?: boolean
          supervisor_id?: string
          supervisor_nombre?: string
          supervisor_tipo?: "colaborador" | "usuario"
        }

        if (res.status === 400 && data.distancia != null) {
          detenerGPS()
          setErrorGps({ distancia: data.distancia, radio: data.radio!, punto_lat: data.punto_lat, punto_lon: data.punto_lon, usuario_lat: data.usuario_lat, usuario_lon: data.usuario_lon })
          setEstado("error-gps")
          return
        }
        if (res.status === 404) {
          // Colaborador guardado ya no existe o está inactivo → pedir DNI de nuevo
          detenerGPS()
          localStorage.removeItem(STORAGE_ID)
          localStorage.removeItem(STORAGE_NOMBRE)
          localStorage.removeItem(STORAGE_APELLIDO)
          setColaborador(null)
          setEstado("pedir-dni")
          return
        }
        // Colaborador guardado que además es supervisor → ronda de supervisión, nunca fichaje
        if (data.ok && data.es_supervisor && data.supervisor_id) {
          detenerGPS()
          localStorage.removeItem(STORAGE_ID)
          localStorage.removeItem(STORAGE_NOMBRE)
          localStorage.removeItem(STORAGE_APELLIDO)
          setColaborador(null)
          setSupervisor({ id: data.supervisor_id, nombre: data.supervisor_nombre ?? "", tipo: data.supervisor_tipo ?? "colaborador" })
          setEstado("supervisando")
          return
        }
        if (!data.ok) {
          detenerGPS()
          setErrorMsg(data.error ?? "No pudimos verificar tu ubicación")
          setEstado("error-generico")
          return
        }
        setNextTipo(data.next_tipo ?? null)
        setTurnoAbiertoEn(data.turno_abierto_en ?? null)
        setEstado("eligiendo")
        // Cargar estado de descanso si ya tiene entrada (nextTipo es SALIDA o null)
        if (data.next_tipo === "SALIDA" || data.next_tipo === null) {
          void cargarDescanso(storedId!, punto!.empresa_id)
        }
      } catch {
        detenerGPS()
        setErrorMsg("Error de red al verificar ubicación. Intentá de nuevo.")
        setEstado("error-generico")
      }
    }

    function proceed() {
      if (proceeded) return
      proceeded = true
      clearTimeout(hardTimeout)
      if (softTimeout) clearTimeout(softTimeout)
      void validarYAvanzar(coordsRef.current!)
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords

        if (accuracy < bestAccuracyRef.current) {
          bestAccuracyRef.current = accuracy
          const newCoords = { lat, lon }
          setCoords(newCoords)
          coordsRef.current = newCoords
          setGpsAccuracy(Math.round(accuracy))
          setGpsStatus(`GPS: precisión ±${Math.round(accuracy)}m`)
        }

        if (proceeded) return

        if (accuracy <= PRECISION_BUENA_M) {
          proceed()
        } else if (esperaCumplida && bestAccuracyRef.current <= PRECISION_ACEPTABLE_M) {
          proceed()
        } else if (!softTimeout) {
          // Primera lectura recibida: esperar unos segundos por si mejora
          softTimeout = setTimeout(() => {
            esperaCumplida = true
            if (bestAccuracyRef.current <= PRECISION_ACEPTABLE_M) {
              proceed()
            } else {
              setGpsStatus("Señal GPS débil, buscando una ubicación más precisa...")
            }
          }, 5000)
        }
      },
      (err) => {
        // Una vez validada la ubicación, un error posterior del seguimiento no debe sacarla de la pantalla
        if (proceeded) return
        // iOS manda "posición no disponible" pasajero mientras busca señal: se sigue esperando hasta el timeout
        if (err.code !== err.PERMISSION_DENIED) {
          setGpsStatus("Buscando señal GPS...")
          return
        }
        proceeded = true
        clearTimeout(hardTimeout)
        if (softTimeout) clearTimeout(softTimeout)
        detenerGPS()
        setEstado("gps-sin-permiso")
      },
      // maximumAge: 0 — NUNCA usar posición cacheada, siempre fresca del satélite
      { enableHighAccuracy: true, maximumAge: 0, timeout: ESPERA_MAXIMA_GPS_MS + 5000 }
    )
  }

  async function buscarPorDni() {
    const dniLimpio = dni.replace(/\./g, "").trim()
    if (!dniLimpio || isNaN(Number(dniLimpio))) {
      setDniError("Ingresá solo números")
      return
    }
    setDniError("")

    const c = coordsRef.current
    if (!c) {
      setDniError("Perdimos la señal GPS. Volvé a intentar desde el inicio.")
      return
    }

    const res = await fetch("/api/fichar/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qr_token: token,
        dni: dniLimpio,
        latitud: c.lat,
        longitud: c.lon,
        solo_identificar: true,
      }),
    })
    const data = await res.json() as {
      ok?: boolean
      error?: string
      distancia?: number
      radio?: number
      punto_lat?: number
      punto_lon?: number
      usuario_lat?: number
      usuario_lon?: number
      colaborador?: ColaboradorInfo
      next_tipo?: "ENTRADA" | "SALIDA" | null
      turno_abierto_en?: string | null
      es_supervisor?: boolean
      supervisor_id?: string
      supervisor_nombre?: string
      supervisor_tipo?: "colaborador" | "usuario"
    }

    if (res.status === 400 && data.distancia != null) {
      detenerGPS()
      setErrorGps({ distancia: data.distancia, radio: data.radio!, punto_lat: data.punto_lat, punto_lon: data.punto_lon, usuario_lat: data.usuario_lat, usuario_lon: data.usuario_lon })
      setEstado("error-gps")
      return
    }
    if (res.status === 404) {
      setDniError("DNI no encontrado en el sistema")
      return
    }
    // Supervisor identificado → ir directo al formulario de supervisión
    if (data.ok && data.es_supervisor && data.supervisor_id) {
      detenerGPS()
      setSupervisor({ id: data.supervisor_id, nombre: data.supervisor_nombre ?? "", tipo: data.supervisor_tipo ?? "colaborador" })
      setEstado("supervisando")
      return
    }
    if (data.ok && data.colaborador) {
      localStorage.setItem(STORAGE_ID, data.colaborador.id)
      localStorage.setItem(STORAGE_NOMBRE, data.colaborador.nombre)
      localStorage.setItem(STORAGE_APELLIDO, data.colaborador.apellido)
      setColaborador(data.colaborador)
      setNextTipo(data.next_tipo ?? null)
      setTurnoAbiertoEn(data.turno_abierto_en ?? null)
      setEstado("eligiendo")
      if (data.next_tipo === "SALIDA" || data.next_tipo === null) {
        void cargarDescanso(data.colaborador.id, punto!.empresa_id)
      }
    }
  }

  async function guardarSupervision() {
    if (!supervisor || !punto) return
    setSvGuardando(true)
    setSvError("")
    try {
      const res = await fetch("/api/supervisiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_token: token,
          ...(supervisor.tipo === "colaborador"
            ? { colaborador_id: supervisor.id }
            : { supervisor_id: supervisor.id }),
          estado: svEstado,
          checklist_json: { limpieza: svLimpieza, insumos: svInsumos, personal: svPersonal },
          observaciones: svObservaciones || undefined,
          ...(svFotos.length > 0 ? { fotos: svFotos } : {}),
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setSvGuardando(false)
        setSvError(data.error ?? "No se pudo guardar la supervisión")
        return
      }
      setSupervisionOk({ estado: svEstado })
      setEstado("supervision-confirmada")
    } catch {
      setSvGuardando(false)
      setSvError("Error de red al guardar la supervisión")
    }
  }

  async function agregarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (svFotos.length >= 3) { setSvError("Máximo 3 fotos por ronda"); return }
    try {
      const dataUrl = await comprimirImagen(file)
      setSvFotos(prev => [...prev, dataUrl])
      setSvError("")
    } catch {
      setSvError("No se pudo procesar la foto")
    }
  }

  async function registrarFichada(tipo: "ENTRADA" | "SALIDA") {
    detenerGPS()
    setEstado("fichando")

    const c = coordsRef.current
    if (!c) {
      setErrorMsg("Perdimos la señal GPS. Escaneá el QR de nuevo.")
      setEstado("error-generico")
      return
    }

    const res = await fetch("/api/fichar/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qr_token: token,
        colaborador_id: colaborador!.id,
        tipo,
        latitud: c.lat,
        longitud: c.lon,
      }),
    })
    const data = await res.json() as {
      ok?: boolean
      error?: string
      distancia?: number
      radio?: number
      punto_lat?: number
      punto_lon?: number
      usuario_lat?: number
      usuario_lon?: number
      fichada?: FichadaOk
      colaborador?: ColaboradorInfo
    }

    if (res.status === 400 && data.distancia != null) {
      setErrorGps({ distancia: data.distancia, radio: data.radio!, punto_lat: data.punto_lat, punto_lon: data.punto_lon, usuario_lat: data.usuario_lat, usuario_lon: data.usuario_lon  })
      setEstado("error-gps")
      return
    }
    if (!data.ok) {
      // Si el error es que ya fichó hoy, mostrar "Jornada completa" en vez de error genérico
      if (data.error?.includes("Ya registraste")) {
        setNextTipo(null)
        setEstado("eligiendo")
        return
      }
      setErrorMsg(data.error ?? "Error al registrar la fichada")
      setEstado("error-generico")
      return
    }
    if (data.colaborador) setColaborador(data.colaborador)
    setFichada(data.fichada!)
    setEstado("confirmado")
    // Si registró entrada, cargar estado de descanso (debería ser vacío, pero listo para mostrar botón)
    if (tipo === "ENTRADA" && colaborador && punto) {
      void cargarDescanso(colaborador.id, punto.empresa_id)
    }
  }

  function reintentar() {
    detenerGPS()
    setCoords(null)
    coordsRef.current = null
    setGpsAccuracy(null)
    bestAccuracyRef.current = Infinity
    setErrorGps(null)
    setEstado("pedir-ubicacion")
  }

  async function cargarDescanso(colabId: string, empresaId: string) {
    try {
      const res = await fetch(`/api/descansos/qr?colaborador_id=${colabId}&empresa_id=${empresaId}`)
      if (res.ok) setDescanso(await res.json() as DescansoEstado)
    } catch { /* silencioso */ }
  }

  async function tomarDescanso() {
    if (!colaborador || !punto) return
    setAccionandoDescanso(true)
    try {
      const res = await fetch("/api/descansos/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colaborador_id: colaborador.id, empresa_id: punto.empresa_id }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; hora?: string }
      if (res.ok && data.ok) {
        await cargarDescanso(colaborador.id, punto.empresa_id)
      }
    } finally {
      setAccionandoDescanso(false)
    }
  }

  async function terminarDescanso() {
    if (!colaborador || !punto) return
    setAccionandoDescanso(true)
    try {
      const res = await fetch("/api/descansos/activo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colaborador_id: colaborador.id, empresa_id: punto.empresa_id }),
      })
      if (res.ok) {
        await cargarDescanso(colaborador.id, punto.empresa_id)
      }
    } finally {
      setAccionandoDescanso(false)
    }
  }

  function olvidarIdentidad() {
    detenerGPS()
    localStorage.removeItem(STORAGE_ID)
    localStorage.removeItem(STORAGE_NOMBRE)
    localStorage.removeItem(STORAGE_APELLIDO)
    setColaborador(null)
    setCoords(null)
    coordsRef.current = null
    setGpsAccuracy(null)
    bestAccuracyRef.current = Infinity
    setEstado("pedir-ubicacion")
  }

  const fechaHoy = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  })

  const mostrarFallbackWa = Boolean(WA_NUMERO) && !!punto
  // Solo se usa en pantallas que no se renderizan en el servidor (estado inicial "cargando")
  const esIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)

  const gpsLabel =
    gpsAccuracy === null ? null
    : gpsAccuracy <= 25 ? { text: `GPS preciso ±${gpsAccuracy}m`, color: "text-green-600" }
    : gpsAccuracy <= 80 ? { text: `GPS aceptable ±${gpsAccuracy}m`, color: "text-amber-600" }
    : { text: `GPS impreciso ±${gpsAccuracy}m`, color: "text-red-500" }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">

      <div style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
        className="px-6 pt-10 pb-8 text-white text-center">
        <div className="mb-1">
          <span className="text-2xl font-black tracking-tighter">JORNADA</span>
          <span className="text-2xl font-black tracking-tighter text-blue-200">.OH</span>
        </div>
        {punto && (
          <>
            <p className="text-lg font-semibold mt-2">{punto.nombre}</p>
            <p className="text-blue-200 text-sm mt-0.5">{punto.empresa.nombre}</p>
          </>
        )}
        <p className="text-blue-100 text-xs mt-2 capitalize">{fechaHoy} · {horaActual}</p>
      </div>

      {punto?.descanso_activo && (
        <div className="bg-amber-500 text-white px-5 py-3 flex items-center justify-center gap-2">
          <Coffee size={16} />
          <span className="text-sm font-semibold">
            Descanso grupal en curso
            {punto.descanso_inicio && (
              <> · desde {new Date(punto.descanso_inicio).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}</>
            )}
          </span>
        </div>
      )}

      <div className="flex-1 flex items-start justify-center px-5 py-8">
        <div className="w-full max-w-sm space-y-4">

          {/* ── CARGANDO / OBTENIENDO GPS ── */}
          {(estado === "cargando" || estado === "obteniendo-gps") && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
              <Loader2 size={36} className="text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">
                {estado === "cargando" ? "Verificando punto..." : gpsStatus || "Obteniendo GPS..."}
              </p>
              {estado === "obteniendo-gps" && gpsAccuracy !== null && (
                <p className={`text-sm mt-2 font-medium ${gpsLabel?.color ?? "text-gray-400"}`}>
                  Precisión: ±{gpsAccuracy}m — mejorando...
                </p>
              )}
            </div>
          )}

          {/* ── TOKEN INVÁLIDO ── */}
          {estado === "token-invalido" && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-10 text-center">
              <XCircle size={44} className="text-red-400 mx-auto mb-4" />
              <p className="text-gray-800 font-semibold text-lg">Código QR inválido</p>
              <p className="text-gray-400 text-sm mt-2">Este código no existe o fue desactivado.</p>
            </div>
          )}

          {/* ── PEDIR UBICACIÓN ── */}
          {estado === "pedir-ubicacion" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                <MapPin size={28} className="text-blue-600" />
              </div>
              <div>
                <p className="text-gray-800 font-semibold text-lg">
                  {colaborador ? `Hola, ${colaborador.nombre} 👋` : "Para fichar necesitamos tu ubicación"}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Verificamos que estés físicamente en el trabajo
                </p>
              </div>
              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                onClick={() => pedirUbicacion(!!colaborador)}
              >
                <MapPin size={18} className="mr-2" />
                Verificar ubicación
              </Button>
              {colaborador && (
                <button
                  onClick={olvidarIdentidad}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  No soy {colaborador.nombre} {colaborador.apellido}
                </button>
              )}
              <p className="text-xs text-gray-400">
                Tu ubicación GPS se compara con la del punto de fichaje. No se guarda.
              </p>
            </div>
          )}

          {/* ── PEDIR DNI ── */}
          {estado === "pedir-dni" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <User size={28} className="text-blue-600" />
                </div>
                <p className="text-gray-800 font-semibold text-lg">¿Quién sos?</p>
                <p className="text-gray-400 text-sm mt-1">Ingresá tu DNI para identificarte</p>
              </div>
              {gpsLabel && (
                <p className={`text-xs text-center font-medium ${gpsLabel.color}`}>
                  {gpsLabel.text}
                </p>
              )}
              <div className="space-y-2">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="DNI sin puntos"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void buscarPorDni()}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
                {dniError && <p className="text-red-500 text-sm">{dniError}</p>}
              </div>
              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                onClick={() => void buscarPorDni()}
                disabled={!dni}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* ── ELIGIENDO ENTRADA/SALIDA ── */}
          {estado === "eligiendo" && colaborador && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-3">
                  <MapPin size={20} className="text-green-600" />
                </div>
                <p className="text-green-700 text-sm font-medium">Ubicación confirmada ✓</p>
                <p className="text-gray-800 font-semibold mt-1">
                  {colaborador.apellido} {colaborador.nombre}
                </p>
                {gpsLabel && (
                  <p className={`text-xs mt-1 ${gpsLabel.color}`}>{gpsLabel.text}</p>
                )}
              </div>

              {nextTipo === null ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-2">
                  <CheckCircle2 size={44} className="text-green-400 mx-auto" />
                  <p className="text-gray-800 font-semibold text-lg">Jornada completa</p>
                  <p className="text-gray-400 text-sm">Ya completaste todos tus turnos de hoy.</p>
                </div>
              ) : nextTipo === "ENTRADA" ? (
                <button
                  onClick={() => void registrarFichada("ENTRADA")}
                  className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-2xl p-8 flex flex-col items-center gap-2 transition-colors shadow-sm"
                >
                  <LogIn size={40} />
                  <span className="font-bold text-2xl">Registrar Entrada</span>
                  {turnoAbiertoEn && (
                    <span className="text-green-100 text-xs text-center">
                      Tu entrada en {turnoAbiertoEn} quedó sin salida: se cierra automáticamente
                    </span>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => void registrarFichada("SALIDA")}
                    className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-2xl p-6 flex flex-col items-center gap-2 transition-colors shadow-sm"
                  >
                    <LogOut size={36} />
                    <span className="font-bold text-xl">Registrar Salida</span>
                  </button>

                  {/* Botones de descanso — solo si la empresa lo tiene habilitado */}
                  {(punto?.empresa.descanso_wa ?? true) && (
                    descanso?.activo ? (
                      <button
                        onClick={() => void terminarDescanso()}
                        disabled={accionandoDescanso}
                        className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 text-white rounded-2xl p-5 flex flex-col items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Coffee size={28} />
                        <span className="font-bold text-lg">Terminar descanso</span>
                        {descanso.hora_inicio && (
                          <span className="text-amber-100 text-xs">Desde las {descanso.hora_inicio}</span>
                        )}
                      </button>
                    ) : !descanso?.usado ? (
                      <button
                        onClick={() => void tomarDescanso()}
                        disabled={accionandoDescanso}
                        className="w-full bg-amber-400 hover:bg-amber-500 active:bg-amber-600 disabled:opacity-60 text-white rounded-2xl p-5 flex flex-col items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Coffee size={28} />
                        <span className="font-bold text-lg">Tomar descanso</span>
                        <span className="text-amber-100 text-xs">30 minutos · 1 vez por jornada</span>
                      </button>
                    ) : descanso?.hora_inicio && descanso.hora_fin ? (
                      <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
                        <Coffee size={20} className="text-gray-400 mx-auto mb-1" />
                        <p className="text-gray-500 text-sm font-medium">Descanso tomado hoy</p>
                        <p className="text-gray-400 text-xs">{descanso.hora_inicio} → {descanso.hora_fin} · {descanso.duracion_min} min</p>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              <button
                onClick={olvidarIdentidad}
                className="w-full text-xs text-gray-400 hover:text-gray-600 underline text-center"
              >
                No soy {colaborador.nombre} {colaborador.apellido}
              </button>
            </div>
          )}

          {/* ── FICHANDO ── */}
          {estado === "fichando" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
              <Loader2 size={36} className="text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Registrando fichada...</p>
            </div>
          )}

          {/* ── CONFIRMADO ── */}
          {estado === "confirmado" && fichada && colaborador && (
            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-10 text-center space-y-3">
              <CheckCircle2 size={56} className="text-green-500 mx-auto" />
              <div>
                <p className="text-gray-800 font-bold text-xl">
                  {fichada.tipo === "ENTRADA" ? "Entrada registrada" : "Salida registrada"}
                </p>
                <p className="text-4xl font-black text-gray-900 mt-2">{fichada.hora}</p>
              </div>
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <p className="text-gray-600 font-medium">
                  {colaborador.apellido} {colaborador.nombre}
                </p>
                <p className="text-gray-400 text-sm">{punto?.nombre}</p>
              </div>
              {fichada.es_cobertura && (
                <div className="bg-purple-50 rounded-xl px-4 py-2.5 text-purple-700 text-sm font-medium">
                  🔄 Registrada como cobertura / reemplazo
                </div>
              )}
              {fichada.analisis === "LLEGADA_TARDE" && (
                <div className="bg-amber-50 rounded-xl px-4 py-2.5 text-amber-700 text-sm font-medium">
                  ⏰ Llegada tarde
                </div>
              )}
              {fichada.analisis === "SALIDA_ANTICIPADA" && (
                <div className="bg-amber-50 rounded-xl px-4 py-2.5 text-amber-700 text-sm font-medium">
                  ⚠️ Salida anticipada
                </div>
              )}
              {/* Botón de descanso tras entrada exitosa */}
              {fichada.tipo === "ENTRADA" && !descanso?.usado && (
                <button
                  onClick={() => void tomarDescanso()}
                  disabled={accionandoDescanso}
                  className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Coffee size={18} />
                  <span className="text-sm font-medium">
                    {descanso?.activo ? "En descanso..." : "Tomar descanso (30 min)"}
                  </span>
                </button>
              )}
              {descanso?.activo && fichada.tipo === "ENTRADA" && (
                <button
                  onClick={() => void terminarDescanso()}
                  disabled={accionandoDescanso}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Coffee size={18} />
                  <span className="text-sm font-medium">Terminar descanso</span>
                </button>
              )}
              {fichada.tipo === "ENTRADA" && punto?.empresa.modulo_operaciones && punto.operaciones_token && (
                <a
                  href={`/op/${punto.operaciones_token}`}
                  className="block w-full bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 rounded-xl py-3 text-center text-sm font-medium transition-colors"
                >
                  Ver tareas del día →
                </a>
              )}
              <p className="text-gray-400 text-sm pt-2">Podés cerrar esta página</p>
              <button
                onClick={reintentar}
                className="text-xs text-gray-400 hover:text-gray-600 underline pt-1"
              >
                Volver al inicio
              </button>
            </div>
          )}

          {/* ── SUPERVISANDO ── */}
          {estado === "supervisando" && supervisor && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                  <ClipboardCheck size={26} className="text-indigo-600" />
                </div>
                <p className="text-gray-800 font-semibold text-lg">Ronda de Supervisión</p>
                <p className="text-gray-400 text-sm mt-0.5">{supervisor.nombre} · {punto?.nombre}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">ESTADO DEL SERVICIO</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSvEstado("ok")}
                    className={`rounded-xl py-3 font-semibold text-sm border-2 transition-colors ${svEstado === "ok" ? "bg-green-500 text-white border-green-500" : "border-gray-200 text-gray-600 hover:border-green-300"}`}
                  >
                    ✓ En condiciones
                  </button>
                  <button
                    onClick={() => setSvEstado("novedad")}
                    className={`rounded-xl py-3 font-semibold text-sm border-2 transition-colors ${svEstado === "novedad" ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-600 hover:border-amber-300"}`}
                  >
                    ⚠️ Con novedades
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">CHECKLIST RÁPIDO</p>
                <div className="space-y-2">
                  {[
                    { key: "limpieza" as const, val: svLimpieza, set: setSvLimpieza, label: "Rutina de limpieza completada" },
                    { key: "insumos"  as const, val: svInsumos,  set: setSvInsumos,  label: "Materiales e insumos suficientes" },
                    { key: "personal" as const, val: svPersonal, set: setSvPersonal, label: "Personal presente conforme dotación" },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={e => item.set(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">OBSERVACIONES <span className="font-normal text-gray-400">(opcional)</span></p>
                <textarea
                  value={svObservaciones}
                  onChange={e => setSvObservaciones(e.target.value)}
                  placeholder="Detallá faltantes, novedades o comentarios..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  FOTOS <span className="font-normal text-gray-400">(opcional, máx. 3)</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {svFotos.map((f, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setSvFotos(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                        aria-label="Quitar foto"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  ))}
                  {svFotos.length < 3 && (
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                      <Camera size={20} />
                      <span className="text-[10px] font-medium">Agregar</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => void agregarFoto(e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {svError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                  {svError}
                </p>
              )}

              <Button
                onClick={() => void guardarSupervision()}
                disabled={svGuardando}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
              >
                {svGuardando ? <Loader2 size={18} className="animate-spin mr-2" /> : <ClipboardCheck size={18} className="mr-2" />}
                Registrar supervisión
              </Button>
            </div>
          )}

          {/* ── SUPERVISIÓN CONFIRMADA ── */}
          {estado === "supervision-confirmada" && supervisionOk && supervisor && (
            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-10 text-center space-y-3">
              <CheckCircle2 size={56} className="mx-auto text-green-500" />
              <div>
                <p className="text-gray-800 font-bold text-xl">Supervisión registrada</p>
                <p className="text-gray-400 text-sm mt-1">{punto?.nombre}</p>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${supervisionOk.estado === "ok" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                {supervisionOk.estado === "ok" ? "✓ En condiciones" : "⚠️ Con novedades"}
              </div>
              <p className="text-gray-500 text-sm pt-1">{supervisor.nombre}</p>
              <p className="text-gray-400 text-sm">Podés cerrar esta página</p>
            </div>
          )}

          {/* ── SIN PERMISO DE UBICACIÓN: el celular se la niega al navegador ── */}
          {estado === "gps-sin-permiso" && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-8 text-center space-y-4">
              <MapPin size={44} className="text-amber-500 mx-auto" />
              <div>
                <p className="text-gray-800 font-semibold text-lg">Falta permitir la ubicación</p>
                <p className="text-gray-500 text-sm mt-2">
                  Aunque tengas la ubicación prendida, el navegador necesita permiso para usarla en esta página.
                </p>
              </div>
              {esIOS ? (
                <ol className="text-left text-sm text-gray-700 space-y-2 bg-amber-50 rounded-xl p-4 list-decimal list-inside">
                  <li>Abrí <strong>Ajustes</strong> → <strong>Privacidad y seguridad</strong> → <strong>Localización</strong>.</li>
                  <li>Verificá que <strong>Localización</strong> esté activada.</li>
                  <li>Entrá a <strong>Sitios web de Safari</strong> y elegí <strong>“Al usar la app”</strong>. Activá <strong>“Ubicación exacta”</strong>.</li>
                  <li>Volvé acá y tocá <strong>Reintentar</strong>. Si te pregunta, tocá <strong>Permitir</strong>.</li>
                </ol>
              ) : (
                <ol className="text-left text-sm text-gray-700 space-y-2 bg-amber-50 rounded-xl p-4 list-decimal list-inside">
                  <li>Tocá el <strong>candado</strong> (o los ajustes) al lado de la dirección, arriba.</li>
                  <li>Entrá a <strong>Permisos</strong> → <strong>Ubicación</strong> y elegí <strong>Permitir</strong>.</li>
                  <li>Volvé acá y tocá <strong>Reintentar</strong>.</li>
                </ol>
              )}
              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                onClick={reintentar}
              >
                Reintentar
              </Button>
              {mostrarFallbackWa && <FallbackWhatsApp qrToken={token} />}
            </div>
          )}

          {/* ── GPS IMPRECISO: no se puede decidir si está o no en el lugar ── */}
          {(estado === "gps-impreciso" || (estado === "error-gps" && (gpsAccuracy ?? 0) > PRECISION_ACEPTABLE_M)) && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-8 text-center space-y-4">
              <MapPin size={44} className="text-amber-500 mx-auto" />
              <div>
                <p className="text-gray-800 font-semibold text-lg">Tu GPS no está preciso</p>
                {gpsAccuracy !== null && (
                  <p className="text-amber-600 text-sm font-medium mt-1">
                    Margen de error: ±{gpsAccuracy >= 1000 ? `${(gpsAccuracy / 1000).toFixed(1)} km` : `${gpsAccuracy} m`}
                  </p>
                )}
                <p className="text-gray-500 text-sm mt-2">
                  Así no podemos confirmar que estés en el lugar. Probá esto y reintentá:
                </p>
              </div>
              <ol className="text-left text-sm text-gray-700 space-y-2 bg-amber-50 rounded-xl p-4 list-decimal list-inside">
                <li>Activá la <strong>Ubicación</strong> del celular y la opción <strong>“Ubicación precisa”</strong>.</li>
                <li>Si estás adentro, acercate a una ventana o salí a la vereda.</li>
                <li>Esperá unos segundos con la pantalla prendida y tocá <strong>Reintentar</strong>.</li>
              </ol>
              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                onClick={reintentar}
              >
                Reintentar
              </Button>
              {mostrarFallbackWa && <FallbackWhatsApp qrToken={token} />}
            </div>
          )}

          {/* ── ERROR GPS LEJOS ── */}
          {estado === "error-gps" && errorGps && (gpsAccuracy ?? 0) <= PRECISION_ACEPTABLE_M && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
              <XCircle size={48} className="text-red-400 mx-auto" />
              <div>
                <p className="text-gray-800 font-semibold text-lg">No estás en el lugar de trabajo</p>
                <p className="text-4xl font-black text-red-500 mt-3">
                  {errorGps.distancia >= 1000
                    ? `${(errorGps.distancia / 1000).toFixed(2)} km`
                    : `${errorGps.distancia} m`}
                </p>
                <p className="text-gray-500 text-sm mt-1">de distancia al punto de fichaje</p>
                <p className="text-gray-300 text-xs">Radio permitido: {errorGps.radio}m</p>
                {gpsAccuracy !== null && (
                  <p className="text-gray-300 text-xs">Precisión GPS: ±{gpsAccuracy}m</p>
                )}
              </div>

              {/* Links para verificar ubicaciones */}
              {errorGps.punto_lat && errorGps.usuario_lat && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-left">
                  <p className="text-xs text-gray-500 font-medium text-center">Verificar ubicaciones</p>
                  <a
                    href={`https://www.google.com/maps?q=${errorGps.punto_lat},${errorGps.punto_lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <MapPin size={14} className="shrink-0" />
                    Ver dónde está registrado el punto
                  </a>
                  <a
                    href={`https://www.google.com/maps?q=${errorGps.usuario_lat},${errorGps.usuario_lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <MapPin size={14} className="shrink-0" />
                    Ver dónde me detectó el GPS
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/${errorGps.usuario_lat},${errorGps.usuario_lon}/${errorGps.punto_lat},${errorGps.punto_lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <MapPin size={14} className="shrink-0" />
                    Ver ruta yo → punto
                  </a>
                </div>
              )}

              <Button
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                onClick={reintentar}
              >
                Reintentar
              </Button>
              {mostrarFallbackWa && <FallbackWhatsApp qrToken={token} />}
            </div>
          )}

          {/* ── ERROR GENÉRICO ── */}
          {estado === "error-generico" && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
              <XCircle size={48} className="text-red-400 mx-auto" />
              <p className="text-gray-800 font-semibold">{errorMsg || "Ocurrió un error"}</p>
              <Button variant="outline" className="w-full h-12 rounded-xl" onClick={reintentar}>
                Reintentar
              </Button>
              {mostrarFallbackWa && <FallbackWhatsApp qrToken={token} />}
            </div>
          )}

        </div>
      </div>

      <p className="text-center text-xs text-gray-300 pb-6">
        Powered by <span className="font-semibold">FMCODE</span>
      </p>
    </div>
  )
}
