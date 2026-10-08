/**
 * Generates and downloads an official high-resolution ID Pass image (ID Pass.png)
 * containing the newly created student's login credentials and profile details.
 *
 * @param {Object} student
 * @param {string} student.name
 * @param {string} student.college
 * @param {string} student.branch
 * @param {string} [student.specialization]
 * @param {string} student.memberId
 * @param {string} student.password
 * @returns {Promise<string>} dataUrl of the generated image
 */
export async function downloadIdPass(student) {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 620
  const ctx = canvas.getContext('2d')

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1000, 620)
  bgGrad.addColorStop(0, '#060a12')
  bgGrad.addColorStop(0.5, '#0b1424')
  bgGrad.addColorStop(1, '#08111d')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, 1000, 620)

  // Outer glowing tech border
  ctx.strokeStyle = '#204161'
  ctx.lineWidth = 2
  ctx.strokeRect(20, 20, 960, 580)

  ctx.strokeStyle = '#52bbf544'
  ctx.lineWidth = 1
  ctx.strokeRect(26, 26, 948, 568)

  // Corner decorative accents
  const corners = [
    [20, 20],
    [980, 20],
    [20, 600],
    [980, 600],
  ]
  ctx.strokeStyle = '#70ddb4'
  ctx.lineWidth = 3
  for (const [cx, cy] of corners) {
    ctx.beginPath()
    const dx = cx === 20 ? 1 : -1
    const dy = cy === 20 ? 1 : -1
    ctx.moveTo(cx, cy + dy * 24)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + dx * 24, cy)
    ctx.stroke()
  }

  // Header Bar
  const headerGrad = ctx.createLinearGradient(30, 30, 970, 30)
  headerGrad.addColorStop(0, 'rgba(82, 187, 245, 0.12)')
  headerGrad.addColorStop(1, 'rgba(112, 221, 180, 0.05)')
  ctx.fillStyle = headerGrad
  ctx.fillRect(30, 30, 940, 90)

  // Header branding text
  ctx.fillStyle = '#70ddb4'
  ctx.font = '600 13px monospace'
  ctx.fillText('● OFFICIAL STUDENT COMMUNITY · MRDU', 55, 60)

  ctx.fillStyle = '#edf7ff'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('CYBER SECURITY CLUB — STUDENT ID PASS', 55, 92)

  // Header Badge (Right side)
  ctx.fillStyle = 'rgba(112, 221, 180, 0.15)'
  ctx.strokeStyle = '#70ddb4'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(760, 50, 190, 48, 8)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#70ddb4'
  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('PORTAL ACCESS PASS', 855, 72)
  ctx.font = '500 10px monospace'
  ctx.fillStyle = '#9ed9ff'
  ctx.fillText('AUTHENTICATED ID', 855, 87)
  ctx.textAlign = 'left'

  // Decorative divider line
  ctx.strokeStyle = '#1e3850'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40, 135)
  ctx.lineTo(960, 135)
  ctx.stroke()

  // Left Column: Student Details
  ctx.fillStyle = '#6586a1'
  ctx.font = '600 11px monospace'
  ctx.fillText('STUDENT NAME', 55, 170)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(student.name || 'Student', 55, 198)

  ctx.fillStyle = '#6586a1'
  ctx.font = '600 11px monospace'
  ctx.fillText('INSTITUTION / COLLEGE', 55, 240)

  ctx.fillStyle = '#e1effa'
  ctx.font = '500 16px sans-serif'
  const collegeText = student.college || 'Malla Reddy (MR) Deemed to be University'
  ctx.fillText(collegeText.length > 40 ? collegeText.slice(0, 38) + '…' : collegeText, 55, 266)

  ctx.fillStyle = '#6586a1'
  ctx.font = '600 11px monospace'
  ctx.fillText('BRANCH, YEAR & SPECIALIZATION', 55, 310)

  ctx.fillStyle = '#e1effa'
  ctx.font = '500 16px sans-serif'
  const specText = student.specialization ? ` (${student.specialization})` : ''
  const yearText = student.year ? ` · Year ${student.year}` : ''
  ctx.fillText(`${student.branch || 'CSE'}${yearText}${specText}`, 55, 336)

  // Right Column: Official Credentials Box
  const credX = 540
  const credY = 155
  const credW = 410
  const credH = 340

  const credGrad = ctx.createLinearGradient(credX, credY, credX + credW, credY + credH)
  credGrad.addColorStop(0, '#091524')
  credGrad.addColorStop(1, '#0d1f35')
  ctx.fillStyle = credGrad
  ctx.fillRect(credX, credY, credW, credH)

  ctx.strokeStyle = '#52bbf566'
  ctx.lineWidth = 1.5
  ctx.strokeRect(credX, credY, credW, credH)

  // Credential Header
  ctx.fillStyle = 'rgba(82, 187, 245, 0.2)'
  ctx.fillRect(credX, credY, credW, 42)
  ctx.fillStyle = '#85d7ff'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('[ ACCESS ] OFFICIAL PORTAL CREDENTIALS', credX + 20, credY + 26)

  // Member ID Box
  ctx.fillStyle = '#7e9db8'
  ctx.font = '600 11px monospace'
  ctx.fillText('ROLL NUMBER / USER ID', credX + 20, credY + 75)

  ctx.fillStyle = '#060e18'
  ctx.fillRect(credX + 20, credY + 85, credW - 40, 52)
  ctx.strokeStyle = '#52bbf5'
  ctx.lineWidth = 1
  ctx.strokeRect(credX + 20, credY + 85, credW - 40, 52)

  ctx.fillStyle = '#85d7ff'
  ctx.font = 'bold 22px monospace'
  ctx.fillText(student.memberId || 'GUEST2026001', credX + 35, credY + 120)

  // Password Box
  ctx.fillStyle = '#7e9db8'
  ctx.font = '600 11px monospace'
  ctx.fillText('ACCOUNT PASSWORD', credX + 20, credY + 170)

  ctx.fillStyle = '#060e18'
  ctx.fillRect(credX + 20, credY + 180, credW - 40, 52)
  ctx.strokeStyle = '#70ddb4'
  ctx.lineWidth = 1
  ctx.strokeRect(credX + 20, credY + 180, credW - 40, 52)

  ctx.fillStyle = '#70ddb4'
  ctx.font = 'bold 20px monospace'
  ctx.fillText(student.password || '••••••••••••', credX + 35, credY + 215)

  // Security Note in Box
  ctx.fillStyle = '#9cb6cc'
  ctx.font = '11px sans-serif'
  ctx.fillText('• Please store this pass securely offline.', credX + 20, credY + 265)
  ctx.fillText('• Do not share your login credentials with anyone.', credX + 20, credY + 285)
  ctx.fillText('• Use these credentials to sign in anytime at the login page.', credX + 20, credY + 305)

  // Left Column Notice Box
  ctx.fillStyle = 'rgba(25, 45, 70, 0.4)'
  ctx.beginPath()
  ctx.roundRect(50, 370, 450, 125, 8)
  ctx.fill()
  ctx.strokeStyle = '#1e3850'
  ctx.stroke()

  ctx.fillStyle = '#85d7ff'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText('PORTAL PRIVILEGES & INSTRUCTIONS', 68, 396)

  ctx.fillStyle = '#8ea9be'
  ctx.font = '12px sans-serif'
  ctx.fillText('• Access Student Dashboard & Club Announcements', 68, 420)
  ctx.fillText('• View upcoming workshops, technical CTFs & webinars', 68, 442)
  ctx.fillText('• Register for eligible open & free cybersecurity events', 68, 464)
  ctx.fillText('• Offline credential backup verified by CSC Portal', 68, 484)

  // Footer bar
  ctx.fillStyle = '#04070c'
  ctx.fillRect(30, 520, 940, 70)
  ctx.strokeStyle = '#1a2e42'
  ctx.strokeRect(30, 520, 940, 70)

  ctx.fillStyle = '#6586a1'
  ctx.font = '500 11px monospace'
  ctx.fillText('SUPPORT / HELP DESK:', 50, 550)
  ctx.fillStyle = '#85d7ff'
  ctx.fillText('cyberclubmrdu2025@gmail.com', 200, 550)

  ctx.fillStyle = '#6586a1'
  ctx.fillText('DATE ISSUED:', 50, 572)
  ctx.fillStyle = '#edf7ff'
  ctx.fillText(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 145, 572)

  ctx.fillStyle = '#70ddb4'
  ctx.textAlign = 'right'
  ctx.font = 'bold 11px monospace'
  ctx.fillText('OFFICIAL CYBER SECURITY CLUB DOCUMENT · VERIFIED', 950, 560)
  ctx.textAlign = 'left'

  // Convert to image blob and trigger download as "ID Pass.png"
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'ID Pass.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        resolve(canvas.toDataURL('image/png'))
      } else {
        const dataUrl = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = 'ID Pass.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        resolve(dataUrl)
      }
    }, 'image/png')
  })
}
