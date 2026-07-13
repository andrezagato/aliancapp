import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Servir — escalas da sua igreja",
    short_name: "Servir",
    description: "Escalas de equipes para igreja.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#FBF7F0",
    theme_color: "#C4633E",
    orientation: "portrait",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
