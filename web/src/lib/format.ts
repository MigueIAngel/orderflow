export function money(value: number, lang: string) {
  return new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function time(value: string, lang: string) {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export function dateTime(value: string, lang: string) {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const shortId = (id: string) => id.slice(0, 8)
