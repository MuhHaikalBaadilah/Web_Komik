// Cloudflare Worker: proxy CORS untuk voratoon.js (KomikuNow).
// Dipanggil dari browser: https://<worker>.workers.dev/?url=<alamat-voratoon-ter-encode>
//
// Pengaman:
//  - hanya GET, dan hanya host voratoon.com / *.voratoon.com (bukan open proxy)
//  - pengalihan diikuti maksimal 3 kali, dan setiap lompatan dicek ulang host-nya
//  - hanya origin di ALLOWED_ORIGINS yang diberi header CORS
//  - respons dibatasi 3 MB dan di-cache 5 menit di edge

// Hanya voratoon.com dan subdomainnya (situs memindahkan alamat, mis. v1. -> 13.).
const MAX_REDIRECTS = 3;
function hostAllowed(hostname) {
  return hostname === 'voratoon.com' || hostname.endsWith('.voratoon.com');
}
const ALLOWED_ORIGINS = [
  'https://muhhaikalbaadilah.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];
const MAX_BYTES = 3 * 1024 * 1024;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-expose-headers': 'x-final-url',
    'vary': 'Origin'
  };
}

function reply(status, text, origin) {
  return new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...(origin ? corsHeaders(origin) : {}) }
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const originOk = ALLOWED_ORIGINS.includes(origin);

    if (request.method === 'OPTIONS') {
      return originOk ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : reply(403, 'Origin tidak diizinkan');
    }
    if (request.method !== 'GET') return reply(405, 'Hanya GET', originOk && origin);
    if (!originOk) return reply(403, 'Origin tidak diizinkan');

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url') || '');
    } catch {
      return reply(400, 'Parameter url tidak valid', origin);
    }
    if (target.protocol !== 'https:' || !hostAllowed(target.hostname)) {
      return reply(403, 'Host tidak diizinkan', origin);
    }

    let upstream;
    try {
      for (let hop = 0; ; hop++) {
        upstream = await fetch(target.toString(), {
          headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          redirect: 'manual',
          cf: { cacheTtl: 300, cacheEverything: true }
        });
        if (upstream.status < 300 || upstream.status >= 400) break;
        if (hop >= MAX_REDIRECTS) return reply(502, 'Terlalu banyak pengalihan', origin);
        let next;
        try { next = new URL(upstream.headers.get('location') || '', target); } catch { return reply(502, 'Pengalihan tidak valid', origin); }
        if (next.protocol !== 'https:' || !hostAllowed(next.hostname)) return reply(502, 'Pengalihan ke host lain ditolak', origin);
        target = next;
      }
    } catch {
      return reply(502, 'Gagal menghubungi voratoon.com', origin);
    }

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return reply(502, 'Respons terlalu besar', origin);

    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'x-final-url': target.toString(),
        ...corsHeaders(origin)
      }
    });
  }
};
