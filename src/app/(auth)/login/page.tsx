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

      {/* ── COLUMNA IZQUIERDA (solo desktop) ── */}
      <div
        className="hidden lg:flex lg:w-3/5 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
      >
        {/* Círculos decorativos */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/10 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-white/10 translate-y-1/3 -translate-x-1/3" />
        <div className="absolute top-1/2 right-8 w-48 h-48 rounded-full bg-white/5" />

        {/* Logo texto */}
        <div className="relative z-10">
          <span className="text-5xl font-black tracking-tighter text-white">FICH</span><span className="text-5xl font-black tracking-tighter text-blue-200">.AR</span>
        </div>

        {/* Texto central */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-5xl font-bold text-white leading-tight">
              El sistema de RRHH<br />
              que tu empresa<br />
              <span className="text-blue-200">necesitaba.</span>
            </h1>
            <p className="mt-4 text-blue-100 text-lg leading-relaxed">
              Control de asistencia inteligente con WhatsApp,
              IA y reportes en tiempo real.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-white">
                <CheckCircle2 className="w-5 h-5 text-blue-200 shrink-0" />
                <span className="text-[15px]">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card estadística */}
        <div className="relative z-10 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl shrink-0">
              📊
            </div>
            <div>
              <p className="text-white font-bold text-2xl leading-tight">500+</p>
              <p className="text-blue-100 text-sm">colaboradores gestionados en tiempo real</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            {[
              { valor: "98%", label: "precisión GPS" },
              { valor: "2s", label: "tiempo fichada" },
              { valor: "24/7", label: "disponible" },
            ].map(({ valor, label }) => (
              <div key={label} className="text-center">
                <p className="text-white font-bold text-xl">{valor}</p>
                <p className="text-blue-200 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── COLUMNA DERECHA (formulario) ── */}
      <div className="w-full lg:w-2/5 flex flex-col bg-white">
        <div className="flex-1 flex flex-col justify-center px-8 lg:px-12 py-10 max-w-md mx-auto w-full">

          {/* Logo texto */}
          <div className="mb-10">
            <span className="text-4xl font-black tracking-tighter text-slate-900">FICH</span><span className="text-4xl font-black tracking-tighter text-blue-600">.AR</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Iniciá sesión</h2>
            <p className="text-slate-500 mt-1.5 text-[15px]">Ingresá con tu cuenta de empresa</p>
          </div>

          <LoginForm />
        </div>

        {/* FMCODE — pie */}
        <div className="px-8 lg:px-12 pb-10 max-w-md mx-auto w-full">
          <div className="border-t border-slate-100 pt-8">
            <p className="text-slate-500 text-sm text-center mb-4">
              ¿Querés <strong>Fich.ar</strong> para tu empresa?
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
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
                  <span className="text-blue-600 font-bold">→</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {[
                  { icon: "🌐", text: "fmcode.com.ar" },
                  { icon: "💬", text: "WhatsApp: +54 9 11 2234-0114" },
                  { icon: "📧", text: "fedenez11@gmail.com" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-slate-600 text-sm">
                    <span>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </a>

            <p className="text-center text-slate-400 text-xs mt-5">
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
