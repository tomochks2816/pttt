// server.js
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const app = express();
const PORT = 3001;

// 認証付きHTTPSプロキシのURL
const proxyUrl = 'https://579DA4DFB3XXcYxyCF:UBz7uCZi1HYs@daatc-2975.px.digitalartscloud.com:443';

app.use(cors());

app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing ?url= parameter');
  }

  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const response = await axios.get(targetUrl, {
      httpsAgent: agent,
      timeout: 5000, // タイムアウト設定
    });

    res.send(response.data);
  } catch (error) {
    console.error('Fetch failed:', error.message);
    res.status(500).send('Failed to fetch target URL through proxy.');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy fetch server running on http://localhost:${PORT}`);
});
