const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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
}

export const guestsApi = {
  list: (token, status) => request(`/api/guests${status ? `?status=${status}` : ''}`, { token }),
  create: (token, payload) => request('/api/guests', { method: 'POST', token, body: payload }),
  cancel: (token, id) => request(`/api/guests/${id}`, { method: 'PUT', token, body: { status: 'cancelled' } }),
  listGate: (token, status) => request(`/api/guests/gate${status ? `?status=${status}` : ''}`, { token }),
  checkIn: (token, id) => request(`/api/guests/${id}/checkin`, { method: 'POST', token }),
  checkOut: (token, id) => request(`/api/guests/${id}/checkout`, { method: 'POST', token }),
}
