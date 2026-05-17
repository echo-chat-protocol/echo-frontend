/**
 * Status service — /api/v1/status/*
 *
 * Endpoints:
 *   GET /status/services  → Public service status snapshot
 *   GET /health           → Liveness probe
 */
import api from './api'

const StatusService = {
  /**
   * Get a snapshot of the health/availability of all backend services.
   *
   * @returns {Promise<{ services: Array<{ name: string, status: string }> }>}
   */
  getServicesStatus: () => api.get('/status/services'),

  /**
   * Simple liveness probe — returns HTTP 200 if the server is up.
   *
   * @returns {Promise<{ status: 'ok' }>}
   */
  health: () => api.get('/health'),
}

export default StatusService
