/**
 * Formats a single CSV cell value:
 * - If null, undefined, or empty string -> returns '---'
 * - Escapes double quotes and encloses in quotes if containing commas, newlines, or quotes
 */
export function formatCsvValue(value) {
  if (value === null || value === undefined) return '---'
  const str = String(value).trim()
  if (str === '' || str === 'null' || str === 'undefined') return '---'

  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

/**
 * Generates and downloads a UTF-8 encoded CSV file in the browser.
 * @param {string} filename - Filename with or without .csv extension
 * @param {string[]} headers - Column header titles
 * @param {Array<Array<any>>} rows - 2D array of row values
 */
export function downloadCsv(filename, headers, rows) {
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`
  const formattedHeaders = headers.map(h => formatCsvValue(h)).join(',')
  const formattedRows = rows.map(row => row.map(cell => formatCsvValue(cell)).join(','))
  
  const csvContent = '\uFEFF' + [formattedHeaders, ...formattedRows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', safeFilename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
