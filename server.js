import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const app = express();
const PORT = process.env.PORT || 3000;

// 認証付きHTTPSプロキシの情報
const proxyUrl = 'http://579DA4DFB3XXcYxyCF:UBz7uCZi1HYs@daatc-2975.px.digitalartscloud.com:443';

app.use(cors());

app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing ?url= parameter');

  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const response = await axios.get(targetUrl, {
      httpsAgent: agent,
      timeout: 8000,
    });
    res.send(response.data);
  } catch (err) {
    console.error('Error fetching URL:', err.message);
    res.status(500).send('Failed to fetch URL through proxy.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
