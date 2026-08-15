const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export function normalizeImageUrl(value, { optional = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    throw new Error('Image is required.')
  }

  const trimmed = String(value).trim()
  if (!trimmed) {
    if (optional) return null
    throw new Error('Image is required.')
  }

  if (trimmed.startsWith('data:image/')) {
    const base64 = trimmed.split(',')[1] || ''
    const approximateBytes = Math.ceil((base64.length * 3) / 4)
    if (approximateBytes > MAX_IMAGE_BYTES) {
      throw new Error('Image must be 2 MB or smaller.')
    }
    return trimmed
  }

  if (/^https?:\/\//i.test(trimmed)) {
    if (trimmed.length > 2048) throw new Error('Image URL is too long.')
    return trimmed
  }

  throw new Error('Use an HTTPS image URL or upload a JPEG/PNG/WebP file.')
}
