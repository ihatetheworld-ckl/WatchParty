// 文件: backend/src/routes/jellyfin.js

const express = require('express');
const router = express.Router();
const axios = require('axios');

// 获取媒体库列表 API (电影和剧集)
router.get('/movies', async (req, res) => {
    // 重新读取环境变量
    const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
    const API_KEY = process.env.JELLYFIN_API_KEY;
    const USER_ID = process.env.JELLYFIN_USER_ID;

    if (!JELLYFIN_URL || !API_KEY || !USER_ID) {
        console.error('❌ Jellyfin 配置缺失！');
        return res.status(500).json({ error: 'Server configuration error' }); 
    }

    try {
        const response = await axios.get(`${JELLYFIN_URL}/Users/${USER_ID}/Items`, {
            headers: { 'X-Emby-Token': API_KEY },
            params: {
                Recursive: true,
                IncludeItemTypes: 'Movie,Series', // 💡 包含电影和剧集
                SortBy: 'DateCreated',
                SortOrder: 'Descending', 
                Limit: 50, 
                Fields: 'PrimaryImageAspectRatio,Overview'
            }
        });

        // 💡 返回 Type 供前端区分 Movie/Series，并移除 streamUrl
        const items = response.data.Items.map(item => ({
            id: item.Id,
            name: item.Name,
            type: item.Type, 
            imageUrl: `${JELLYFIN_URL}/Items/${item.Id}/Images/Primary?maxHeight=400&tag=${item.ImageTags ? item.ImageTags.Primary : ''}`,
            overview: item.Overview || ''
        }));

        res.json(items);

    } catch (error) {
        // ... (错误日志保持不变)
        console.error('--- Jellyfin API Request Failed ---');
        // ... (详细错误打印)
        res.status(500).json({ error: 'Failed to fetch movies from Jellyfin (Check Server Logs)' });
    }
});

// 💡 获取剧集下的所有单集路由
router.get('/episodes/:seriesId', async (req, res) => {
    const { seriesId } = req.params;
    
    const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
    const API_KEY = process.env.JELLYFIN_API_KEY;
    const USER_ID = process.env.JELLYFIN_USER_ID;

    if (!JELLYFIN_URL || !API_KEY || !USER_ID) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const response = await axios.get(`${JELLYFIN_URL}/Shows/${seriesId}/Episodes`, {
            headers: { 'X-Emby-Token': API_KEY },
            params: {
                UserId: USER_ID,
                Recursive: true,
                Fields: 'Overview,ParentIndexNumber,IndexNumber,SeriesName', // 获取季号、集号和剧集名
                Limit: 100, 
            }
        });

        // 格式化单集数据 (注意：单集 Type 是 Episode)
        const episodes = response.data.Items.map(item => ({
            id: item.Id,
            name: item.Name,
            type: item.Type, 
            seriesName: item.SeriesName,
            seasonNumber: item.ParentIndexNumber, // 季号
            episodeNumber: item.IndexNumber, // 集号
            imageUrl: `${JELLYFIN_URL}/Items/${item.Id}/Images/Primary?maxHeight=400&tag=${item.ImageTags ? item.ImageTags.Primary : ''}`,
            overview: item.Overview || ''
        }));

        res.json({ episodes: episodes });

    } catch (error) {
        console.error('Jellyfin Episodes API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch episodes from Jellyfin' });
    }
});


// 💡 新增：直接流式传输视频内容的路由，支持 Range Request (视频播放器会直接请求这个 URL)
router.get('/stream/:itemId/video', async (req, res) => {
    const { itemId } = req.params;

    const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
    const API_KEY = process.env.JELLYFIN_API_KEY;
    const USER_ID = process.env.JELLYFIN_USER_ID;

    if (!JELLYFIN_URL || !API_KEY || !USER_ID) {
        // 使用 send 发送纯文本，避免 JSON 响应体导致浏览器报错
        return res.status(500).send('Server configuration error: Jellyfin credentials missing.');
    }

    // 1. 构建 Jellyfin 的实际视频流 URL
    // 使用 .mp4 后缀和转码参数，确保 Jellyfin 返回流式文件
    const jellyfinStreamUrl = 
        `${JELLYFIN_URL}/Videos/${itemId}/stream.mp4?api_key=${API_KEY}&UserId=${USER_ID}&videoCodec=h264&audioCodec=aac&maxBitrate=3000000&transcodingContainer=mp4`;

    // 2. 准备请求头，将客户端发来的 Range Header 转发给 Jellyfin
    const headers = {
        'X-Emby-Token': API_KEY, // Jellyfin 认证
        // 💡 关键：转发 Range header，使其支持跳播
        ...(req.headers.range && { 'Range': req.headers.range }) 
    };

    try {
        // 3. 使用 axios 发送流式请求到 Jellyfin
        const streamResponse = await axios({
            method: 'get',
            url: jellyfinStreamUrl,
            headers: headers,
            responseType: 'stream' // 必须是 'stream'
        });

        // 4. 将 Jellyfin 返回的 Headers 转发给客户端
        // 💡 关键：转发 Content-Length, Content-Range, Content-Type, Accept-Ranges 等
        res.writeHead(streamResponse.status, streamResponse.headers);

        // 5. 将 Jellyfin 的响应流 pipe 到客户端
        streamResponse.data.pipe(res);

    } catch (error) {
        console.error('Jellyfin Stream Proxy Error:', error.message);
        if (error.response) {
            // 将 Jellyfin 返回的错误状态码和消息传回
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(500).send('Failed to stream video.');
        }
    }
});


// 💡 修改：/stream/:itemId 路由现在只返回新的代理流 URL
router.get('/stream/:itemId', (req, res) => {
    const { itemId } = req.params;
    
    // ⚠️ 确保这里的 URL 与 App.vue 中的 BACKEND_URL 一致
    const BACKEND_URL = 'https://watchparty-nhd0.onrender.com';
    
    // 返回新的代理流 URL
    const streamProxyUrl = `${BACKEND_URL}/api/jellyfin/stream/${itemId}/video`;
    
    // 返回包含代理 URL 的 JSON 对象给前端
    res.json({ url: streamProxyUrl });
});

module.exports = router;