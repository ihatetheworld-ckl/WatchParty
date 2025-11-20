const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');

// 导入路由和控制器
const authRoutes = require('./src/routes/authRoutes'); 

const app = express();
const PORT = 3001;
const MONGO_URI = 'mongodb://localhost:27017/SyncCinemaDB'; // 请替换为你的数据库地址！

// ------------------- 中间件配置 -------------------
app.use(cors({
    origin:'*',
}));
app.use(express.json()); // 允许解析 JSON 请求体

// ------------------- 路由配置 -------------------
app.use('/api/auth', authRoutes); // 将所有 /api/auth 请求转发给认证路由

// ------------------- 数据库连接 -------------------
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB 连接成功'))
    .catch(err => console.error('❌ MongoDB 连接失败:', err));

// ------------------- 服务器启动 -------------------
const httpServer = http.createServer(app);

// 注意：Socket.io 服务将在 index.js 中启动，并监听同一个端口！

module.exports = { app, httpServer };