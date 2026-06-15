import Image from "next/image"
import { LoginForm } from "@/components/auth/login-form"
import { CheckCircle2 } from "lucide-react"

const FEATURES = [
  "Control de asistencia por WhatsApp + QR",
  "Proyección mensual de horas por servicio",
  "Novedades y ausencias automáticas",
  "Reportes exportables en tiempo real",
  "Asistente IA integrado al dashboard",
  "Multi-empresa y multi-sucursal",
]

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">

      {/* COLUMNA IZQUIERDA — solo desktop */}
      <div
        className="hidden lg:flex lg:w-3/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
      >
        {/* Círculos decorativos */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
          style={{ background: "white", transform: "translate(30%, -30%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: "white", transform: "translate(-30%, 30%)" }}
        />

        {/* Logo grande */}
        <div className="relative z-10">
          <Image
            src="/logo-fichar.png"
            alt="Fich.ar"
            width={200}
            height={60}
            className="brightness-0 invert"
          />
        </div>

        {/* Texto central */}
        <div className="space-y-8 relative z-10">
          <div>
            <h1 className="text-5xl font-bold text-white leading-tight">
              El sistema de RRHH<br />
              que tu empresa<br />
              <span className="text-blue-200">necesitaba.</span>
            </h1>
            <p className="mt-4 text-blue-100 text-lg">
              Control de asistencia inteligente con WhatsApp,
              IA y reportes en tiempo real.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-white">
                <CheckCircle2 className="w-5 h-5 text-blue-200 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card estadística flotante */}
        <div className="relative z-10 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <p className="text-white font-bold text-2xl">500+</p>
              <p className="text-blue-100 text-sm">empleados gestionados en tiempo real</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            <div className="text-center">
              <p className="text-white font-bold text-xl">98%</p>
              <p className="text-blue-200 text-xs">precisión GPS</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">2s</p>
              <p className="text-blue-200 text-xs">tiempo fichada</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">24/7</p>
              <p className="text-blue-200 text-xs">disponible</p>
            </div>
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA — formulario */}
      <div className="w-full lg:w-2/5 flex flex-col justify-between p-8 lg:p-12 bg-white">

        {/* Logo mobile */}
        <div className="lg:hidden mb-8">
          <Image src="/logo-fichar.png" alt="Fich.ar" width={140} height={42} />
        </div>

        {/* Logo desktop pequeño */}
        <div className="hidden lg:block mb-8">
          <Image src="/logo-fichar.png" alt="Fich.ar" width={120} height={36} />
        </div>

        {/* Formulario */}
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Iniciá sesión</h2>
            <p className="text-slate-500 mt-2">Ingresá con tu cuenta de empresa</p>
          </div>

          <LoginForm />
        </div>

        {/* FMCODE — parte inferior */}
        <div className="max-w-sm mx-auto w-full mt-8">
          <div className="border-t border-slate-100 pt-8">
            <p className="text-slate-500 text-sm text-center mb-4">
              ¿Querés implementar <strong>Fich.ar</strong> en tu empresa?
            </p>

            <a
              href="https://fmcode.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-slate-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
                    FMCODE
                  </p>
                  <p className="text-slate-500 text-sm">Desarrollo de software a medida</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <span className="text-blue-600 text-lg font-bold">→</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <span>🌐</span>
                  <span>fmcode.com.ar</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <span>💬</span>
                  <span>WhatsApp: +54 9 11 2234-0114</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <span>📧</span>
                  <span>fedenez11@gmail.com</span>
                </div>
              </div>
            </a>

            <p className="text-center text-slate-400 text-xs mt-6">
              Powered by{" "}
              <a href="https://fmcode.com.ar" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">
                FMCODE
              </a>
              {" "}· © {new Date().getFullYear()} Fich.ar
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
