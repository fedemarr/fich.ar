import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ProyeccionCliente } from "@/components/proyeccion/proyeccion-cliente"

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ mes?: string; anio?: string }>
}

export default async function ProyeccionPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params
  const sp = await searchParams

  const hoy = new Date()
  const mes = sp.mes ? parseInt(sp.mes) : hoy.getMonth() + 1
  const anio = sp.anio ? parseInt(sp.anio) : hoy.getFullYear()

  const empresaId = session.user.empresaId
  if (!empresaId) redirect("/login")

  const [proyeccion, puntos] = await Promise.all([
    prisma.proyeccionMensual.findUnique({
      where: { empresa_id_mes_anio: { empresa_id: empresaId, mes, anio } },
      include: {
        asignaciones: {
          include: {
            colaborador: { select: { id: true, nombre: true, apellido: true, legajo: true } },
            punto_fichaje: { select: { id: true, nombre: true } },
          },
          orderBy: [{ servicio_nombre: "asc" }, { colaborador: { apellido: "asc" } }],
        },
      },
    }),
    prisma.puntoFichaje.findMany({
      where: { empresa_id: empresaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ])

  return (
    <ProyeccionCliente
      slug={slug}
      mes={mes}
      anio={anio}
      proyeccion={proyeccion}
      puntos={puntos}
    />
  )
}
