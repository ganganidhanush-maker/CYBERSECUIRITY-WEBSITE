let currentCsrfToken = null

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('X-Requested-With', 'XMLHttpRequest')
  if (currentCsrfToken && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', currentCsrfToken)
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  if (response.status === 204) return {}

  const payload = await response.json().catch(() => ({}))
  if (payload.csrfToken) {
    currentCsrfToken = payload.csrfToken
  }
  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed.')
    error.status = response.status
    error.code = payload.code
    error.hibernating = response.status === 503 || payload.code === 'SITE_HIBERNATING'
    throw error
  }
  return payload
}

/**
 * Compresses and scales high-resolution images client-side before upload.
 * Reduces 5MB-25MB camera photos down to crisp ~300KB-800KB web images.
 */
export function compressImage(file, { maxDimension = 2048, quality = 0.88 } = {}) {
  return new Promise((resolve) => {
    if (!file) return resolve(null)
    
    // In SSR or non-browser environments or if not an image, fall back to FileReader
    if (typeof window === 'undefined' || typeof document === 'undefined' || !file.type || !file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
      return
    }

    // Small SVG or lightweight images under 250KB can be read directly
    if (file.type === 'image/svg+xml' || (file.size < 250 * 1024 && !file.type.includes('tiff') && !file.type.includes('bmp'))) {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
      return
    }

    try {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        let { width, height } = img

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target?.result)
          reader.readAsDataURL(file)
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const dataUrl = canvas.toDataURL(outputType, quality)
        resolve(dataUrl)
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        const reader = new FileReader()
        reader.onload = e => resolve(e.target?.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(file)
      }

      img.src = objectUrl
    } catch {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
  })
}

export function readImageFile(file, callback) {
  if (!file) return
  compressImage(file)
    .then(dataUrl => {
      if (dataUrl && callback) callback(dataUrl)
    })
    .catch(() => {
      const reader = new FileReader()
      reader.onload = e => callback && callback(e.target?.result)
      reader.readAsDataURL(file)
    })
}

export async function readMultipleImageFiles(fileList) {
  const files = Array.from(fileList || [])
  return Promise.all(
    files.map(async file => {
      const dataUrl = await compressImage(file)
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
      }
    })
  )
}

