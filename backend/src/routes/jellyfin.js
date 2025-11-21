const express = require('express');
const router = express.Router();
const axios = require('axios');

// 从环境变量获取配置
const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
const API_KEY = process.env.JELLYFIN_API_KEY;
const USER_ID = process.env.JELLYFIN_USER_ID;

// 获取电影列表 API
router.get('/movies', async (req, res) => {
    // ✨ 将变量读取移到路由函数内部
    const JELLYFIN_URL = process.env.JELLYFIN_SERVER_URL;
    const API_KEY = process.env.JELLYFIN_API_KEY;
    const USER_ID = process.env.JELLYFIN_USER_ID;

    // 这一段代码是关键！它会准确告诉你哪个变量是空的。
    if (!JELLYFIN_URL || !API_KEY || !USER_ID) {
        console.error('❌ Jellyfin 配置缺失！');
        console.error(`Jellyfin URL: ${JELLYFIN_URL ? '已设置' : '未设置'}`);
        console.error(`API Key: ${API_KEY ? '已设置' : '未设置'}`);
        console.error(`User ID: ${USER_ID ? '已设置' : '未设置'}`);
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
                IncludeItemTypes: 'Movie,Series',
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
            // 去掉 static=true (允许转码)，并限制最大码率为 3000000 (3Mbps)
            // 3Mbps 足够 720P 或低码率 1080P 流畅播放
            streamUrl: `${JELLYFIN_URL}/Videos/${item.Id}/stream.mp4?api_key=${API_KEY}&videoCodec=h264&audioCodec=aac&maxBitrate=3000000&transcodingContainer=mp4`,
            overview: item.Overview
        }));

        res.json(movies);

    } catch (error) {
        
        console.error('--- Jellyfin API Request Failed ---');
        
        if (error.response) {
            // 請求已發出，但伺服器返回的狀態碼不在 2xx 範圍內 (即 403)
            console.error('Response Status:', error.response.status); 
            
            // 💡 關鍵：Jellyfin 在 403 時可能會返回一個描述錯誤原因的 JSON 或文字
            console.error('Response Data:', error.response.data); 
            
            // 打印出完整的請求 URL (檢查 UserID 是否包含在內)
            console.error('Request URL:', error.config.url); 
            console.error('API Key Header:', error.config.headers['X-Emby-Token'] ? 'Token已設置' : 'Token缺失');
        } else if (error.request) {
            // 請求已發出，但沒有收到回應 (如果不是 403，這可能是網路問題)
            console.error('No response received:', error.request);
        } else {
            // 設置請求時觸發的錯誤
            console.error('Error setting up request:', error.message);
        }
        
        console.error('-----------------------------------');

        // 返回 500 錯誤給前端
        res.status(500).json({ error: 'Failed to fetch movies from Jellyfin (Check Server Logs)' });
    }
});

module.exports = router;