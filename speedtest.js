/**
 * SpeedLab — Real Speed Test Engine
 * ───────────────────────────────────
 * Uses Cloudflare's public speed-test infrastructure to measure
 * REAL ping, jitter, download, and upload speeds. No simulated data.
 *
 * Endpoints (Cloudflare's speed.cloudflare.com — same ones their
 * official speed test page uses):
 *   GET  https://speed.cloudflare.com/__down?bytes=N   -> download N bytes
 *   POST https://speed.cloudflare.com/__up              -> upload body, measure time
 *   GET  https://speed.cloudflare.com/cdn-cgi/trace      -> IP/colo/connection info (text)
 *
 * IP/ISP lookup fallback: https://ipapi.co/json/  (free, no key required)
 */

const SpeedTest = (() => {

  const CF_BASE = 'https://speed.cloudflare.com';
  const DOWN_URL = (bytes) => `${CF_BASE}/__down?bytes=${bytes}`;
  const UP_URL = `${CF_BASE}/__up`;
  const TRACE_URL = `${CF_BASE}/cdn-cgi/trace`;
  const IP_FALLBACK_URL = 'https://ipapi.co/json/';

  let aborted = false;

  function abort() { aborted = true; }
  function resetAbort() { aborted = false; }

  /**
   * Measure ping + jitter by firing small HEAD-equivalent requests
   * (tiny 0-byte download) and timing the round trip.
   */
  async function measurePing(samples = 6, onSample) {
    const times = [];
    for (let i = 0; i < samples; i++) {
      if (aborted) break;
      const t0 = performance.now();
      try {
        await fetch(DOWN_URL(0) + `&t=${Date.now()}_${i}`, {
          cache: 'no-store',
          mode: 'cors'
        });
        const t1 = performance.now();
        const rtt = t1 - t0;
        times.push(rtt);
        if (onSample) onSample(rtt, i, samples);
      } catch (e) {
        // network hiccup — skip this sample
      }
      await sleep(80);
    }
    if (times.length === 0) {
      throw new Error('PING_FAILED');
    }
    times.sort((a, b) => a - b);
    // Use median for stability, trim outliers
    const trimmed = times.length > 3 ? times.slice(1, -1) : times;
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    const jitter = trimmed.length > 1
      ? trimmed.reduce((sum, v, i, arr) => i === 0 ? 0 : sum + Math.abs(v - arr[i - 1]), 0) / (trimmed.length - 1)
      : 0;
    return { ping: Math.round(avg), jitter: Math.round(jitter), samples: times };
  }

  /**
   * Measure download speed by fetching real chunks of increasing size
   * and computing throughput from actual bytes-received / time-elapsed.
   */
  async function measureDownload(opts = {}) {
    const {
      durationMs = 8000,
      onProgress, // (mbps, totalBytes, elapsedMs) => void
    } = opts;

    const chunkSizes = [500000, 1000000, 2000000, 4000000, 4000000, 4000000, 4000000]; // bytes, ramps up
    let totalBytes = 0;
    const t0 = performance.now();
    let peakMbps = 0;
    let lastMbps = 0;
    let chunkIdx = 0;

    while (performance.now() - t0 < durationMs) {
      if (aborted) break;
      const size = chunkSizes[Math.min(chunkIdx, chunkSizes.length - 1)];
      chunkIdx++;
      const chunkStart = performance.now();

      try {
        const res = await fetch(DOWN_URL(size) + `&cb=${Date.now()}`, {
          cache: 'no-store',
          mode: 'cors'
        });
        const reader = res.body.getReader();
        let chunkBytes = 0;

        while (true) {
          if (aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          chunkBytes += value.length;
          totalBytes += value.length;

          const elapsed = (performance.now() - t0) / 1000;
          if (elapsed > 0.15) {
            const mbps = (totalBytes * 8) / elapsed / 1_000_000;
            lastMbps = mbps;
            if (mbps > peakMbps) peakMbps = mbps;
            if (onProgress) onProgress(mbps, totalBytes, performance.now() - t0);
          }
        }
      } catch (e) {
        if (aborted) break;
        // continue to next chunk on transient errors
      }

      if (performance.now() - t0 >= durationMs) break;
    }

    const totalElapsed = (performance.now() - t0) / 1000;
    const avgMbps = totalElapsed > 0 ? (totalBytes * 8) / totalElapsed / 1_000_000 : 0;

    return {
      mbps: Math.max(avgMbps, lastMbps * 0.85), // favor sustained throughput
      peakMbps,
      totalBytes,
      durationSec: totalElapsed
    };
  }

  /**
   * Measure upload speed by POSTing real random-byte payloads
   * and computing throughput from actual bytes-sent / time-elapsed.
   */
  async function measureUpload(opts = {}) {
    const {
      durationMs = 6000,
      onProgress,
    } = opts;

    const chunkSizes = [250000, 500000, 1000000, 1500000, 1500000, 1500000];
    let totalBytes = 0;
    const t0 = performance.now();
    let peakMbps = 0;
    let lastMbps = 0;
    let chunkIdx = 0;

    while (performance.now() - t0 < durationMs) {
      if (aborted) break;
      const size = chunkSizes[Math.min(chunkIdx, chunkSizes.length - 1)];
      chunkIdx++;

      const payload = new Uint8Array(size);
      // Fill with pseudo-random data (crypto.getRandomValues caps at 65536 per call)
      for (let off = 0; off < size; off += 65536) {
        const slice = payload.subarray(off, Math.min(off + 65536, size));
        crypto.getRandomValues(slice);
      }

      const reqStart = performance.now();
      try {
        await fetch(UP_URL, {
          method: 'POST',
          body: payload,
          cache: 'no-store',
          mode: 'cors'
        });
        const reqEnd = performance.now();
        totalBytes += size;

        const elapsed = (performance.now() - t0) / 1000;
        if (elapsed > 0.1) {
          const mbps = (totalBytes * 8) / elapsed / 1_000_000;
          lastMbps = mbps;
          if (mbps > peakMbps) peakMbps = mbps;
          if (onProgress) onProgress(mbps, totalBytes, performance.now() - t0);
        }
      } catch (e) {
        if (aborted) break;
      }

      if (performance.now() - t0 >= durationMs) break;
    }

    const totalElapsed = (performance.now() - t0) / 1000;
    const avgMbps = totalElapsed > 0 ? (totalBytes * 8) / totalElapsed / 1_000_000 : 0;

    return {
      mbps: Math.max(avgMbps, lastMbps * 0.85),
      peakMbps,
      totalBytes,
      durationSec: totalElapsed
    };
  }

  /**
   * Get real public IP, ISP, city, country via Cloudflare trace endpoint
   * (fast, always available) with ipapi.co as a richer fallback.
   */
  async function getNetworkInfo() {
    // First try Cloudflare's trace endpoint — gives IP + colo (edge location) instantly
    try {
      const res = await fetch(TRACE_URL, { cache: 'no-store' });
      const text = await res.text();
      const data = {};
      text.trim().split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx > -1) data[line.slice(0, idx)] = line.slice(idx + 1);
      });

      const result = {
        ip: data.ip || null,
        colo: data.colo || null,    // Cloudflare edge datacenter code (e.g. "DAC" = Dhaka)
        loc: data.loc || null,      // 2-letter country code
        isp: null,
        city: null,
        country: data.loc || null,
      };

      // Enrich with ISP name + city via ipapi.co (best-effort, may fail/rate-limit)
      try {
        const res2 = await fetch(IP_FALLBACK_URL, { cache: 'no-store' });
        if (res2.ok) {
          const j = await res2.json();
          result.isp = j.org || j.asn || null;
          result.city = j.city || null;
          result.country = j.country_name || result.country;
          result.ip = j.ip || result.ip;
        }
      } catch (e) { /* non-fatal — keep trace data */ }

      return result;
    } catch (e) {
      // Total fallback: try ipapi.co alone
      try {
        const res2 = await fetch(IP_FALLBACK_URL, { cache: 'no-store' });
        const j = await res2.json();
        return {
          ip: j.ip,
          isp: j.org || j.asn || null,
          city: j.city || null,
          country: j.country_name || null,
          colo: null,
        };
      } catch (e2) {
        throw new Error('NETWORK_INFO_FAILED');
      }
    }
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  return {
    measurePing,
    measureDownload,
    measureUpload,
    getNetworkInfo,
    abort,
    resetAbort,
  };
})();
