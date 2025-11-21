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

// 💡 新增：获取剧集下的所有单集路由
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


// 💡 新增：获取视频流 URL 路由 (安全地将 API Key 留在后端)
router.get('/stream/:itemId', async (req, res) => {
    const { itemId } = req.params;
    
    const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
    const API_KEY = process.env.JELLYFIN_API_KEY;
    const USER_ID = process.env.JELLYFIN_USER_ID;

    if (!JELLYFIN_URL || !API_KEY || !USER_ID) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // 关键：返回包含 API 密钥和转码参数的完整 URL
    // 增加 UserId={USER_ID} 确保权限正确
    const streamUrl = `${JELLYFIN_URL}/Videos/${itemId}/stream.mp4?api_key=${API_KEY}&videoCodec=h264&audioCodec=aac&maxBitrate=3000000&transcodingContainer=mp4&UserId=${USER_ID}`;
    
    res.json({ url: streamUrl });
});

module.exports = router;