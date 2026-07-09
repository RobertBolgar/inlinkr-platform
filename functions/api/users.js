// Legacy /api/users endpoint - DISABLED for security
// This endpoint was unused and leaked sensitive user data without authentication.
// Use /api/users/sync for user management with Clerk authentication.
//
// Frontend now uses:
// - /api/users/sync (authenticated user sync)
// - /api/users/username (username update)
// - /api/users/display-name (display name update)
// - /api/users/check-username (username availability check)

export async function onRequest(context) {
  return new Response(JSON.stringify({
    error: 'Legacy endpoint disabled. Use /api/users/sync for user management.'
  }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  });
}
