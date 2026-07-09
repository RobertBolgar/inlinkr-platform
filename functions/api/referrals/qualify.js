// Public referral qualification endpoint disabled for launch
// TODO: Future implementation must use a Worker-only shared secret or internal-only mechanism
// to prevent unauthenticated callers from triggering referral qualification or reward grants

export async function onRequestPost(context) {
  // Return 410 Gone to indicate this endpoint is permanently disabled
  return new Response(JSON.stringify({ 
    error: 'Referral qualification endpoint disabled' 
  }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  // Return 410 Gone to indicate this endpoint is permanently disabled
  return new Response(JSON.stringify({ 
    error: 'Referral qualification endpoint disabled' 
  }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  });
}
