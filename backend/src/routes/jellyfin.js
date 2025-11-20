const express = require('express');
const router = express.Router();
const axios = require('axios');

// 从环境变量获取配置
const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
const API_KEY = process.env.JELLYFIN_API_KEY;
const USER_ID = process.env.JELLYFIN_USER_ID;

// 获取电影列表 API
router.get('/movies', async (req, res) => {
    // 简单的错误检查
    if (!JELLYFIN_URL || !API_KEY || !USER_ID) {
        console.error('Jellyfin 环境变量缺失');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // 调用 Jellyfin API 获取项目
        // Recursive=true: 递归查找所有子文件夹
        // IncludeItemTypes=Movie: 只看电影
        // fields: 我们需要的字段 (名称, ID, 图片等)
        const response = await axios.get(`${JELLYFIN_URL}/Users/${USER_ID}/Items`, {
            headers: {
                'X-Emby-Token': API_KEY
            },
            params: {
                Recursive: true,
                IncludeItemTypes: 'Movie',
                SortBy: 'DateCreated',
                SortOrder: 'Descending', // 最新的在前面
                Limit: 50, // 限制返回 50 部，防止数据量太大
                Fields: 'PrimaryImageAspectRatio,Overview'
            }
        });

        // 处理数据，只返回前端需要的简单格式
        const movies = response.data.Items.map(item => ({
            id: item.Id,
            name: item.Name,
            // 构建图片 URL (前端直接用)
            imageUrl: `${JELLYFIN_URL}/Items/${item.Id}/Images/Primary?maxHeight=400&tag=${item.ImageTags.Primary}`,
            // 构建视频播放直链 (关键！)
            streamUrl: `${JELLYFIN_URL}/Videos/${item.Id}/stream.mp4?static=true&api_key=${API_KEY}`,
            overview: item.Overview
        }));

        res.json(movies);

    } catch (error) {
        console.error('Jellyfin API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch movies from Jellyfin' });
    }
});

module.exports = router;