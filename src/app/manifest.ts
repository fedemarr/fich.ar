import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jornada.OH",
    short_name: "Jornada.OH",
    description: "Control de asistencia",
    start_url: "/",
    display: "standalone",
    background_color: "#1D4ED8",
    theme_color: "#2563EB",
    icons: [
      { src: "/logo.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
