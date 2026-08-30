// ?? (not ||) matters here: production sets VITE_API_URL="" on purpose for
// same-origin relative requests, and "" is falsy so || would silently
// override it back to the local dev default.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || 'Request failed')
    this.status = status
    this.details = body?.details || null
  }
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : null

  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

export const communitiesApi = {
  list: () => request('/api/communities'),
}

export const authApi = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
}

export const staffAuthApi = {
  login: (payload) => request('/api/auth/staff-login', { method: 'POST', body: payload }),
}

export const residentsApi = {
  me: (token) => request('/api/residents/me', { token }),
  updateMe: (token, payload) => request('/api/residents/me', { method: 'PUT', token, body: payload }),
}

export const staffApi = {
  me: (token) => request('/api/staff/me', { token }),
  listResidents: (token) => request('/api/staff/residents', { token }),
  listContacts: (token) => request('/api/staff/contacts', { token }),
  getCommunity: (token) => request('/api/staff/community', { token }),
}

export const guestsApi = {
  list: (token, status) => request(`/api/guests${status ? `?status=${status}` : ''}`, { token }),
  create: (token, payload) => request('/api/guests', { method: 'POST', token, body: payload }),
  cancel: (token, id) => request(`/api/guests/${id}`, { method: 'PUT', token, body: { status: 'cancelled' } }),
  listGate: (token, status) => request(`/api/guests/gate${status ? `?status=${status}` : ''}`, { token }),
  checkIn: (token, id, idVerified) =>
    request(`/api/guests/${id}/checkin`, { method: 'POST', token, body: idVerified ? { id_verified: true } : {} }),
  checkOut: (token, id) => request(`/api/guests/${id}/checkout`, { method: 'POST', token }),
  listAdmin: (token, status) => request(`/api/guests/admin${status ? `?status=${status}` : ''}`, { token }),
  approve: (token, id) => request(`/api/guests/${id}/approve`, { method: 'POST', token }),
  deny: (token, id, reason) => request(`/api/guests/${id}/deny`, { method: 'POST', token, body: reason ? { reason } : {} }),
}

export const adminApi = {
  listResidents: (token, approved) =>
    request(`/api/admin/residents${approved !== undefined ? `?approved=${approved}` : ''}`, { token }),
  updateResidentApproval: (token, id, approved) =>
    request(`/api/admin/residents/${id}/approval`, { method: 'PUT', token, body: { approved } }),
  updateResidentRole: (token, id, role) =>
    request(`/api/admin/residents/${id}/role`, { method: 'PUT', token, body: { role } }),
  listStaff: (token) => request('/api/admin/staff', { token }),
  createStaff: (token, payload) => request('/api/admin/staff', { method: 'POST', token, body: payload }),
  getPolicy: (token) => request('/api/admin/policy', { token }),
  updatePolicy: (token, payload) => request('/api/admin/policy', { method: 'PUT', token, body: payload }),
  getCommunity: (token) => request('/api/admin/community', { token }),
  listContacts: (token) => request('/api/admin/contacts', { token }),
  createContact: (token, payload) => request('/api/admin/contacts', { method: 'POST', token, body: payload }),
  updateContact: (token, id, payload) => request(`/api/admin/contacts/${id}`, { method: 'PUT', token, body: payload }),
  deleteContact: (token, id) => request(`/api/admin/contacts/${id}`, { method: 'DELETE', token }),
}

export const platformAuthApi = {
  login: (payload) => request('/api/auth/platform-login', { method: 'POST', body: payload }),
}

export const platformApi = {
  me: (token) => request('/api/platform/me', { token }),
  listCommunities: (token) => request('/api/platform/communities', { token }),
  onboardCommunity: (token, payload) => request('/api/platform/communities', { method: 'POST', token, body: payload }),
  communityAuditLogs: (token, id) => request(`/api/platform/communities/${id}/audit-logs`, { token }),
  updateBillingStatus: (token, id, status) =>
    request(`/api/platform/communities/${id}/billing-status`, { method: 'PUT', token, body: { status } }),
  getSystemHealth: (token) => request('/api/platform/system-health', { token }),
}
