const http = require('http');

const payload = JSON.stringify({
  havens: [],
  hospitals: [],
  scouts: [{ lat: 18.9, lon: 72.8 }],
  rescues: []
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 8000,
  path: '/api/simulation/deploy_units',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
}, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
  });
});

req.on('error', e => console.error(e));
req.write(payload);
req.end();
