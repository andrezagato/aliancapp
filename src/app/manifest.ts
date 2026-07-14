import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sirvo — escalas da sua igreja",
    short_name: "Sirvo",
    description: "Escalas de equipes para igreja, com alma.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#FBF6E9",
    theme_color: "#6E1122",
    orientation: "portrait",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
