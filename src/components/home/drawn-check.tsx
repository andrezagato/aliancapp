/**
 * Check que se "desenha" (stroke-dashoffset → 0 via `animate-draw`). Sob
 * prefers-reduced-motion a duração é zerada e ele já aparece pronto.
 */
export function DrawnCheck({
  className,
  strokeWidth = 2.6,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" strokeDasharray="24" strokeDashoffset="24" className="animate-draw" />
    </svg>
  );
}
