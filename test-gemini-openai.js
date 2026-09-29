const http = require('https');
const apiKey = process.env.GOOGLE_GENERATIVE_AI_KEY;
if (!apiKey) {
    console.log('No API key');
    process.exit(1);
}
const data = JSON.stringify({
  model: 'gemini-3.5-flash',
  messages: [{ role: 'user', content: 'hello' }]
});
const options = {
  hostname: 'generativelanguage.googleapis.com',
  port: 443,
  path: '/v1beta/openai/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(options, (res) => {
  console.log('STATUS: ' + res.statusCode);
  res.on('data', (d) => process.stdout.write(d));
});
req.on('error', (e) => console.error(e));
req.write(data);
req.end();
