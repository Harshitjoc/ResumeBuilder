export function pretty(date: string) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return date
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export function formatDates(start: string, end: string) {
  const s = pretty(start)
  const e = end ? pretty(end) : 'Present'
  if (!start) return e
  return `${s} – ${e}`
}