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

  // 2. Scan for any 12-digit number sequence in lines mentioning UPI / banking keywords
  const lines = cleaned.split('\n')
  for (const line of lines) {
    if (/(?:upi|ref|utr|rrn|bank|trans|id|paid|success)/i.test(line)) {
      const lineMatch = line.match(/\b([0-9]{12})\b/)
      if (lineMatch) {
        return lineMatch[1]
      }
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
    return all12Digits[0]
  }

  return null
}
