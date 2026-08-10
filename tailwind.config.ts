import type { Config } from "tailwindcss";

/**
 * Tema "acolhedor / quente":
 * base creme, primária terracota/âmbar, acento verde-musgo.
 * Cores expostas como CSS vars em globals.css (suporta dark mode depois).
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: { "2xl": "1120px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // `ink` = a variante de TEXTO de cada cor de estado (AA sobre creme).
        // bg-success/12 + text-success-ink; nunca text-success em texto.
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          ink: "hsl(var(--success-ink))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          ink: "hsl(var(--warning-ink))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          ink: "hsl(var(--destructive-ink))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(43, 39, 36, 0.04), 0 8px 24px rgba(43, 39, 36, 0.06)",
        lift: "0 2px 4px rgba(43, 39, 36, 0.05), 0 14px 40px rgba(43, 39, 36, 0.10)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // entrada dos cards (herói, tiles) — "sobe e aparece"
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "none" },
        },
        // linha que desliza da esquerda (listas de pessoas/posições)
        rowin: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "none" },
        },
        // "pop" de confirmação — a coisa incha de leve e volta
        pop: {
          "0%": { transform: "scale(1)" },
          "38%": { transform: "scale(1.045)" },
          "100%": { transform: "scale(1)" },
        },
        // check que se desenha (usa stroke-dasharray no path)
        draw: {
          to: { strokeDashoffset: "0" },
        },
        // bottom sheet subindo com mola
        sheet: {
          from: { transform: "translateY(102%)" },
          to: { transform: "translateY(0)" },
        },
        // véu escuro atrás do sheet
        scrim: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // toast: sobe, fica, some (self-contained; mantém translateX(-50%))
        toast: {
          "0%": { opacity: "0", transform: "translate(-50%, 14px)" },
          "12%": { opacity: "1", transform: "translate(-50%, 0)" },
          "88%": { opacity: "1", transform: "translate(-50%, 0)" },
          "100%": { opacity: "0", transform: "translate(-50%, -6px)" },
        },
        // brilho dourado pulsando no canto dos heróis vinho
        glow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "0.9" },
        },
        // chama girando (pull-to-refresh / spinner)
        flame: {
          to: { transform: "rotate(360deg)" },
        },
        // push da direita: detalhe do evento / notificações entram deslizando
        push: {
          from: { transform: "translateX(100%)" },
          to: { transform: "none" },
        },
        // MENSAGEM CHEGOU NA RÉGIA: moldura piscando na tela inteira. Três
        // batidas, e não um fade só — piscada única se confunde com o vídeo
        // trocando de cena, e cabine olha pra tela de canto de olho. Não vai a
        // zero no meio: a moldura continua visível o tempo todo, só muda de
        // intensidade, senão quem olha no vale acha que não tem nada.
        alerta: {
          "0%, 100%": { opacity: "0" },
          "6%, 22%": { opacity: "1" },
          "36%": { opacity: "0.25" },
          "48%, 60%": { opacity: "1" },
          "74%": { opacity: "0.25" },
          "86%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.24s ease-out both",
        "fade-up": "fade-up 0.5s ease both",
        rowin: "rowin 0.3s ease both",
        pop: "pop 0.5s both",
        draw: "draw 0.45s 0.05s ease forwards",
        sheet: "sheet 0.34s cubic-bezier(0.32, 0.72, 0.24, 1) both",
        scrim: "scrim 0.22s ease both",
        toast: "toast 2.6s ease forwards",
        glow: "glow 5s ease-in-out infinite",
        flame: "flame 1s linear infinite",
        push: "push 0.34s cubic-bezier(0.32, 0.72, 0.24, 1) both",
        alerta: "alerta 2.5s ease-in-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
