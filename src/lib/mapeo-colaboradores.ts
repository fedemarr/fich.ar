export const CAMPOS_MAPEO = [
  { key: "legajo", label: "N° de asociado / Legajo" },
  { key: "apellido", label: "Apellido" },
  { key: "nombre", label: "Nombre" },
  { key: "nombre_completo", label: "Apellido y nombre (en una sola columna)" },
  { key: "dni", label: "DNI" },
  { key: "celular", label: "Celular" },
  { key: "email", label: "Email" },
  { key: "sector", label: "Sector" },
  { key: "puesto", label: "Puesto" },
  { key: "domicilio", label: "Domicilio" },
  { key: "fecha_ingreso", label: "Fecha de ingreso" },
  { key: "punto_qr", label: "Punto QR" },
  { key: "hora_entrada", label: "Hora de entrada" },
  { key: "horas", label: "Horas por día" },
] as const

export type CampoMapeo = (typeof CAMPOS_MAPEO)[number]["key"]

// valor = nombre exacto de la columna del Excel
export type Mapeo = Partial<Record<CampoMapeo, string>> & {
  // Para la columna combinada "APELLIDO1 APELLIDO2 NOMBRE...": cuántas palabras son apellido
  palabras_apellido?: 1 | 2
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

const CANDIDATOS: Partial<Record<CampoMapeo, string[]>> = {
  legajo: ["nrosoc", "socn", "socnro", "nsoc", "nrodesocio", "nroasociado", "nasociado", "legajo", "asociado"],
  dni: ["dni", "documento", "identificacion"],
  celular: ["contacto", "celular", "telefono", "tel"],
  email: ["mail", "correo", "email", "casilla"],
  sector: ["sector"],
  puesto: ["puesto", "cargo"],
  domicilio: ["domicilio", "direccion"],
  fecha_ingreso: ["fechadeingreso", "fechaingreso", "ingreso"],
  punto_qr: ["puntoqr", "lugardetrabajo", "objetivo", "punto"],
  hora_entrada: ["horaentrada", "horadeentrada", "entrada"],
  horas: ["cantidaddehoras", "horasdiarias", "horastrabajo", "horas"],
}

function buscar(headers: string[], candidatos: string[], usados: Set<string>): string | undefined {
  for (const c of candidatos) {
    const exacto = headers.find((h) => !usados.has(h) && normalizar(h) === c)
    if (exacto) return exacto
  }
  for (const c of candidatos) {
    const parcial = headers.find((h) => !usados.has(h) && normalizar(h).includes(c))
    if (parcial) return parcial
  }
  return undefined
}

export function autodetectarMapeo(headers: string[]): Mapeo {
  const mapeo: Mapeo = { palabras_apellido: 2 }
  const usados = new Set<string>()
  const asignar = (campo: CampoMapeo, header: string | undefined) => {
    if (!header) return
    mapeo[campo] = header
    usados.add(header)
  }

  const combinada = headers.find((h) => {
    const n = normalizar(h)
    return n === "nombrecompleto" || (n.includes("nombre") && n.includes("apellido"))
  })
  const apellido = headers.find((h) => { const n = normalizar(h); return n.includes("apellido") && !n.includes("nombre") })
  const nombre = headers.find((h) => { const n = normalizar(h); return n.includes("nombre") && !n.includes("apellido") })

  if (combinada) {
    asignar("nombre_completo", combinada)
  } else if (apellido && nombre) {
    asignar("apellido", apellido)
    asignar("nombre", nombre)
  } else if (apellido || nombre) {
    // Una sola columna de nombre (formato Olimpia: "Apellido" trae el nombre completo)
    asignar("nombre_completo", apellido ?? nombre)
  }

  for (const campo of Object.keys(CANDIDATOS) as CampoMapeo[]) {
    asignar(campo, buscar(headers, CANDIDATOS[campo]!, usados))
  }
  return mapeo
}

export function separarNombreCompleto(completo: string, palabrasApellido: 1 | 2): { apellido: string; nombre: string } {
  const partes = completo.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return { apellido: partes[0] ?? "", nombre: "" }
  if (partes.length === 2) return { apellido: partes[0], nombre: partes[1] }
  return { apellido: partes.slice(0, palabrasApellido).join(" "), nombre: partes.slice(palabrasApellido).join(" ") }
}

export function mapeoValido(mapeo: Mapeo): string | null {
  const tieneSeparado = Boolean(mapeo.apellido && mapeo.nombre)
  if (!tieneSeparado && !mapeo.nombre_completo) {
    return "Elegí las columnas de Apellido y Nombre, o la columna de apellido y nombre juntos"
  }
  if (mapeo.apellido && mapeo.nombre && mapeo.apellido === mapeo.nombre) {
    return "Apellido y Nombre no pueden ser la misma columna"
  }
  return null
}
