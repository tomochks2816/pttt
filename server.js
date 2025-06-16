import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname を ESM で使えるようにする
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// アイフィルターのURL（必要なら環境変数に切り替えてください）
const proxyUrl = 'http://579DA4DFB3XXcYxyCF:UBz7uCZi1HYs@daatc-2975.px.digitalartscloud.com:443';

// ミドルウェア
app.use(cors());

// 静的ファイル（public フォルダ）を配信
app.use(express.static(path.join(__dirname, 'public')));

app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url= parameter');

  try {
    const agent = new HttpsProxyAgent(proxyUrl);

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream', // 重要：ストリームで受け取る
      httpsAgent: agent,
      timeout: 8000,
    });

    // 重要：ヘッダーをコピーしてクライアントに正しく伝える
    res.set(response.headers);

    // ストリーミングでレスポンスを転送
    response.data.pipe(res);
  } catch (err) {
    console.error('Error fetching URL:', err.message);
    res.status(500).send('Failed to fetch URL through proxy.');
  }
});


// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
