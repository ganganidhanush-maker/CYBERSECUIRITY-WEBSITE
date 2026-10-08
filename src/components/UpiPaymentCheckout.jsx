import React, { useState, useEffect, useRef } from 'react'
import {
  IconCheck,
  IconCopy,
  IconQrCode,
  IconUpload,
  IconAlertTriangle,
  IconZap,
  IconCheckCircle,
  IconRefresh,
} from './Icons'
import {
  buildUpiLinks,
  generateUpiQrDataUrl,
  extractUtrFromScreenshot,
  normalizeUpiId,
} from '../lib/upiPayment'

export default function UpiPaymentCheckout({
  upiId = '',
  payeeName = 'CyberSecurityClub',
  amount = 0,
  note = 'Registration Pass',
  customQrUrl = '',
  paymentReference = '',
  onPaymentReferenceChange,
  onScreenshotChange,
  screenshotPreview = '',
  allowScreenshot = true,
  required = true,
}) {
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [autoQrUrl, setAutoQrUrl] = useState('')
  const [qrLoading, setQrLoading] = useState(false)
  
  // OCR scanning states
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanMessage, setScanMessage] = useState('')
  const [ocrResult, setOcrResult] = useState(null) // { success: boolean, utr?: string, error?: string }
  const [localScreenshotPreview, setLocalScreenshotPreview] = useState(screenshotPreview || '')

  const fileInputRef = useRef(null)

  const effectiveUpiId = normalizeUpiId(upiId) || 'cybersecurityclub@upi'
  const numAmount = Number(amount) || 0

  // Build UPI links for PhonePe, GPay, Paytm, and generic UPI
  const upiLinks = buildUpiLinks({
    upiId: effectiveUpiId,
    payeeName,
    amount: numAmount,
    note,
  })

  // Auto-generate QR code whenever upiId, amount, or customQrUrl changes
  useEffect(() => {
    let isMounted = true

    if (customQrUrl && !customQrUrl.includes('api.qrserver.com')) {
      // If admin explicitly set a custom uploaded QR image
      setAutoQrUrl(customQrUrl)
      return
    }

    if (!effectiveUpiId) {
      setAutoQrUrl('')
      return
    }

    setQrLoading(true)
    generateUpiQrDataUrl({
      upiId: effectiveUpiId,
      payeeName,
      amount: numAmount,
      note,
    })
      .then(url => {
        if (isMounted) {
          setAutoQrUrl(url)
          setQrLoading(false)
        }
      })
      .catch(err => {
        console.error('Failed to generate UPI QR:', err)
        if (isMounted) {
          // Fallback
          setAutoQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLinks?.upiUri || `upi://pay?pa=${effectiveUpiId}`)}`)
          setQrLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [effectiveUpiId, payeeName, numAmount, note, customQrUrl])

  function handleCopyUpi() {
    if (!effectiveUpiId) return
    navigator.clipboard?.writeText(effectiveUpiId)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2200)
  }



  // Handle screenshot upload & auto OCR extraction
  async function handleScreenshotUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setOcrResult(null)
    setIsScanning(true)
    setScanProgress(0.1)
    setScanMessage('Preparing screenshot...')

    // Create local preview
    const previewUrl = URL.createObjectURL(file)
    setLocalScreenshotPreview(previewUrl)

    // Notify parent if handler passed
    if (onScreenshotChange) {
      const reader = new FileReader()
      reader.onload = evt => {
        onScreenshotChange(evt.target.result)
      }
      reader.readAsDataURL(file)
    }

    try {
      const result = await extractUtrFromScreenshot(file, progressUpdate => {
        setScanProgress(progressUpdate.progress || 0.5)
        setScanMessage(progressUpdate.message || 'Scanning...')
      })

      if (result.success && result.utr) {
        setOcrResult({ success: true, utr: result.utr })
        if (onPaymentReferenceChange) {
          onPaymentReferenceChange(result.utr)
        }
      } else {
        setOcrResult({
          success: false,
          error: result.error || 'Could not detect 12-digit UTR. Please check the screenshot or type it manually below.',
        })
      }
    } catch (err) {
      setOcrResult({
        success: false,
        error: 'Failed to scan image. Please enter your UTR manually below.',
      })
    } finally {
      setIsScanning(false)
    }
  }

  const isUtrComplete = Boolean(paymentReference && /^[0-9]{12}$/.test(paymentReference.trim()))

  return (
    <div className="upi-checkout-widget" style={{ margin: '14px 0' }}>
      {/* 1. Header: Amount Due */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'var(--panel-subtle)',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        marginBottom: '14px',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Amount Payable:</span>
        <span style={{ fontSize: '17px', color: '#10b981', fontWeight: 800 }}>
          ₹{numAmount.toFixed(2)}
        </span>
      </div>



      {/* 3. Feature 3: Auto QR Generator (No Upload Needed) */}
      <div style={{
        textAlign: 'center',
        padding: '14px',
        background: '#ffffff',
        borderRadius: '10px',
        border: '2px solid var(--brand-primary)',
        marginBottom: '14px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
          <IconQrCode size={16} color="#07121c" />
          <b style={{ color: '#07121c', fontSize: '12px', fontWeight: 800 }}>
            SCAN DYNAMIC UPI QR (₹{numAmount})
          </b>
        </div>

        {qrLoading ? (
          <div style={{ width: '160px', height: '160px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '11px' }}>
            <IconRefresh size={18} className="spin" /> Generating QR...
          </div>
        ) : (
          <img
            src={autoQrUrl || customQrUrl}
            alt="Dynamic Payment UPI QR"
            style={{ maxWidth: '170px', height: 'auto', display: 'block', margin: '0 auto', borderRadius: '4px' }}
          />
        )}

        <small style={{ display: 'block', maxWidth: '260px', margin: '8px auto 0', color: '#475569', fontSize: '10.5px', lineHeight: 1.4 }}>
          Scan using PhonePe, Google Pay, Paytm, or BHIM scanner on your mobile.
        </small>

        {effectiveUpiId && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
            <span style={{ color: '#07121c', fontSize: '11.5px', fontWeight: 700, fontFamily: 'monospace', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
              UPI: {effectiveUpiId}
            </span>
            <button
              type="button"
              onClick={handleCopyUpi}
              style={{
                padding: '3px 8px',
                fontSize: '10.5px',
                background: 'var(--brand-primary)',
                color: '#000000',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {copiedUpi ? (
                <><IconCheck size={11} /> COPIED</>
              ) : (
                <><IconCopy size={11} /> COPY</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 4. Feature 2: Auto-Fill UTR from Uploaded Payment Screenshot */}
      {allowScreenshot && (
        <div style={{
          background: 'var(--panel-subtle)',
          border: '1px dashed var(--brand-border-subtle, #38bdf8)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-main)', fontWeight: 700, margin: 0 }}>
              <IconUpload size={14} color="var(--brand-primary)" />
              Upload Payment Screenshot (Auto-Detects UTR)
            </label>
            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <IconZap size={11} /> AI OCR
            </span>
          </div>

          <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
            Upload your PhonePe or UPI payment receipt. Our scanner will automatically read the 12-digit UTR!
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleScreenshotUpload}
            style={{ width: '100%', fontSize: '11px', padding: '6px', background: 'var(--bg-input)', borderRadius: '6px', border: '1px solid var(--line)' }}
          />

          {/* Scanning Progress Feedback */}
          {isScanning && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                <IconRefresh size={13} className="spin" /> {scanMessage}
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(scanProgress * 100)}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width 0.2s ease' }} />
              </div>
            </div>
          )}

          {/* OCR Result Feedback */}
          {ocrResult && !isScanning && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 600,
              background: ocrResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
              border: ocrResult.success ? '1px solid #10b981' : '1px solid #ef4444',
              color: ocrResult.success ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              {ocrResult.success ? (
                <>
                  <IconCheckCircle size={15} color="#10b981" />
                  <span>Auto-filled UTR: <strong>{ocrResult.utr}</strong> from screenshot!</span>
                </>
              ) : (
                <>
                  <IconAlertTriangle size={15} color="#ef4444" />
                  <span>{ocrResult.error}</span>
                </>
              )}
            </div>
          )}

          {localScreenshotPreview && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={localScreenshotPreview}
                alt="Receipt Preview"
                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--line)' }}
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                Receipt attached ({ocrResult?.success ? 'UTR extracted' : 'Ready'})
              </span>
            </div>
          )}
        </div>
      )}

      {/* 5. 12-Digit Bank UPI Reference / UTR Number Input */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 600, margin: 0 }}>
            12-Digit Bank UPI Reference / UTR Number {required ? '*' : ''}
          </label>
          <span style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            color: isUtrComplete ? '#10b981' : 'var(--text-dim)',
            fontWeight: 700,
          }}>
            {paymentReference?.length || 0} / 12 digits {isUtrComplete && '✓'}
          </span>
        </div>

        <input
          required={required}
          value={paymentReference}
          onChange={e => {
            const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 12)
            if (onPaymentReferenceChange) {
              onPaymentReferenceChange(val)
            }
          }}
          placeholder="e.g. 423984729103"
          style={{
            width: '100%',
            minHeight: '44px',
            background: 'var(--bg-input)',
            border: isUtrComplete ? '1.5px solid #10b981' : '1px solid var(--line)',
            borderRadius: '8px',
            color: 'var(--text-main)',
            padding: '0 12px',
            fontSize: '14px',
            fontFamily: "'DM Mono', monospace",
            letterSpacing: '1.5px',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxSizing: 'border-box',
          }}
        />

        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>
          Found in your PhonePe / UPI app under <b>Transaction Details → UTR / UPI Ref ID</b>.
        </small>
      </div>
    </div>
  )
}
