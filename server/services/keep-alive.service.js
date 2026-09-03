import { env } from '../config/env.js'

/**
 * 24/7 Keep-Alive Service for Free Tier Container Platforms (Render, Railway, etc.)
 *
 * Render spins down free web services after 15 minutes of inactivity.
 * This background service makes an external HTTP request every 8 minutes,
 * ensuring Render's ingress router continuously detects live traffic
 * so the server NEVER hibernates or suffers 50-second cold starts.
 */
export function startKeepAliveService() {
  const intervalMs = 8 * 60 * 1000 // Every 8 minutes (Render sleeps at 15 min)

  const candidateUrls = [
    process.env.RENDER_EXTERNAL_URL,
    process.env.PUBLIC_APP_URL,
    'https://cybersecuirity-website.onrender.com',
  ].filter(Boolean)

  const targetUrl = candidateUrls[0] ? `${candidateUrls[0].replace(/\/+$/, '')}/api/health` : null

  async function pingSelf() {
    if (!targetUrl) return
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CyberSecurityClub-KeepAlive/2.0',
          'Cache-Control': 'no-cache',
        },
      })
      clearTimeout(timeout)

      if (response.ok) {
        console.info(`[KEEP-ALIVE] Pinged ${targetUrl} (HTTP ${response.status}) — Server active and warm.`)
      } else {
        console.warn(`[KEEP-ALIVE] Ping response was HTTP ${response.status} from ${targetUrl}`)
      }
    } catch (err) {
      console.warn(`[KEEP-ALIVE] Heartbeat ping attempt failed: ${err.message}. Will retry in 8 minutes.`)
    }
  }

  // Run initial ping 1 minute after server boot to allow full startup
  const initialTimer = setTimeout(pingSelf, 60_000)
  const recurringTimer = setInterval(pingSelf, intervalMs)

  return {
    stop() {
      clearTimeout(initialTimer)
      clearInterval(recurringTimer)
    },
  }
}
