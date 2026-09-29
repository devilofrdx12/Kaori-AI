const http = require('https');
const apiKey = process.env.GOOGLE_GENERATIVE_AI_KEY;
if (!apiKey) {
    console.log('No API key');
    process.exit(1);
}
const data = JSON.stringify({
  contents: [{
    parts: [{ text: 'hello' }]
  }]
});
const options = {
  hostname: 'generativelanguage.googleapis.com',
  port: 443,
  path: '/v1beta/models/gemini-3.8-flash:generateContent?key=' + apiKey,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};
const req = http.request(options, (res) => {
  console.log('STATUS: ' + res.statusCode);
  res.on('data', (d) => process.stdout.write(d));
});
req.on('error', (e) => console.error(e));
req.write(data);
req.end();
