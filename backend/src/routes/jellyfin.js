// 文件: backend/src/routes/jellyfin.js (已修复 Range Request 代理版本)

const express = require('express');
const router = express.Router();
const axios = require('axios');

// 获取媒体库列表 API (代码与你上传的保持一致)
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
                IncludeItemTypes: 'Movie,Series', 
                SortBy: 'DateCreated',
                SortOrder: 'Descending', 
                Limit: 50, 
                Fields: 'PrimaryImageAspectRatio,Overview'
            }
        });

        const items = response.data.Items.map(item => ({
            id: item.Id,
            name: item.Name,
            type: item.Type, 
            imageUrl: `${JELLYFIN_URL}/Items/${item.Id}/Images/Primary?maxHeight=400&tag=${item.ImageTags ? item.ImageTags.Primary : ''}`,
            overview: item.Overview || ''
        }));

        res.json(items);

    } catch (error) {
        console.error('--- Jellyfin API Request Failed ---');
        res.status(500).json({ error: 'Failed to fetch movies from Jellyfin (Check Server Logs)' });
    }
});

// 获取剧集下的所有单集路由 (保持不变)
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
                Fields: 'Overview,ParentIndexNumber,IndexNumber,SeriesName', 
                Limit: 100, 
            }
        });

        const episodes = response.data.Items.map(item => ({
            id: item.Id,
            name: item.Name,
            type: item.Type, 
            seriesName: item.SeriesName,
            seasonNumber: item.ParentIndexNumber,
            episodeNumber: item.IndexNumber,
            imageUrl: `${JELLYFIN_URL}/Items/${item.Id}/Images/Primary?maxHeight=400&tag=${item.ImageTags ? item.ImageTags.Primary : ''}`,
            overview: item.Overview || ''
        }));

        res.json({ episodes: episodes });

    } catch (error) {
        console.error('Jellyfin Episodes API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch episodes from Jellyfin' });
    }
});


// ------------------------------------------------
// 💡 核心修复：Range Request 代理路由
// ------------------------------------------------
router.get('/stream/:itemId/video', async (req, res) => {
    const { itemId } = req.params;

    const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
    const API_KEY = process.env.JELLYFIN_API_KEY;
    const USER_ID = process.env.JELLYFIN_USER_ID;

    if (!JELLYFIN_URL || !API_KEY || !USER_ID) {
        return res.status(500).send('Server configuration error: Jellyfin credentials missing.');
    }

    // 1. 构建 Jellyfin 的实际视频流 URL
    const jellyfinStreamUrl = 
        `${JELLYFIN_URL}/Videos/${itemId}/stream.mp4?api_key=${API_KEY}&UserId=${USER_ID}&videoCodec=h264&audioCodec=aac&maxBitrate=3000000&transcodingContainer=mp4&AddTranscodeTimestamp=true`;

    // 2. 准备请求头，将客户端发来的 Range Header 转发给 Jellyfin
    const headersToForward = {
        'X-Emby-Token': API_KEY, // Jellyfin 认证
    };
    
    // 💡 关键：转发 Range Header
    if (req.headers.range) {
        headersToForward['Range'] = req.headers.range;
        console.log(`[Stream Proxy] Forwarding Range Header: ${req.headers.range}`); 
    }

    try {
        // 3. 使用 axios 发送流式请求到 Jellyfin
        const streamResponse = await axios({
            method: 'get',
            url: jellyfinStreamUrl,
            headers: headersToForward,
            responseType: 'stream',
            maxRedirects: 0 
        });

        // 4. 获取 Jellyfin 返回的 Headers
        const responseHeaders = streamResponse.headers;
        
        // 💡 关键修正：强制添加 Accept-Ranges: bytes
        if (!responseHeaders['accept-ranges']) {
            responseHeaders['accept-ranges'] = 'bytes'; 
        }
        
        // 5. 转发 Headers
        res.writeHead(streamResponse.status, responseHeaders);

        // 6. 将 Jellyfin 的响应流 pipe 到客户端
        streamResponse.data.pipe(res);

        // 监听流结束，确保连接关闭
        streamResponse.data.on('end', () => {
             res.end();
        });
        
        streamResponse.data.on('error', (err) => {
             console.error('[Stream Proxy] Stream pipe error:', err.message);
             if (!res.headersSent) {
                 res.status(500).send('Stream pipe error.');
             } else {
                 res.end(); // 尝试关闭连接
             }
        });

    } catch (error) {
        console.error('--- Jellyfin Stream Proxy Error ---');
        if (error.response) {
            console.error(`Status: ${error.response.status}, Range: ${req.headers.range}`);
            res.status(error.response.status).send(error.response.data);
        } else {
            console.error('Network or timeout error:', error.message);
            res.status(500).send('Failed to stream video (Network or Timeout).');
        }
    }
});


// 💡 修改：/stream/:itemId 路由现在返回代理流 URL，供前端使用
router.get('/stream/:itemId', (req, res) => {
    const { itemId } = req.params;
    
    // ⚠️ 确保这里的 URL 与 App.vue 中的 BACKEND_URL 一致
    const BACKEND_URL = 'https://watchparty-nhd0.onrender.com';
    
    // 返回新的代理流 URL，它就是播放器实际请求的地址
    const streamProxyUrl = `${BACKEND_URL}/api/jellyfin/stream/${itemId}/video`;
    
    res.json({ url: streamProxyUrl });
});

module.exports = router;