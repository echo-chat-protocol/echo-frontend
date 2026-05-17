/**
 * Contacts service — /api/v1/contacts/*
 *
 * Endpoints:
 *   POST /contacts/add-friend     → Add a user to the authenticated user's friend list
 *   POST /contacts/remove-friend  → Remove a user from the authenticated user's friend list
 */
import api from './api'

const ContactsService = {
  /**
   * Send a friend request / add a user to friend list.
   *
   * @param {{ user_id: string }} data
   * @returns {Promise<any>}
   */
  addFriend: (data) => api.post('/contacts/add-friend', data),

  /**
   * Remove a user from the friend list.
   *
   * @param {{ user_id: string }} data
   * @returns {Promise<any>}
   */
  removeFriend: (data) => api.post('/contacts/remove-friend', data),
}

export default ContactsService
