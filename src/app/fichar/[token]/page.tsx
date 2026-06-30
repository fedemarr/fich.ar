"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { MapPin, LogIn, LogOut, CheckCircle2, XCircle, Loader2, User } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PuntoInfo {
  id: string
  nombre: string
  empresa: { nombre: string; logo_url: string | null; slug: string }
}

interface FichadaOk {
  tipo: "ENTRADA" | "SALIDA"
  hora: string
  analisis: string
}

interface ColaboradorInfo {
  id: string
  nombre: string
  apellido: string
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
  | "error-gps"
  | "error-generico"

const STORAGE_ID = "fichar_colaborador_id"
const STORAGE_NOMBRE = "fichar_colaborador_nombre"
const STORAGE_APELLIDO = "fichar_colaborador_apellido"

export default function FicharPage() {
  const { token } = useParams<{ token: string }>()

  const [estado, setEstado] = useState<Estado>("cargando")
  const [punto, setPunto] = useState<PuntoInfo | null>(null)
  const [colaborador, setColaborador] = useState<ColaboradorInfo | null>(null)
  const [nextTipo, setNextTipo] = useState<"ENTRADA" | "SALIDA" | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsStatus, setGpsStatus] = useState("")
  const [dni, setDni] = useState("")
  const [dniError, setDniError] = useState("")
  const [fichada, setFichada] = useState<FichadaOk | null>(null)
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

    const hardTimeout = setTimeout(() => {
      if (proceeded) return
      proceeded = true
      if (softTimeout) clearTimeout(softTimeout)
      detenerGPS()
      setErrorMsg("No pudimos obtener tu ubicación. Habilitá el GPS e intentá de nuevo.")
      setEstado("error-generico")
    }, 15000)

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
        }

        if (res.status === 400 && data.distancia != null) {
          detenerGPS()
          setErrorGps({ distancia: data.distancia, radio: data.radio!, punto_lat: data.punto_lat, punto_lon: data.punto_lon, usuario_lat: data.usuario_lat, usuario_lon: data.usuario_lon })
          setEstado("error-gps")
          return
        }
        if (!data.ok) {
          detenerGPS()
          setErrorMsg(data.error ?? "No pudimos verificar tu ubicación")
          setEstado("error-generico")
          return
        }
        setNextTipo(data.next_tipo ?? null)
        setEstado("eligiendo")
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

        if (accuracy <= 25) {
          proceed()
        } else if (!softTimeout) {
          // Primera lectura recibida: esperar hasta 5s por si mejora
          softTimeout = setTimeout(proceed, 5000)
        }
      },
      () => {
        clearTimeout(hardTimeout)
        if (softTimeout) clearTimeout(softTimeout)
        detenerGPS()
        setErrorMsg("No pudimos obtener tu ubicación. Habilitá el GPS e intentá de nuevo.")
        setEstado("error-generico")
      },
      // maximumAge: 0 — NUNCA usar posición cacheada, siempre fresca del satélite
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
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
    if (data.ok && data.colaborador) {
      localStorage.setItem(STORAGE_ID, data.colaborador.id)
      localStorage.setItem(STORAGE_NOMBRE, data.colaborador.nombre)
      localStorage.setItem(STORAGE_APELLIDO, data.colaborador.apellido)
      setColaborador(data.colaborador)
      setNextTipo(data.next_tipo ?? null)
      setEstado("eligiendo")
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
      setErrorMsg(data.error ?? "Error al registrar la fichada")
      setEstado("error-generico")
      return
    }
    if (data.colaborador) setColaborador(data.colaborador)
    setFichada(data.fichada!)
    setEstado("confirmado")
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
          <span className="text-2xl font-black tracking-tighter">FICH</span>
          <span className="text-2xl font-black tracking-tighter text-blue-200">.AR</span>
        </div>
        {punto && (
          <>
            <p className="text-lg font-semibold mt-2">{punto.nombre}</p>
            <p className="text-blue-200 text-sm mt-0.5">{punto.empresa.nombre}</p>
          </>
        )}
        <p className="text-blue-100 text-xs mt-2 capitalize">{fechaHoy} · {horaActual}</p>
      </div>

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
                  <p className="text-gray-400 text-sm">Ya registraste tu entrada y salida de hoy.</p>
                </div>
              ) : nextTipo === "ENTRADA" ? (
                <button
                  onClick={() => void registrarFichada("ENTRADA")}
                  className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-2xl p-8 flex flex-col items-center gap-2 transition-colors shadow-sm"
                >
                  <LogIn size={40} />
                  <span className="font-bold text-2xl">Registrar Entrada</span>
                </button>
              ) : (
                <button
                  onClick={() => void registrarFichada("SALIDA")}
                  className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-2xl p-8 flex flex-col items-center gap-2 transition-colors shadow-sm"
                >
                  <LogOut size={40} />
                  <span className="font-bold text-2xl">Registrar Salida</span>
                </button>
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
              <p className="text-gray-400 text-sm pt-2">Podés cerrar esta página</p>
            </div>
          )}

          {/* ── ERROR GPS LEJOS ── */}
          {estado === "error-gps" && errorGps && (
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
