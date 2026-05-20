/**
 * Support service — /api/v1/contact/*
 *
 * Endpoints:
 *   POST /contact/submit  → Submit a contact / support ticket
 */
import api from './api'

const SupportService = {
  /**
   * Submit a contact or support ticket.
   *
   * @param {{ name: string, email: string, subject: string, message: string }} data
   * @returns {Promise<any>}
   */
  submitTicket: (data) => api.post('/contact/submit', data),
}

export default SupportService
