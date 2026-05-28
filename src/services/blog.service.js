/**
 * Blog service — /api/v1/blog/*
 *
 * Endpoints:
 *   GET /blog/posts/{slug}  → Get a published blog post by slug
 */
import api from './api'

const BlogService = {
  /**
   * Fetch a published blog post by its URL slug.
   *
   * @param {string} slug  e.g. "echo-v1-release-notes"
   * @returns {Promise<{ post: object }>}
   */
  getPostBySlug: (slug) => api.get(`/blog/posts/${slug}`),
}

export default BlogService
