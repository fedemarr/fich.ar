import { HelpCircle, QrCode, Calendar, MessageSquare, Bot, FileText, Mail } from "lucide-react"

const SECCIONES = [
  {
    icon: QrCode,
    titulo: "Puntos QR",
    desc: "Configurá los lugares de fichada. Cada punto genera un QR único que los colaboradores escanean desde WhatsApp.",
  },
  {
    icon: MessageSquare,
    titulo: "Bot de WhatsApp",
    desc: "El colaborador escanea el QR, le llega un mensaje al bot, elige Entrada o Salida, manda su ubicación y el sistema registra la fichada automáticamente.",
  },
  {
    icon: Calendar,
    titulo: "Novedades",
    desc: "Registrá ausencias, vacaciones, enfermedad y más. La tab Inasistencias muestra quién no fichó en los últimos días hábiles para registrarlo rápido.",
  },
  {
    icon: FileText,
    titulo: "Listado del día",
    desc: "Ves todas las fichadas del día con análisis de puntualidad. Podés registrar fichadas manuales y exportar a Excel.",
  },
  {
    icon: Bot,
    titulo: "Asistente IA",
    desc: "El ícono flotante en la esquina te permite consultar datos de asistencia en lenguaje natural. Por ejemplo: '¿Quiénes llegaron tarde esta semana?'",
  },
]

const FAQ = [
  {
    q: "¿Qué pasa si un colaborador no tiene WhatsApp?",
    a: "Podés registrar la fichada manualmente desde el Listado del día con el botón '+ Fichada manual'.",
  },
  {
    q: "¿Cómo agrego un colaborador nuevo?",
    a: "Entrá a Colaboradores → botón 'Nuevo colaborador'. Solo necesitás nombre, apellido y número de celular con código de país (+54...).",
  },
  {
    q: "¿Cómo sé si el GPS está dentro del rango permitido?",
    a: "Cada punto QR tiene un radio configurado en metros. Si el colaborador está fuera de ese radio, la fichada se marca como fuera de rango.",
  },
  {
    q: "¿Se pueden tener varios horarios en el mismo lugar?",
    a: "Sí. En cada Punto QR podés configurar múltiples turnos (ej: L-V 9 a 17, o 4 días presencial + 1 virtual).",
  },
  {
    q: "¿Cómo exporto el reporte mensual de novedades?",
    a: "En Novedades → tab Reporte → botón 'Exportar reporte a Excel' en la parte inferior.",
  },
  {
    q: "¿Puedo tener más de un administrador?",
    a: "Sí. En Configuración → Usuarios podés agregar otros admins o managers con sus propias credenciales.",
  },
]

export default function AyudaPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <HelpCircle size={20} className="text-[#2563EB]" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Centro de Ayuda</h1>
          <p className="text-xs text-gray-400">Guías y preguntas frecuentes</p>
        </div>
      </div>

      {/* Guía rápida */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Guía rápida de cada sección</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SECCIONES.map(({ icon: Icon, titulo, desc }) => (
            <div key={titulo} className="flex gap-3 p-3 rounded-lg border border-gray-100 hover:border-[#2563EB]/30 hover:bg-[#EFF6FF]/30 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                <Icon size={16} className="text-[#2563EB]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-gray-800 mb-1">{q}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contacto */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
            <Mail size={18} className="text-[#2563EB]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">¿Necesitás soporte?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Escribinos a{" "}
              <a href="mailto:soporte@fich.ar" className="text-[#2563EB] hover:underline">
                soporte@fich.ar
              </a>
              {" "}y te respondemos a la brevedad.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
