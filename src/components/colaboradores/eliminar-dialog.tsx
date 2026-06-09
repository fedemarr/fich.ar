"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Colaborador } from "@/generated/prisma/client"

interface EliminarDialogProps {
  open: boolean
  colaborador: Colaborador | null
  onClose: () => void
  onSuccess: () => void
}

export function EliminarDialog({ open, colaborador, onClose, onSuccess }: EliminarDialogProps) {
  const [loading, setLoading] = useState(false)

  async function confirmar() {
    if (!colaborador) return
    setLoading(true)
    const res = await fetch(`/api/colaboradores/${colaborador.id}`, { method: "DELETE" })
    setLoading(false)
    if (!res.ok) { toast.error("Error al eliminar"); return }
    toast.success("Colaborador eliminado")
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar colaborador</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 mt-1">
          ¿Seguro que querés eliminar a{" "}
          <span className="font-semibold">{colaborador?.apellido} {colaborador?.nombre}</span>?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
            disabled={loading}
            onClick={confirmar}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
