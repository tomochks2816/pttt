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

// プロキシ設定（必要なら設定）
const proxyUrl = 'http://579DA4DFB3XXcYxyCF:UBz7uCZi1HYs@daatc-2975.px.digitalartscloud.com:443';
const agent = new HttpsProxyAgent(proxyUrl);

// ミドルウェア
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

//
// 🔧 HTML の中のリンクを /fetch?url=... に書き換える
//
function rewriteUrls(html, baseUrl) {
  const base = new URL(baseUrl);

  const replaceAttr = (html, tag, attr) => {
    const regex = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'gi');
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
  html = replaceAttr(html, 'iframe', 'src');

  return html;
}

//
// 🔧 CSSの中の url(...) を /fetch?url=... に変換
//
function rewriteCssUrls(cssText, baseUrl) {
  const base = new URL(baseUrl);
  return cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, url) => {
    try {
      const absUrl = new URL(url, base).href;
      return `url(${quote}/fetch?url=${encodeURIComponent(absUrl)}${quote})`;
    } catch {
      return match;
    }
  });
}

//
// 🔍 HTML内の <base href="..."> を取得してURL基準を調整
//
function extractBaseHref(html, fallbackUrl) {
  const match = html.match(/<base\s+href="([^"]+)"/i);
  if (match) {
    try {
      return new URL(match[1], fallbackUrl).href;
    } catch {}
  }
  return fallbackUrl;
}

//
// 🔄 /fetch API（プロキシとして機能）
//
app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url= parameter');

  try {
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer', // HTMLもCSSも画像も扱えるように
      httpsAgent: agent,
      timeout: 10000,
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';

    if (contentType.includes('text/html')) {
      const html = response.data.toString('utf-8');
      const baseHref = extractBaseHref(html, targetUrl);
      const rewritten = rewriteUrls(html, baseHref);
      res.set('Content-Type', 'text/html; charset=UTF-8');
      res.send(rewritten);
    } else if (contentType.includes('text/css')) {
      const css = response.data.toString('utf-8');
      const rewritten = rewriteCssUrls(css, targetUrl);
      res.set('Content-Type', 'text/css; charset=UTF-8');
      res.send(rewritten);
    } else {
      // 画像などその他リソースはそのまま
      res.set(response.headers);
      res.send(response.data);
    }

  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).send(`Failed to fetch: ${err.message}`);
  }
});

//
// ✅ サーバー起動
//
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
