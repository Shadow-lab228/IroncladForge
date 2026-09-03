import { createServer } from 'http';

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>FORGE_LIVE_PREVIEW</h1>');
});

server.listen(5173, '127.0.0.1', () => {
  console.log('Listening on http://127.0.0.1:5173');
});