/**
 * Símbolo da marca Aliança/Sirvo — cabeça de cavalo com uma chama esculpida no
 * negativo. Extraído de brand/ALIANÇA_Logotipo-04.svg (as duas paths do símbolo:
 * o contorno do cavalo/chama-vazada + a línguazinha de chama interna). Usa
 * `currentColor`, então tinja com `text-*` (creme sobre vinho, vinho sobre creme…).
 */
export function SirvoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="150 162 180 216"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Sirvo"
    >
      <path d="M244.45,166.44v14.93c45.76,4.19,81.6,42.66,81.6,89.55v18.31c-16.26-34.22-50.63-58.17-90.6-59.31,4.94,17.2,2.53,36.73-10.11,47.41-16.9,14.29-27.89,33.09-27.96,55.26-.05,15.02,4.22,29.19,12.67,40.98h-44.34c-6.5,0-11.77-5.27-11.77-11.76v-105.93c0-49.39,40.03-89.43,89.42-89.43h1.08Z" />
      <path d="M307.06,373.56h-55.5c-3.61-4.88-5.75-10.89-5.91-17.23-.24-9.42,4-16.9,10.84-22.95l7.89-7c6.62-5.87,13.47-11.05,12.09-20.2,15.45,7.82,21.12,25.8,13.73,41.46,6.6-3.19,11.28-8.97,14.64-16.31,4.21,4.04,5.98,9.47,6.86,15.25,1.42,9.37-.34,18.78-4.64,26.98Z" />
    </svg>
  );
}
