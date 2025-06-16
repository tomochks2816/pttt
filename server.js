import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname を ESM で使うための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロキシサーバーURL（必要に応じて環境変数化推奨）
const proxyUrl = 'http://579DA4DFB3XXcYxyCF:UBz7uCZi1HYs@daatc-2975.px.digitalartscloud.com:443';

// ミドルウェア設定
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// HTML内のURLを書き換える関数
function rewriteUrls(html, baseUrl) {
  // aタグ href属性
  html = html.replace(/href\s*=\s*"(.*?)"/gi, (match, url) => {
    try {
      const absUrl = new URL(url, baseUrl).href;
      return `href="/fetch?url=${encodeURIComponent(absUrl)}"`;
    } catch {
      return match;
    }
  });

  // imgタグ src属性
  html = html.replace(/<img\s+[^>]*src\s*=\s*"([^"]*)"/gi, (match, url) => {
    try {
      const absUrl = new URL(url, baseUrl).href;
      return match.replace(url, `/fetch?url=${encodeURIComponent(absUrl)}`);
    } catch {
      return match;
    }
  });

  // scriptタグ src属性
  html = html.replace(/<script\s+[^>]*src\s*=\s*"([^"]*)"/gi, (match, url) => {
    try {
      const absUrl = new URL(url, baseUrl).href;
      return match.replace(url, `/fetch?url=${encodeURIComponent(absUrl)}`);
    } catch {
      return match;
    }
  });

  // linkタグ href属性（CSSなど）
  html = html.replace(/<link\s+[^>]*href\s*=\s*"([^"]*)"/gi, (match, url) => {
    try {
      const absUrl = new URL(url, baseUrl).href;
      return match.replace(url, `/fetch?url=${encodeURIComponent(absUrl)}`);
    } catch {
      return match;
    }
  });

  return html;
}

// /fetch API - プロキシ経由で外部URLを取得してレスポンスを返す
app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing ?url= parameter');
  }

  try {
    const agent = new HttpsProxyAgent(proxyUrl);

    const response = await axios.get(targetUrl, {
      httpsAgent: agent,
      timeout: 8000,
      responseType: 'text',
      transformResponse: [(data) => data], // 生テキストのまま取得
      validateStatus: () => true, // ステータスコード400以上も受け取る（自前で判定可能に）
    });

    if (response.status >= 400) {
      res.status(response.status).send(`Failed to fetch URL: HTTP ${response.status}`);
      return;
    }

    let body = response.data;

    // Content-TypeがHTMLならURLを書き換え
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      body = rewriteUrls(body, targetUrl);
      res.set('Content-Type', 'text/html; charset=UTF-8');
      res.send(body);
      return;
    }

    // それ以外はヘッダーとデータをそのまま返す（画像など）
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.status(response.status).send(body);
  } catch (err) {
    console.error('Error fetching URL:', err.message);
    res.status(500).send('Failed to fetch URL through proxy.');
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
