const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
let csrfToken = null

function isStateChanging(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method || 'GET').toUpperCase())
}

async function obtainCsrfToken() {
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.csrfToken) throw new Error('Unable to initialize a secure session. Please refresh and try again.')
  csrfToken = body.csrfToken
}

async function request(path, options = {}, retried = false) {
  const method = (options.method || 'GET').toUpperCase()
  if (isStateChanging(method) && !csrfToken) await obtainCsrfToken()
  const { headers: suppliedHeaders, ...fetchOptions } = options
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(isStateChanging(method) ? { 'X-CSRF-Token': csrfToken } : {}), ...suppliedHeaders },
    ...fetchOptions,
  })

  if (response.status === 204) return {}
  const body = await response.json().catch(() => ({}))
  if (body.csrfToken) csrfToken = body.csrfToken
  if (response.status === 403 && body.message?.startsWith('Invalid request security token') && !retried) {
    csrfToken = null
    return request(path, options, true)
  }
  if (!response.ok) {
    throw new Error(body.message || 'Something went wrong. Please try again.')
  }
  return body
}

export function readImageFile(file, onLoad) {
  if (!file) return
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be 2 MB or smaller.')
  const reader = new FileReader()
  reader.onload = () => onLoad(String(reader.result || ''))
  reader.readAsDataURL(file)
}

export const authApi = {
  login: (memberId, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ memberId, password }) }),
  verifyTwoFactor: code => request('/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ code }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  logoutAllDevices: () => request('/auth/logout-all-devices', { method: 'POST' }),
  requestPasswordReset: memberId => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ memberId }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  startTwoFactorSetup: () => request('/auth/two-factor/setup', { method: 'POST' }),
  confirmTwoFactorSetup: code => request('/auth/two-factor/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  disableTwoFactor: (password, code) => request('/auth/two-factor/disable', { method: 'POST', body: JSON.stringify({ password, code }) }),
  me: () => request('/auth/me'),
}

export const adminApi = {
  // Members & Roles
  listMembers: () => request('/admin/members'),
  createMember: account => request('/admin/members', { method: 'POST', body: JSON.stringify(account) }),
  editMember: (id, data) => request(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMember: (id, authenticationCode) => request(`/admin/members/${id}`, { method: 'DELETE', body: JSON.stringify(authenticationCode ? { authenticationCode } : {}) }),
  updateMemberPermissions: (id, permissions) => request(`/admin/members/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  updateMemberStatus: (id, accountStatus) => request(`/admin/members/${id}/status`, { method: 'PUT', body: JSON.stringify({ accountStatus }) }),
  adminResetPassword: (id, newPassword) => request(`/admin/members/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  transferPresidentRole: (targetUserId, authenticationCode) => request('/admin/members/transfer-president', { method: 'POST', body: JSON.stringify({ targetUserId, authenticationCode }) }),

  // Events & Analytics
  listEvents: () => request('/admin/events'),
  createEvent: event => request('/admin/events', { method: 'POST', body: JSON.stringify(event) }),
  updateEvent: (eventId, event) => request(`/admin/events/${eventId}`, { method: 'PUT', body: JSON.stringify(event) }),
  deleteEvent: eventId => request(`/admin/events/${eventId}`, { method: 'DELETE' }),
  getEventDetailsWithStats: eventId => request(`/admin/events/${eventId}/details`),
  listEventRegistrations: eventId => request(`/admin/events/${eventId}/registrations`),

  // Payments
  listPayments: () => request('/admin/payments'),
  verifyPayment: (registrationId, paymentStatus, paymentNotes) => request(`/admin/payments/${registrationId}/verify`, { method: 'PUT', body: JSON.stringify({ paymentStatus, paymentNotes }) }),

  // Gallery
  listGalleryAlbums: () => request('/admin/gallery/albums'),
  createGalleryAlbum: album => request('/admin/gallery/albums', { method: 'POST', body: JSON.stringify(album) }),
  addGalleryPhoto: (albumId, photo) => request(`/admin/gallery/albums/${albumId}/photos`, { method: 'POST', body: JSON.stringify(photo) }),
  deleteGalleryAlbum: albumId => request(`/admin/gallery/albums/${albumId}`, { method: 'DELETE' }),

  // Team & Leadership
  listClubTeam: () => request('/admin/team'),
  createClubTeamMember: member => request('/admin/team', { method: 'POST', body: JSON.stringify(member) }),
  updateClubTeamMember: (memberId, member) => request(`/admin/team/${memberId}`, { method: 'PUT', body: JSON.stringify(member) }),
  deleteClubTeamMember: memberId => request(`/admin/team/${memberId}`, { method: 'DELETE' }),

  // Settings & Socials
  getClubSettings: () => request('/admin/settings'),
  updateClubSettings: settings => request('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Complaints & Audits
  listComplaints: () => request('/admin/complaints'),
  updateComplaintStatus: (complaintId, status) => request(`/admin/complaints/${complaintId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  listAuditLogs: () => request('/admin/audit-logs'),
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
}
