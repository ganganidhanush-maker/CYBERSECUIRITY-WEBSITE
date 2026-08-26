/**
 * Standard formatters for dates, times, currency, and files.
 */

export function formatDate(val, options = {}) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    })
  } catch {
    return '—'
  }
}

export function formatDateTime(val, options = {}) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    })
  } catch {
    return '—'
  }
}

export function formatTime(val) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatTimeAgo(val) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    const diffMs = Date.now() - d.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHrs = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHrs / 24)

    if (diffSec < 60) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHrs < 24) return `${diffHrs}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 30) return `${diffDays}d ago`
    return formatDate(val)
  } catch {
    return '—'
  }
}

export function formatFileSize(bytes) {
  if (!bytes || typeof bytes !== 'number') return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}
