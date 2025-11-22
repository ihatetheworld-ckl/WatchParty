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
// 💡 确保你的 .env 文件中的 MONGODB_URI 是正确的
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://root:200561409@watchparty.uvlzbiv.mongodb.net/?appName=WatchParty';

// ------------------- 中间件配置 -------------------
app.use(cors({
    origin: 'https://watch-party-three-lac.vercel.app', 
    credentials: true,
}));
app.use(express.json());

// 根路由，用于健康检查
app.get('/', (req, res) => {
    res.send('SyncCinema Backend is running.');
});

// ------------------- 路由配置 -------------------
app.use('/api/auth', authRoutes);
app.use('/api/jellyfin', jellyfinRoute);

// ------------------- 服务器启动设置 -------------------
const httpServer = http.createServer(app); 

// ------------------- 数据库连接与服务器启动 (最终修复逻辑) -------------------
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB 连接成功');

        // 💡 只有连接成功后才启动服务器，并使用正确的 httpServer 变量
        httpServer.listen(PORT, '0.0.0.0', () => { 
            console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
            console.log(`📢 请使用你的公网 IP 访问：http://13.158.77.147:${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB 连接失败:', err);
        process.exit(1); 
    });

// 注意：Socket.io 服务将在 index.js 中启动，并监听同一个端口！

module.exports = { app, httpServer };