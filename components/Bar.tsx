export function Bar({ value, tone = 'aqua', label }: { value: number; tone?: 'aqua' | 'warn' | 'bad' | 'good' | 'violet'; label?: string }) {
  const v = Math.max(0, Math.min(1, value))
  const color = { aqua: 'bg-aqua', warn: 'bg-warn', bad: 'bg-bad', good: 'bg-good', violet: 'bg-violet' }[tone]
  return (
    <div
      className="h-1.5 w-full bg-line/60"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
    >
      <div className={`h-full ${color} opacity-80`} style={{ width: `${v * 100}%` }} />
    </div>
  )
}
