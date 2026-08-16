async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('X-Requested-With', 'XMLHttpRequest')
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
  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed.')
    error.status = response.status
    error.code = payload.code
    error.hibernating = response.status === 503 || payload.code === 'SITE_HIBERNATING'
    throw error
  }
  return payload
}

export function readImageFile(file, callback) {
  const reader = new FileReader()
  reader.onload = e => callback(e.target?.result)
  reader.readAsDataURL(file)
}

export const authApi = {
  me: () => request('/auth/me'),
  login: (memberId, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ memberId, password }) }),
  verifyTwoFactor: code => request('/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ code }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  requestPasswordReset: memberId => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ memberId }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  startTwoFactorSetup: () => request('/auth/2fa/setup', { method: 'POST' }),
  confirmTwoFactorSetup: code => request('/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  disableTwoFactor: (password, code) => request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password, code }) }),
}

export const adminApi = {
  // Members
  listMembers: () => request('/admin/members'),
  createMember: member => request('/admin/members', { method: 'POST', body: JSON.stringify(member) }),
  editMember: (id, member) => request(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(member) }),
  updateMemberStatus: (id, accountStatus) => request(`/admin/members/${id}/status`, { method: 'PUT', body: JSON.stringify({ accountStatus }) }),
  deleteMember: id => request(`/admin/members/${id}`, { method: 'DELETE' }),
  adminResetPassword: (id, password) => request(`/admin/members/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  disableMemberTwoFactor: id => request(`/admin/members/${id}/disable-2fa`, { method: 'POST' }),
  transferPresidentRole: (targetUserId, authenticationCode) => request('/admin/members/transfer-president', { method: 'POST', body: JSON.stringify({ targetUserId, authenticationCode }) }),
  setPresidentMasterPin: (pin, password) => request('/admin/president/master-pin', { method: 'POST', body: JSON.stringify({ pin, password }) }),

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
  deleteGalleryAlbum: albumId => request(`/admin/gallery/albums/${albumId}`, { method: 'DELETE' }),
  deleteGalleryPhoto: (albumId, photoId) => request(`/admin/gallery/albums/${albumId}/photos/${photoId}`, { method: 'DELETE' }),

  // Team & Leadership
  listClubTeam: () => request('/admin/team'),
  createClubTeamMember: member => request('/admin/team', { method: 'POST', body: JSON.stringify(member) }),
  updateClubTeamMember: (memberId, member) => request(`/admin/team/${memberId}`, { method: 'PUT', body: JSON.stringify(member) }),
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
}

export const memberApi = {
  listEvents: () => request('/member/events'),
  getEventDetails: eventId => request(`/member/events/${eventId}`),
  registerForEvent: (eventId, registrationData) => request(`/member/events/${eventId}/register`, { method: 'POST', body: JSON.stringify(registrationData) }),
  listRegistrations: () => request('/member/registrations'),
  updateProfile: profile => request('/member/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  createComplaint: complaint => request('/member/complaints', { method: 'POST', body: JSON.stringify(complaint) }),
  listGallery: () => request('/member/gallery'),
  listClubTeam: () => request('/member/team'),
  getPublicClubSettings: () => request('/member/settings'),
  getSessionStatus: () => request('/member/session-status'),
  completeIntroVideo: () => request('/member/intro-video/complete', { method: 'POST' }),
  completeWaitingQueue: () => request('/member/waiting-queue/complete', { method: 'POST' }),
  getSubscriptionStatus: () => request('/member/subscription/status'),
  submitSubscription: data => request('/member/subscription/submit', { method: 'POST', body: JSON.stringify(data) }),

  // Helpdesk & Doubts
  listSupportTickets: () => request('/member/support'),
  createSupportTicket: ticket => request('/member/support', { method: 'POST', body: JSON.stringify(ticket) }),
  replySupportTicket: (ticketId, message) => request(`/member/support/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),

  // Notifications
  listNotifications: () => request('/member/notifications'),
  markNotificationRead: id => request(`/member/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/member/notifications/read-all', { method: 'POST' }),
}
