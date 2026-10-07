export function formatCsvValue(value) {
  if (value === null || value === undefined) return '---'
  const str = String(value).trim()
  if (str === '' || str === 'null' || str === 'undefined') return '---'

  // Prevent spreadsheet formula execution in untrusted text. Preserve negative
  // numeric values as numbers, while neutralizing formula-like strings.
  const numericText = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(str)
  const safe = typeof value === 'string' && !numericText && /^[=+\-@]/.test(str) ? `'${str}` : str
  if (safe.includes(',') || safe.includes('\n') || safe.includes('\r') || safe.includes('"')) {
    return `"${safe.replaceAll('"', '""')}"`
  }
  return safe
}
