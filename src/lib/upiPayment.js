import QRCode from 'qrcode'
import { createWorker } from 'tesseract.js'

/**
 * Normalizes a UPI ID (trims whitespace, converts to lowercase)
 */
export function normalizeUpiId(id) {
  if (!id) return ''
  return String(id).trim().toLowerCase()
}

/**
 * Builds standard and app-specific UPI payment deep links.
 */
export function buildUpiLinks({ upiId, payeeName = 'CyberSecurityClub', amount = 0, note = 'Registration Fee' }) {
  const cleanUpi = normalizeUpiId(upiId)
  if (!cleanUpi) return null

  const numAmount = Number(amount) || 0
  const amountStr = numAmount > 0 ? numAmount.toFixed(2) : ''
  const encodedName = encodeURIComponent(payeeName || 'CyberSecurityClub')
  const encodedNote = encodeURIComponent((note || 'Event Registration').slice(0, 30))
  
  const queryParams = [
    `pa=${encodeURIComponent(cleanUpi)}`,
    `pn=${encodedName}`,
    numAmount > 0 ? `am=${amountStr}` : null,
    'cu=INR',
    `tn=${encodedNote}`,
  ].filter(Boolean).join('&')

  return {
    upiUri: `upi://pay?${queryParams}`,
    phonePeUri: `phonepe://pay?${queryParams}`,
    gPayUri: `gpay://upi/pay?${queryParams}`,
    paytmUri: `paytmmp://pay?${queryParams}`,
    bhimUri: `bhim://pay?${queryParams}`,
    amount: numAmount,
    amountStr,
    upiId: cleanUpi,
    payeeName,
    note,
  }
}

/**
 * Generates an offline Data URL QR code from UPI link parameters.
 * Falls back to qrserver if QRCode.toDataURL fails.
 */
