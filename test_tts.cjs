const http = require('http');

const data = JSON.stringify({
  text: 'سلام حالت چطوره؟',
  voice: 'Aoede',
  isMultiSpeaker: false
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/tts',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk.substring(0, 100)}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
