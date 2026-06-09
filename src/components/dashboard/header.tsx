"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface HeaderProps {
  userName: string
  empresaNombre: string
}

export function Header({ userName, empresaNombre }: HeaderProps) {
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <span className="text-sm text-gray-500">{empresaNombre}</span>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors outline-none"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-[#FEF3F0] text-[#E8593C] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {userName}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-red-600"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={14} />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
