/**
 * Calls service — /api/v1/calls/*
 *
 * Endpoints (all require auth):
 *   POST /calls/initiate    → Initiate a call
 *   POST /calls/accept      → Accept an incoming call
 *   POST /calls/decline     → Decline an incoming call
 *   POST /calls/end         → End an active call
 *   POST /calls/media-state → Update audio/video media state
 */
import api from './api'

const CallsService = {
  /**
   * Initiate a call with another user.
   *
   * @param {{ target_user_id: string, call_type: 'audio' | 'voice' | 'video' }} data
   * @returns {Promise<{ call_id: string }>}
   */
  initiate: (data) => api.post('/calls/initiate', data),

  /**
   * Accept an incoming call.
   *
   * @param {{ call_id: string }} data
   * @returns {Promise<any>}
   */
  accept: (data) => api.post('/calls/accept', data),

  /**
   * Decline an incoming call.
   *
   * @param {{ call_id: string }} data
   * @returns {Promise<any>}
   */
  decline: (data) => api.post('/calls/decline', data),

  /**
   * End an active call.
   *
   * @param {{ call_id: string }} data
   * @returns {Promise<any>}
   */
  end: (data) => api.post('/calls/end', data),

  /**
   * Update audio/video media state during an active call.
   *
   * @param {{ call_id: string, audio_enabled: boolean, video_enabled: boolean }} data
   * @returns {Promise<any>}
   */
  updateMediaState: (data) => api.post('/calls/media-state', data),
}

export default CallsService
