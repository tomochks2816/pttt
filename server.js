import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const proxyUrl = 'http://579DA4DFB3XXcYxyCF:UBz7uCZi1HYs@daatc-2975.px.digitalartscloud.com:443';

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url= parameter');

  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const response = await axios.get(targetUrl, {
      httpsAgent: agent,
      timeout: 8000,
      responseType: 'text',
      transformResponse: [(data) => data], // 生テキスト
    });

    let html = response.data;
    const baseURL = new URL(targetUrl).origin;

    // URLを書き換える関数
    function rewriteUrls(html) {
      // aタグ href
      html = html.replace(/href\s*=\s*"(.*?)"/gi, (match, url) => {
        try {
          const absUrl = new URL(url, targetUrl).href;
          return `href="/fetch?url=${encodeURIComponent(absUrl)}"`;
        } catch {
          return match;
        }
      });

      // imgタグ src
      html = html.replace(/<img\s+[^>]*src\s*=\s*"([^"]*)"/gi, (match, url) => {
        try {
          const absUrl = new URL(url, targetUrl).href;
          return match.replace(url, `/fetch?url=${encodeURIComponent(absUrl)}`);
        } catch {
          return match;
        }
      });

      // scriptタグ src
      html = html.replace(/<script\s+[^>]*src\s*=\s*"([^"]*)"/gi, (match, url) => {
        try {
          const absUrl = new URL(url, targetUrl).href;
          return match.replace(url, `/fetch?url=${encodeURIComponent(absUrl)}`);
        } catch {
          return match;
        }
      });

      // linkタグ href (CSSなど)
      html = html.replace(/<link\s+[^>]*href\s*=\s*"([^"]*)"/gi, (match, url) => {
        try {
          const absUrl = new URL(url, targetUrl).href;
          return match.replace(url, `/fetch?url=${encodeURIComponent(absUrl)}`);
        } catch {
          return match;
        }
      });

      return html;
    }

    html = rewriteUrls(html);

    res.set('Content-Type', 'text/html');
    res.send(html);

  } catch (err) {
    console.error('Error fetching URL:', err.message);
    res.status(500).send('Failed to fetch URL through proxy.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
