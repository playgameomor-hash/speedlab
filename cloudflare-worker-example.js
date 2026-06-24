/**
 * OPTIONAL: Self-hosted Cloudflare Worker speed-test backend.
 * ─────────────────────────────────────────────────────────────
 * The app works out-of-the-box using Cloudflare's public
 * speed.cloudflare.com endpoints — you do NOT need this file
 * to make the app functional.
 *
 * Deploy this only if you want your OWN dedicated endpoint
 * (e.g. to avoid potential rate-limits on the shared public one,
 * or to log/customize behavior).
 *
 * ── Deployment ──
 * 1. Install Wrangler:  npm install -g wrangler
 * 2. wrangler login
 * 3. wrangler deploy cloudflare-worker-example.js --name speedlab-backend
 * 4. Copy the resulting *.workers.dev URL into speedtest.js as CF_BASE
 *
 * This Worker replicates the same __down / __up / cdn-cgi/trace
 * contract that speedtest.js expects.
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // ── DOWNLOAD: returns N real random bytes ──
    if (url.pathname === '/__down') {
      const bytes = Math.min(parseInt(url.searchParams.get('bytes') || '0', 10), 26_000_000);
      const stream = new ReadableStream({
        start(controller) {
          const chunkSize = 65536;
          let sent = 0;
          while (sent < bytes) {
            const size = Math.min(chunkSize, bytes - sent);
            const chunk = new Uint8Array(size);
            crypto.getRandomValues(chunk);
            controller.enqueue(chunk);
            sent += size;
          }
          controller.close();
        }
      });
      return new Response(stream, {
        headers: { ...cors, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' }
      });
    }

    // ── UPLOAD: reads body, discards it, returns byte count ──
    if (url.pathname === '/__up' && request.method === 'POST') {
      const buf = await request.arrayBuffer();
      return new Response(JSON.stringify({ receivedBytes: buf.byteLength }), {
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    // ── TRACE: basic IP/connection info (mimics cdn-cgi/trace format) ──
    if (url.pathname === '/cdn-cgi/trace') {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const colo = request.cf && request.cf.colo ? request.cf.colo : 'unknown';
      const country = request.cf && request.cf.country ? request.cf.country : 'unknown';
      const body = `fl=worker\nip=${ip}\ncolo=${colo}\nloc=${country}\n`;
      return new Response(body, { headers: { ...cors, 'Content-Type': 'text/plain' } });
    }

    return new Response('SpeedLab Worker — endpoints: /__down, /__up, /cdn-cgi/trace', {
      headers: { ...cors, 'Content-Type': 'text/plain' }
    });
  }
};
