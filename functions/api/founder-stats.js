export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Count paid founders only (exclude comped/manual grants)
    const result = await env.DB.prepare(
      'SELECT COUNT(*) as claimed FROM founder_access WHERE is_comped = 0'
    ).first();

    const claimed = result?.claimed || 0;

    return new Response(JSON.stringify({
      claimed,
      limit: 50
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Founder stats error:', error);
    return new Response(JSON.stringify({
      claimed: 0,
      limit: 50
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}
