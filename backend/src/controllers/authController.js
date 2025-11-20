const User = require('../models/User');
const jwt = require('jsonwebtoken');

// ⚠️ 生产环境中，请将密钥保存在环境变量中！
const JWT_SECRET = 'ihatetheworld'; 

// 1. 注册功能
exports.register = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: '用户名和密码不能为空' });
        }

        const user = await User.create({ username, password });
        
        // 注册成功后直接签发 Token
        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ 
            message: '注册成功',
            token,
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        if (error.code === 11000) { // MongoDB duplicate key error
            return res.status(400).json({ message: '该用户名已被注册' });
        }
        res.status(500).json({ message: '服务器错误', error: error.message });
    }
};

// 2. 登录功能
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: '用户名或密码错误' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: '用户名或密码错误' });
        }

        // 登录成功，签发 Token
        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ 
            message: '登录成功',
            token,
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        res.status(500).json({ message: '服务器错误', error: error.message });
    }
};

// 3. 校验 Token 的中间件 (供未来 Socket.io 校验使用)
exports.authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: '访问被拒绝，没有 Token' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // 将用户信息存入请求
        next();
    } catch (ex) {
        res.status(400).json({ message: '无效的 Token' });
    }
};