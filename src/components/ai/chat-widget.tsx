"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Mensaje {
  role: "user" | "assistant"
  content: string
}

export function ChatWidget() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState("")
  const [cargando, setCargando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (abierto) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      inputRef.current?.focus()
    }
  }, [abierto, mensajes])

  async function enviar() {
    const texto = input.trim()
    if (!texto || cargando) return

    const nuevo: Mensaje = { role: "user", content: texto }
    const historial = [...mensajes, nuevo]
    setMensajes(historial)
    setInput("")
    setCargando(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historial }),
      })
      const data = await res.json() as { reply?: string }
      setMensajes([...historial, { role: "assistant", content: data.reply ?? "Error al responder." }])
    } catch {
      setMensajes([...historial, { role: "assistant", content: "Error de conexión. Intentá de nuevo." }])
    } finally {
      setCargando(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void enviar()
    }
  }

  return (
    <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50">
      {/* Chat window */}
      {abierto && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: "480px" }}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-[#2563EB] text-white">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold">Asistente Fich.ar</p>
              <p className="text-xs text-white/70">Impulsado por Claude</p>
            </div>
            <button
              onClick={() => setAbierto(false)}
              className="ml-auto text-white/80 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.length === 0 && (
              <div className="text-center py-8">
                <Bot size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  ¡Hola! Puedo ayudarte con fichadas, novedades, comunicaciones y más.
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    "¿Cuántos llegaron hoy?",
                    "¿Quién no fichó esta semana?",
                    "Publicar aviso de reunión",
                  ].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => { setInput(sug) }}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-colors text-gray-600"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-[#EFF6FF] flex items-center justify-center mr-2 mt-0.5 shrink-0">
                    <Bot size={12} className="text-[#2563EB]" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[#2563EB] text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {cargando && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-[#EFF6FF] flex items-center justify-center mr-2 mt-0.5">
                  <Bot size={12} className="text-[#2563EB]" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 size={14} className="text-gray-400 animate-spin" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escribí tu consulta..."
              rows={1}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 max-h-24"
              style={{ minHeight: "38px" }}
            />
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl shrink-0"
              onClick={() => void enviar()}
              disabled={cargando || !input.trim()}
            >
              <Send size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          abierto ? "bg-gray-800 hover:bg-gray-700" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
        } text-white`}
      >
        {abierto ? <X size={20} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}
