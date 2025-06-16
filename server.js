import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname 対応（ESM）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// プロキシサーバーURL（必要に応じて環境変数化推奨）
const proxyUrl = 'http://579DA4DFB3XXcYxyCF:UBz7uCZi1HYs@daatc-2975.px.digitalartscloud.com:443';
const agent = new HttpsProxyAgent(proxyUrl);

// CORS 有効化
app.use(cors());

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// URL書き換え関数（HTML内のリンクを /fetch?url=〜 に変換）
function rewriteUrls(html, baseUrl) {
  const base = new URL(baseUrl);

  const replaceAttr = (html, tag, attr) => {
    const regex = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*"(.*?)"`, 'gi');
    return html.replace(regex, (match, url) => {
      try {
        const absUrl = new URL(url, base).href;
        return match.replace(url, `/fetch?url=${encodeURIComponent(absUrl)}`);
      } catch {
        return match;
      }
    });
  };

  html = replaceAttr(html, 'a', 'href');
  html = replaceAttr(html, 'img', 'src');
  html = replaceAttr(html, 'script', 'src');
  html = replaceAttr(html, 'link', 'href');

  return html;
}

// /fetch エンドポイント
app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url= parameter');

  try {
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      httpsAgent: agent,
      timeout: 8000,
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // HTMLならリンク書き換え
    if (contentType.includes('text/html')) {
      const html = response.data.toString('utf-8');
      const rewritten = rewriteUrls(html, targetUrl);
      res.set('Content-Type', 'text/html; charset=UTF-8');
      res.send(rewritten);
    } else {
      // HTML以外（画像など）はそのまま中継
      res.set(response.headers);
      res.send(response.data);
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).send(`Failed to fetch: ${err.message}`);
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
