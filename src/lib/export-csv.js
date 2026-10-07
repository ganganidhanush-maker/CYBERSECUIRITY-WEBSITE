import { formatCsvValue } from '../../shared/csv.js'

export { formatCsvValue }

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
