/**
 * Community service — /api/v1/community/*
 *
 * Endpoints:
 *   GET  /community/events                      → List active community events
 *   POST /community/events/{eventId}/register   → Register authenticated user for an event (auth required)
 *   POST /community/subscribe                   → Subscribe to the "Sealed Mail" newsletter
 */
import api from './api'

const CommunityService = {
  /**
   * List all active community events (hackathons, meetups, etc.).
   *
   * @returns {Promise<{ events: Array<object> }>}
   */
  getEvents: () => api.get('/community/events'),

  /**
   * Register the authenticated user for a community event.
   *
   * @param {string} eventId
   * @returns {Promise<any>}
   */
  registerForEvent: (eventId) => api.post(`/community/events/${eventId}/register`, {}),

  /**
   * Subscribe an email address to the "Sealed Mail" newsletter.
   *
   * @param {{ email: string }} data
   * @returns {Promise<any>}
   */
  subscribeNewsletter: (data) => api.post('/community/subscribe', data),
}

export default CommunityService
