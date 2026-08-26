import { useState, useCallback } from 'react'

export function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const copy = useCallback(async (text, id = null) => {
    if (!text) return false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(text))
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = String(text)
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      if (id !== null) setCopiedId(id)
      setTimeout(() => {
        setCopied(false)
        setCopiedId(null)
      }, timeout)
      return true
    } catch {
      return false
    }
  }, [timeout])

  return { copy, copied, copiedId }
}
