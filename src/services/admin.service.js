/**
 * Admin service — /api/v1/admin/*
 *
 * Endpoints (all require admin role):
 *   POST  /admin/blog          → Create a new blog post
 *   PATCH /admin/blog/{id}     → Update a blog post
 *   POST  /admin/events        → Create a new event / hackathon
 */
import api from './api'

const AdminService = {
  /**
   * Create a new blog post.
   *
   * @param {{ title: string, slug: string, content: string, published?: boolean }} data
   * @returns {Promise<{ post: object }>}
   */
  createBlogPost: (data) => api.post('/admin/blog', data),

  /**
   * Update an existing blog post.
   *
   * @param {string} id
   * @param {{ title?: string, slug?: string, content?: string, published?: boolean }} data
   * @returns {Promise<{ post: object }>}
   */
  updateBlogPost: (id, data) => api.patch(`/admin/blog/${id}`, data),

  /**
   * Create a new community event / hackathon.
   *
   * @param {{ name: string, description: string, starts_at: string, ends_at: string, location?: string }} data
   * @returns {Promise<{ event: object }>}
   */
  createEvent: (data) => api.post('/admin/events', data),
}

export default AdminService
