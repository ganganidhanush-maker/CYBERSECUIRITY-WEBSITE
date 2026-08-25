import { execSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function isPortOpen(port = 3306, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise(resolve => {
    const socket = new net.Socket()
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

export async function ensureLocalDatabase() {
  const isOpen = await isPortOpen(3306, '127.0.0.1', 800)
  if (isOpen) {
    return true
  }

  console.info('⚡ Local database is not active. Auto-starting local MariaDB service...')
  const psScript = path.join(__dirname, 'start-local-mariadb.ps1')
  if (fs.existsSync(psScript) && process.platform === 'win32') {
    try {
      execSync(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, {
        cwd: projectRoot,
        stdio: 'inherit',
        timeout: 25000,
      })
      return true
    } catch (err) {
      console.warn('⚠️ Could not auto-start local MariaDB:', err.message)
    }
  }
  return false
}

// If executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await ensureLocalDatabase()
}
