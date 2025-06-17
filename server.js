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

// 任意のプロキシ設定（必要な場合）
const proxyUrl = 'http://579DA4DFB3XXcYxyCF:UBz7uCZi1HYs@daatc-2975.px.digitalartscloud.com:443';
const agent = new HttpsProxyAgent(proxyUrl);

// 静的ファイル
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// JSONやURLエンコードされた本文を許可
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

  // タグ属性URL変換
  html = replaceAttr(html, 'a', 'href');
  html = replaceAttr(html, 'img', 'src');
  html = replaceAttr(html, 'script', 'src');
  html = replaceAttr(html, 'link', 'href');
  html = replaceAttr(html, 'iframe', 'src');
  html = replaceAttr(html, 'video', 'src');
  html = replaceAttr(html, 'audio', 'src');
  html = replaceAttr(html, 'source', 'src');

  // meta refresh
  html = html.replace(/<meta\s+http-equiv=["']refresh["']\s+content=["'][^;]+;\s*url=([^"']+)["']/gi, (match, url) => {
    try {
      const absUrl = new URL(url, base).href;
      return match.replace(url, `/fetch?url=${encodeURIComponent(absUrl)}`);
    } catch {
      return match;
    }
  });

  // CSP緩和：metaタグの削除
  html = html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

  return html;
}

function rewriteCssUrls(cssText, baseUrl) {
  const base = new URL(baseUrl);

  cssText = cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, url) => {
    try {
      const absUrl = new URL(url, base).href;
      return `url(${quote}/fetch?url=${encodeURIComponent(absUrl)}${quote})`;
    } catch {
      return match;
    }
  });

  // @import 処理
  cssText = cssText.replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?/g, (match, url) => {
    try {
      const absUrl = new URL(url, base).href;
      return `@import url("/fetch?url=${encodeURIComponent(absUrl)}")`;
    } catch {
      return match;
    }
  });

  return cssText;
}

function extractBaseHref(html, fallbackUrl) {
  const match = html.match(/<base\s+href="([^"]+)"/i);
  if (match) {
    try {
      return new URL(match[1], fallbackUrl).href;
    } catch {}
  }
  return fallbackUrl;
}

// ✅ すべてのHTTPメソッド対応
app.all('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url= parameter');

  try {
    const method = req.method;
    const headers = {
      ...req.headers,
      host: new URL(targetUrl).host,
      referer: targetUrl,
      origin: new URL(targetUrl).origin,
      'Accept-Encoding': 'identity', // gzip解除（バイナリ安定）
    };

    delete headers['accept-encoding'];
    delete headers['content-length']; // axiosが自動で設定するため

    const response = await axios({
      method,
      url: targetUrl,
      data: req.body,
      headers,
      responseType: 'arraybuffer',
      httpsAgent: agent,
      validateStatus: () => true, // 全ステータス通す
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // HTMLの変換処理
    if (contentType.includes('text/html')) {
      const html = response.data.toString('utf-8');
      const baseHref = extractBaseHref(html, targetUrl);
      const rewritten = rewriteUrls(html, baseHref);
      res.set('Content-Type', 'text/html; charset=UTF-8');
      // Set-Cookie 転送
      const setCookies = response.headers['set-cookie'];
      if (setCookies) res.setHeader('Set-Cookie', setCookies);
      res.status(response.status).send(rewritten);
    }
    // CSSの変換処理
    else if (contentType.includes('text/css')) {
      const css = response.data.toString('utf-8');
      const rewritten = rewriteCssUrls(css, targetUrl);
      res.set('Content-Type', 'text/css; charset=UTF-8');
      res.status(response.status).send(rewritten);
    }
    // その他はそのまま転送
    else {
      const headersToSend = { ...response.headers };
      delete headersToSend['content-encoding'];
      res.set(headersToSend);
      res.status(response.status).send(response.data);
    }
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).send(`Proxy failed: ${err.message}`);
  }
});

// 起動
app.listen(PORT, () => {
  console.log(`🚀 Fully featured proxy running at http://localhost:${PORT}`);
});
