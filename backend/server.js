const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');

// 导入路由和控制器
const authRoutes = require('./src/routes/authRoutes'); 
// ✨ 新增：引入 Jellyfin 路由
const jellyfinRoute = require('./src/routes/jellyfin');

const app = express();
const PORT = 3001;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://root:200561409@watchparty.uvlzbiv.mongodb.net/?appName=WatchParty'; // 请替换为你的数据库地址！

// ------------------- 中间件配置 -------------------
app.use(cors({
    origin: 'https://watch-party-three-lac.vercel.app', 
    credentials: true, // 允许携带 cookies 或 headers（如JWT Token）
}));
app.use(express.json()); // 允许解析 JSON 请求体

// 💡 修复 Cannot GET /：添加一个根路由，解决 Render 上的健康检查错误
app.get('/', (req, res) => {
    res.send('SyncCinema Backend is running.');
});

// ------------------- 路由配置 -------------------
app.use('/api/auth', authRoutes); // 将所有 /api/auth 请求转发给认证路由
// ✨ 新增：注册 Jellyfin 路由
app.use('/api/jellyfin', jellyfinRoute);

// ------------------- 数据库连接 -------------------
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB 连接成功'))
    .catch(err => console.error('❌ MongoDB 连接失败:', err));

// ------------------- 服务器启动 -------------------
const httpServer = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => { 
    console.log(`Server running on port ${PORT}`);
});

// 注意：Socket.io 服务将在 index.js 中启动，并监听同一个端口！

module.exports = { app, httpServer };