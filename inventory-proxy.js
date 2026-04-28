const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8766;
const TEXTIN_HOST = 'api.textin.com';

const server = http.createServer(function(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ti-app-id, x-ti-secret-code');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve static files
  if (req.method === 'GET' && !req.url.startsWith('/proxy/')) {
    var filePath = req.url === '/' ? '/inventory-agent-v4.html' : req.url;
    var fullPath = path.join(__dirname, filePath);
    var ext = path.extname(fullPath);
    var contentType = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' }[ext] || 'application/octet-stream';

    fs.readFile(fullPath, function(err, data) {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Proxy TextIn API calls
  if (req.method === 'POST' && req.url.startsWith('/proxy/')) {
    var targetPath = req.url.replace('/proxy', '');
    var chunks = [];
    req.on('data', function(chunk) { chunks.push(chunk); });
    req.on('end', function() {
      var body = Buffer.concat(chunks);
      var options = {
        hostname: TEXTIN_HOST,
        port: 443,
        path: targetPath,
        method: 'POST',
        headers: {
          'x-ti-app-id': req.headers['x-ti-app-id'] || '',
          'x-ti-secret-code': req.headers['x-ti-secret-code'] || '',
          'Content-Type': 'application/octet-stream',
          'Content-Length': body.length
        }
      };

      var proxyReq = https.request(options, function(proxyRes) {
        var respChunks = [];
        proxyRes.on('data', function(chunk) { respChunks.push(chunk); });
        proxyRes.on('end', function() {
          var respBody = Buffer.concat(respChunks);
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(respBody);
        });
      });

      proxyReq.on('error', function(e) {
        res.writeHead(502);
        res.end(JSON.stringify({ code: 502, message: 'Proxy error: ' + e.message }));
      });

      proxyReq.end(body);
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, function() {
  console.log('Inventory proxy running at http://localhost:' + PORT);
  console.log('Open: http://localhost:' + PORT + '/inventory-agent-v4.html');
});