export const authApi = {
  me: () => request('/auth/me'),
  getPublicSettings: () => request('/auth/public-settings'),
  login: (memberId, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ memberId, password }) }),
  registerGuest: payload => request('/auth/register-guest', { method: 'POST', body: JSON.stringify(payload) }),
  verifyTwoFactor: code => request('/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ code }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  requestPasswordReset: memberId => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ memberId }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  startTwoFactorSetup: () => request('/auth/two-factor/setup', { method: 'POST' }),
  confirmTwoFactorSetup: code => request('/auth/two-factor/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  disableTwoFactor: (password, code) => request('/auth/two-factor/disable', { method: 'POST', body: JSON.stringify({ password, code }) }),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  logoutAllSessions: () => request('/auth/logout-all-devices', { method: 'POST' }),
}

export const adminApi = {
  // Members
  listMembers: () => request('/admin/members'),
  createMember: member => request('/admin/members', { method: 'POST', body: JSON.stringify(member) }),
  bulkCreateMembers: students => request('/admin/members/bulk', { method: 'POST', body: JSON.stringify({ students }) }),
  editMember: (id, member) => request(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(member) }),
  updateMemberStatus: (id, accountStatus) => request(`/admin/members/${id}/status`, { method: 'PUT', body: JSON.stringify({ accountStatus }) }),
  deleteMember: id => request(`/admin/members/${id}`, { method: 'DELETE' }),
  adminResetPassword: (id, newPassword) => request(`/admin/members/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword, password: newPassword }) }),
  disableMemberTwoFactor: id => request(`/admin/members/${id}/disable-2fa`, { method: 'POST' }),
  transferPresidentRole: (targetUserId, authenticationCode) => request('/admin/members/transfer-president', { method: 'POST', body: JSON.stringify({ targetUserId, authenticationCode }) }),
  setPresidentMasterPin: (pin, password) => request('/admin/president/master-pin', { method: 'POST', body: JSON.stringify({ pin, password }) }),
  getPresidentDirectives: () => request('/admin/president-directives'),
  updatePresidentDirectives: data => request('/admin/president-directives', { method: 'PUT', body: JSON.stringify(data) }),
  togglePresidentDirectiveTodo: (todoId, completed) => request(`/admin/president-directives/todos/${todoId}/toggle`, { method: 'PATCH', body: JSON.stringify({ completed }) }),

  // Events
  listEvents: () => request('/admin/events'),
  createEvent: event => request('/admin/events', { method: 'POST', body: JSON.stringify(event) }),
  updateEvent: (eventId, event) => request(`/admin/events/${eventId}`, { method: 'PUT', body: JSON.stringify(event) }),
  deleteEvent: eventId => request(`/admin/events/${eventId}`, { method: 'DELETE' }),
  getEventDetailsWithStats: eventId => request(`/admin/events/${eventId}/details`),
  listEventRegistrations: eventId => request(`/admin/events/${eventId}/registrations`),

  // Payments & Subscriptions
  listPayments: () => request('/admin/payments'),
  verifyPayment: (registrationId, paymentStatus) => request(`/admin/payments/${registrationId}/verify`, { method: 'PUT', body: JSON.stringify({ paymentStatus }) }),
  listSubscriptions: () => request('/admin/subscriptions'),
  verifySubscription: id => request(`/admin/subscriptions/${id}/verify`, { method: 'PUT' }),
  rejectSubscription: (id, rejectionReason) => request(`/admin/subscriptions/${id}/reject`, { method: 'PUT', body: JSON.stringify({ rejectionReason }) }),

  // Gallery
  listGalleryAlbums: () => request('/admin/gallery/albums'),
  createGalleryAlbum: album => request('/admin/gallery/albums', { method: 'POST', body: JSON.stringify(album) }),
  addGalleryPhoto: (albumId, photo) => request(`/admin/gallery/albums/${albumId}/photos`, { method: 'POST', body: JSON.stringify(photo) }),
  addGalleryPhotos: (albumId, photos) => request(`/admin/gallery/albums/${albumId}/photos`, { method: 'POST', body: JSON.stringify({ photos }) }),
  deleteGalleryAlbum: albumId => request(`/admin/gallery/albums/${albumId}`, { method: 'DELETE' }),
  deleteGalleryPhoto: (albumId, photoId) => request(`/admin/gallery/albums/${albumId}/photos/${photoId}`, { method: 'DELETE' }),

  // Team & Leadership
  listClubTeam: () => request('/admin/team'),
  syncClubTeamFromAccounts: () => request('/admin/team/sync-accounts', { method: 'POST' }),
  createClubTeamMember: member => request('/admin/team', { method: 'POST', body: JSON.stringify(member) }),
  updateClubTeamMember: (memberId, member) => request(`/admin/team/${memberId}`, { method: 'PUT', body: JSON.stringify(member) }),
  reorderClubTeam: orderedIds => request('/admin/team/reorder', { method: 'PUT', body: JSON.stringify({ orderedIds }) }),
  deleteClubTeamMember: memberId => request(`/admin/team/${memberId}`, { method: 'DELETE' }),

  // Settings & Socials
  getClubSettings: () => request('/admin/settings'),
  updateClubSettings: settings => request('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Helpdesk & Doubts
  listSupportTickets: () => request('/admin/support'),
  replySupportTicket: (ticketId, message, status) => request(`/admin/support/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ message, status }) }),
  updateSupportTicketStatus: (ticketId, status) => request(`/admin/support/${ticketId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Executive Council Chat (Leads Only)
  listCouncilMessages: () => request('/admin/chat/messages'),
  sendCouncilMessage: message => request('/admin/chat/messages', { method: 'POST', body: JSON.stringify({ message }) }),

  // Complaints & Audits
  listComplaints: () => request('/admin/complaints'),
  updateComplaintStatus: (complaintId, status) => request(`/admin/complaints/${complaintId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  listAuditLogs: () => request('/admin/audit-logs'),
  clearAuditLogs: authCode => request('/admin/audit-logs/clear', { method: 'POST', body: JSON.stringify({ authCode }) }),

  // Campus & Event Reels Studio
  listReels: () => request('/admin/reels'),
  createReel: reelData => request('/admin/reels', { method: 'POST', body: JSON.stringify(reelData) }),
  importProfileReels: profileData => request('/admin/reels/import-profile', { method: 'POST', body: JSON.stringify(profileData) }),
  updateReel: (id, reelData) => request(`/admin/reels/${id}`, { method: 'PUT', body: JSON.stringify(reelData) }),
  deleteReel: id => request(`/admin/reels/${id}`, { method: 'DELETE' }),

  // QR Code Scanner & Event Entry
  scanQrCode: async code => {
    try {
      return await request(`/admin/qr/scan?code=${encodeURIComponent(code)}`)
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        try {
          return await request(`/member/qr/scan?code=${encodeURIComponent(code)}`)
        } catch (mErr) {
          throw mErr
        }
      }
      throw err
    }
  },
  grantEventEntry: async registrationId => {
    try {
      return await request('/admin/qr/grant-entry', { method: 'POST', body: JSON.stringify({ registrationId }) })
    } catch (err) {
      if (err.status === 403) {
        return await request('/member/qr/grant-entry', { method: 'POST', body: JSON.stringify({ registrationId }) })
      }
      throw err
    }
  },
  listAllPasses: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/admin/passes${q ? '?' + q : ''}`)
  },
  verifyPassPayment: registrationId => request(`/admin/passes/${registrationId}/verify-payment`, { method: 'POST' }),
}

export const memberApi = {
  listEvents: () => request('/member/events'),
  getEventDetails: eventId => request(`/member/events/${eventId}`),
  registerForEvent: (eventId, registrationData) => request(`/member/events/${eventId}/register`, { method: 'POST', body: JSON.stringify(registrationData) }),
  listRegistrations: () => request('/member/registrations'),
  updateProfile: profile => request('/member/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  createComplaint: complaint => request('/member/complaints', { method: 'POST', body: JSON.stringify(complaint) }),
  listGallery: () => request('/member/gallery'),
  getGalleryAlbum: albumId => request(`/member/gallery/${albumId}`),
  listClubTeam: () => request('/member/team'),
  getPublicClubSettings: () => request('/auth/public-settings'),
  getSessionStatus: () => request('/member/session-status'),
  completeIntroVideo: () => request('/member/intro-video/complete', { method: 'POST' }),
  completeWaitingQueue: () => request('/member/waiting-queue/complete', { method: 'POST' }),
  getSubscriptionStatus: () => request('/member/subscription/status'),
  submitSubscription: data => request('/member/subscription/submit', { method: 'POST', body: JSON.stringify(data) }),

  // Team Participation & Formation
  lookupMember: memberId => request(`/member/members/lookup/${encodeURIComponent(memberId)}`),
  createEventTeam: (eventId, data) => request(`/member/events/${eventId}/teams`, { method: 'POST', body: JSON.stringify(data) }),
  respondTeamInvite: (inviteId, accept) => request(`/member/teams/invites/${inviteId}/respond`, { method: 'POST', body: JSON.stringify({ accept }) }),
  removeTeamMember: (teamId, memberId) => request(`/member/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }),
  listMyTeamInvites: () => request('/member/teams/my-invites'),

  // Helpdesk & Doubts
  listSupportTickets: () => request('/member/support'),
  createSupportTicket: ticket => request('/member/support', { method: 'POST', body: JSON.stringify(ticket) }),
  replySupportTicket: (ticketId, message) => request(`/member/support/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),

  // Notifications
  listNotifications: () => request('/member/notifications'),
  markNotificationRead: id => request(`/member/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/member/notifications/read-all', { method: 'POST' }),

  // Campus Reels Stream
  listReels: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/member/reels${q ? '?' + q : ''}`)
  },
  likeReel: id => request(`/member/reels/${id}/like`, { method: 'POST' }),
  recordReelView: id => request(`/member/reels/${id}/view`, { method: 'POST' }),
}
