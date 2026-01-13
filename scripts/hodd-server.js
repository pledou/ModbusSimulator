// @ts-check
'use strict';

/**
 * Simple HTTP server for Hodd UI (static files)
 * Downloads and serves Hodd from GitHub if not present
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');
const os = require('os');

const PORT = process.env.HODD_PORT || 8080;
const HODD_DIR = path.join(__dirname, '../.e2e/hodd');
const HODD_ZIP_URL = 'https://github.com/rroemhild/hodd/archive/refs/heads/master.zip';
const HODD_ZIP_PATH = path.join(os.tmpdir(), 'hodd-master.zip');

// MIME types for static files
/** @type {Object.<string, string>} */
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function createPlaceholder(indexPath) {
  const placeholderHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hodd - Homie Device Discovery</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .info { background: #f0f0f0; padding: 15px; border-radius: 5px; }
        .setup { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>Hodd - Homie Device Discovery Dashboard</h1>
    <div class="info">
        <h2>MQTT Connection</h2>
        <p><strong>Broker:</strong> mqtt://localhost:1883</p>
        <p><strong>Base Topic:</strong> devices/</p>
    </div>
    <div class="setup">
        <h2>Setup Required</h2>
        <p>To use the full Hodd UI, please:</p>
        <ol>
            <li>Clone Hodd from: <a href="https://github.com/rroemhild/hodd" target="_blank">https://github.com/rroemhild/hodd</a></li>
            <li>Copy the contents to: <code>${HODD_DIR}</code></li>
            <li>Restart this server</li>
        </ol>
        <p>Or create a custom UI that connects to the MQTT broker at localhost:1883</p>
    </div>
    <div class="info" style="margin-top: 20px;">
        <h2>Current Devices</h2>
        <p>Devices will appear here once connected to MQTT broker.</p>
        <div id="devices"></div>
    </div>
    <script>
        // Simple MQTT connection using WebSocket (requires mqtt.js or similar)
        console.log('Hodd placeholder - connect your MQTT client to mqtt://localhost:1883');
    </script>
</body>
</html>`;
  fs.writeFileSync(indexPath, placeholderHtml);
  console.log(`Placeholder created at: ${indexPath}`);
}

function isPlaceholderIndex(indexPath) {
  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    return content.includes('Hodd - Homie Device Discovery Dashboard') && content.includes('Setup Required');
  } catch (_) {
    return false;
  }
}

function downloadHoddZip(maxRedirects = 5, urlStr = HODD_ZIP_URL) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(HODD_ZIP_PATH);
    console.log(`Downloading Hodd UI from ${urlStr} ...`);
    https.get(urlStr, response => {
      const { statusCode, headers } = response;

      if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects while downloading Hodd zip'));
          return;
        }
        file.close(() => fs.unlink(HODD_ZIP_PATH, () => {
          downloadHoddZip(maxRedirects - 1, headers.location).then(resolve).catch(reject);
        }));
        return;
      }

      if (statusCode !== 200) {
        reject(new Error(`Failed to download Hodd zip: ${statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(HODD_ZIP_PATH, () => reject(err));
    });
  });
}

function extractZip() {
  // Use built-in PowerShell Expand-Archive to avoid extra deps
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -Path "${HODD_ZIP_PATH}" -DestinationPath "${HODD_DIR}" -Force`
  ], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('Failed to extract Hodd zip');
  }
}

function flattenExtractedFolder() {
  const entries = fs.readdirSync(HODD_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());
  const placeholder = path.join(HODD_DIR, 'index.html');

  // If we have exactly one extracted dir (plus maybe placeholder), move its contents up
  if (dirs.length === 1 && entries.length <= 2) {
    const nested = path.join(HODD_DIR, dirs[0].name);
    const nestedItems = fs.readdirSync(nested);
    nestedItems.forEach(item => {
      fs.renameSync(path.join(nested, item), path.join(HODD_DIR, item));
    });
    fs.rmdirSync(nested);
  }

  // Remove placeholder if real files or directories exist
  if (fs.existsSync(placeholder)) {
    const hasRealContent = fs.readdirSync(HODD_DIR)
      .some(name => name !== 'index.html');
    if (hasRealContent && isPlaceholderIndex(placeholder)) {
      try {
        fs.unlinkSync(placeholder);
      } catch (_) {
        // ignore
      }
    }
  }

  // If we have a slim index shipped by Hodd but no main index, use it
  const slimIndex = path.join(HODD_DIR, 'index_slim.html');
  const mainIndex = path.join(HODD_DIR, 'index.html');
  if (!fs.existsSync(mainIndex) && fs.existsSync(slimIndex)) {
    try {
      fs.copyFileSync(slimIndex, mainIndex);
    } catch (_) {
      // ignore
    }
  }
}

async function ensureHoddExists() {
  if (!fs.existsSync(HODD_DIR)) {
    fs.mkdirSync(HODD_DIR, { recursive: true });
  }

  const indexPath = path.join(HODD_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    const entries = fs.readdirSync(HODD_DIR).filter(name => name !== 'index.html');
    if (entries.length > 0) {
      return;
    }
  }

  try {
    await downloadHoddZip();
    extractZip();
    flattenExtractedFolder();
  } catch (err) {
    console.warn(`Hodd auto-download failed: ${err.message}`);
    console.warn('Falling back to placeholder UI.');
    createPlaceholder(indexPath);
    return;
  }

  if (!fs.existsSync(indexPath)) {
    console.warn('Hodd index.html not found after extraction. Using placeholder.');
    createPlaceholder(indexPath);
  }
}

/**
 * @param {http.ServerResponse} res
 * @param {string} filePath
 */
function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  let filePath = path.join(HODD_DIR, (req.url === '/' || !req.url) ? 'index.html' : req.url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(HODD_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  serveStaticFile(res, filePath);
});

// Initialize and start server
(async () => {
  await ensureHoddExists();
  server.listen(PORT, () => {
    console.log(`Hodd UI server started at http://localhost:${PORT}`);
    console.log(`Serving files from: ${HODD_DIR}`);
  });
})();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Hodd UI server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
