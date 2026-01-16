const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: 'localhost', port: 3000, path, timeout: 3000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function check() {
  try {
    const h = await get('/health');
    console.log('HEALTH:', h.status, '-', h.body);

    const w = await get('/words');
    let summary = w.body;
    try { const parsed = JSON.parse(w.body); summary = Array.isArray(parsed) ? `${parsed.length} items` : typeof parsed; } catch (e) {}
    console.log('/words:', w.status, '-', summary);
  } catch (err) {
    console.error('Request error:', err.message);
    process.exit(1);
  }
}

check();
