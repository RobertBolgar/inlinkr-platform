/**
 * Activity event logging helper for admin activity feed
 * 
 * This helper provides a non-blocking way to log platform events
 * to the activity_events table for admin visibility.
 * 
 * CRITICAL: This helper never throws and never blocks the main user flow.
 * If logging fails, it logs to console.error but does not affect the calling code.
 */

/**
 * Log an activity event to the activity_events table
 * @param {Object} env - Cloudflare environment with DB binding
 * @param {Object} eventData - Event data to log
 * @param {string} eventData.event_type - Type of event (e.g., 'user_signed_up')
 * @param {number} [eventData.actor_user_id] - ID of user who performed the action
 * @param {number} [eventData.target_user_id] - ID of user the action was performed on
 * @param {string} [eventData.event_title] - Human-readable title
 * @param {string} [eventData.event_description] - Detailed description
 * @param {string} [eventData.metadata_json] - JSON string with additional event data
 * @param {string} [eventData.severity] - Severity level (default: 'info')
 * @param {string} [eventData.visibility_scope] - Visibility scope (default: 'owner')
 */
export async function logActivityEvent(env, eventData) {
  try {
    const {
      event_type,
      actor_user_id = null,
      target_user_id = null,
      event_title = null,
      event_description = null,
      metadata_json = null,
      severity = 'info',
      visibility_scope = 'owner'
    } = eventData;

    // Generate unique ID for the event
    const eventId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Insert into activity_events table
    await env.DB.prepare(`
      INSERT INTO activity_events (
        id, event_type, actor_user_id, target_user_id,
        event_title, event_description, metadata_json,
        severity, visibility_scope, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      event_type,
      actor_user_id,
      target_user_id,
      event_title,
      event_description,
      metadata_json,
      severity,
      visibility_scope,
      createdAt
    ).run();

    // Success - silent, no console log needed for normal operation
  } catch (error) {
    // CRITICAL: Never throw, never block main flow
    // Log error for debugging but don't affect calling code
    console.error('[ACTIVITY LOGGING ERROR] Failed to log activity event:', error);
    console.error('[ACTIVITY LOGGING ERROR] Event data:', eventData);
  }
}