export async function generateUpiQrDataUrl({ upiId, payeeName = 'CyberSecurityClub', amount = 0, note = 'Pass' }) {
  const links = buildUpiLinks({ upiId, payeeName, amount, note })
  if (!links) return ''

  try {
    const dataUrl = await QRCode.toDataURL(links.upiUri, {
      width: 320,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
    return dataUrl
  } catch (err) {
    console.warn('Local QRCode generator fallback to web QR API:', err)
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(links.upiUri)}`
  }
}

/**
 * Pre-processes an image on an HTML5 canvas to optimize OCR accuracy and speed.
 */
function preprocessImage(imageSource, maxDim = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(img)
        return
      }

      // Draw original image
      ctx.drawImage(img, 0, 0, width, height)

      // Contrast and grayscale boost for crisper receipt text
      const imgData = ctx.getImageData(0, 0, width, height)
      const data = imgData.data
      const contrast = 1.25 // +25% contrast
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))

      for (let i = 0; i < data.length; i += 4) {
        // Luminance
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        // Apply contrast
        const adjusted = factor * (avg - 128) + 128
        const clamped = Math.max(0, Math.min(255, adjusted))
        data[i] = clamped
        data[i + 1] = clamped
        data[i + 2] = clamped
      }

      ctx.putImageData(imgData, 0, 0)
      resolve(canvas)
    }
    img.onerror = reject

    if (typeof imageSource === 'string') {
      img.src = imageSource
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      img.src = URL.createObjectURL(imageSource)
    } else {
      reject(new Error('Unsupported image source'))
    }
  })
}

/**
 * Extracts 12-digit UPI UTR / Reference ID from an image using client-side OCR.
 */
export async function extractUtrFromScreenshot(imageFile, onProgress) {
  if (!imageFile) {
    return { success: false, error: 'No image file provided' }
  }

  let worker = null
  try {
    if (onProgress) onProgress({ status: 'optimizing_image', progress: 0.1, message: 'Optimizing screenshot for scanning...' })
    const preparedCanvas = await preprocessImage(imageFile, 1200)

    if (onProgress) onProgress({ status: 'loading_scanner', progress: 0.25, message: 'Initializing OCR scanner engine...' })
    worker = await createWorker('eng', 1, {
      logger: m => {
        if (onProgress && m?.status === 'recognizing text') {
          onProgress({
            status: 'recognizing_text',
            progress: 0.3 + (m.progress || 0) * 0.65,
            message: `Scanning receipt text (${Math.round((m.progress || 0) * 100)}%)...`,
          })
        }
      },
    })

    if (onProgress) onProgress({ status: 'analyzing', progress: 0.85, message: 'Analyzing transaction details...' })
    const { data: { text } } = await worker.recognize(preparedCanvas)

    const utr = parseUtrFromText(text)
    if (utr) {
      if (onProgress) onProgress({ status: 'done', progress: 1, message: `Found 12-digit UTR: ${utr}` })
      return {
        success: true,
        utr,
        rawText: text,
      }
    }

    if (onProgress) onProgress({ status: 'not_found', progress: 1, message: 'Could not detect 12-digit UTR. Please enter manually.' })
    return {
      success: false,
      error: 'Could not find a 12-digit UTR / reference number in the screenshot. Please check the image or enter your UTR manually.',
      rawText: text,
    }
  } catch (err) {
    console.error('Error in extractUtrFromScreenshot:', err)
    return {
      success: false,
      error: err.message || 'Failed to scan receipt image.',
    }
  } finally {
    if (worker) {
      try {
        await worker.terminate()
      } catch {
        // ignore termination error
      }
    }
  }
}

/**
 * Regular expression parsing logic for Indian UPI transaction screenshots (PhonePe, GPay, Paytm, BHIM, Banks).
 */
export function parseUtrFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null

  const cleaned = rawText.replace(/\r\n/g, '\n').replace(/\t/g, ' ')

  // 1. Explicit labeled UTR/Ref patterns (Highest confidence)
  // e.g. "UPI Ref No : 429182748192", "UTR: 429182748192", "Transaction ID: 429182748192"
  const highConfidenceRegexes = [
    /(?:upi\s*ref(?:erence)?\s*(?:no|num|id)?|utr|rrn|bank\s*ref(?:erence)?(?:\s*no)?)\s*[:#\-.\s]?\s*([0-9]{12})\b/i,
    /(?:transaction\s*id|txn\s*id|payment\s*id)\s*[:#\-.\s]?\s*([0-9]{12})\b/i,
    // Spaced or dashed 12-digits like 4291 8274 8192 or 4291-8274-8192 following a label
    /(?:upi\s*ref|utr|rrn|txn)[^\n\d]{1,20}([0-9]{4}[\s\-][0-9]{4}[\s\-][0-9]{4})\b/i,
    // Google Pay style "UPI transaction ID 429182748192"
    /upi\s*transaction\s*id\s*[:#\-.\s]?\s*([0-9]{12})\b/i,
  ]

  for (const regex of highConfidenceRegexes) {
    const match = cleaned.match(regex)
    if (match && match[1]) {
      const sanitized = match[1].replace(/[\s\-]/g, '')
      if (/^[0-9]{12}$/.test(sanitized)) {
        return sanitized
      }
    }
  }

  // 2. Scan for any 12-digit number sequence
  // If there are multiple 12-digit numbers, prefer ones that appear on lines mentioning "UPI", "Bank", "Ref", "UTR", "Success", "Trans"
  const lines = cleaned.split('\n')
  for (const line of lines) {
    if (/(?:upi|ref|utr|rrn|bank|trans|id|paid|success)/i.test(line)) {
      const lineMatch = line.match(/\b([0-9]{12})\b/)
      if (lineMatch) {
        return lineMatch[1]
      }
      // Also test spaced 4-4-4
      const lineSpacedMatch = line.match(/\b([0-9]{4}[\s\-][0-9]{4}[\s\-][0-9]{4})\b/)
      if (lineSpacedMatch) {
        const sanitized = lineSpacedMatch[1].replace(/[\s\-]/g, '')
        if (/^[0-9]{12}$/.test(sanitized)) return sanitized
      }
    }
  }

  // 3. Fallback: Find any 12-digit sequence in entire text
  const all12Digits = cleaned.match(/\b([0-9]{12})\b/g)
  if (all12Digits && all12Digits.length > 0) {
    // Exclude common timestamps or account numbers if possible, return first match
    return all12Digits[0]
  }

  return null
}
