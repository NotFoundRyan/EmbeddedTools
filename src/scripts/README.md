# Scripts 脚本目录

本目录包含应用程序的所有JavaScript脚本文件。

## 目录结构

```
scripts/
├── config.js       # 应用配置文件（版本号、作者等）
├── app.js          # 主应用入口文件
└── tools/          # 各工具模块脚本
    ├── lcd-tool.js     # LCD点阵生成工具
    ├── serial-tool.js  # 串口调试助手
    ├── timestamp-tool.js # 时间戳转换工具
    └── onenet-tool.js  # OneNET Token生成器
```

## 配置文件说明

### config.js - 应用配置

统一管理应用的配置信息：

```javascript
const AppConfig = {
  version: '0.3.0',        // 应用版本号（更新时只需修改此处）
  appName: '嵌入式开发工具箱',
  author: 'Ryan Chen',
  repo: {
    owner: 'NotFoundRyan',
    name: 'EmbeddedTools'
  }
};
```

**使用方法：**
- `getAppVersion()` - 获取版本号（如 '0.3.0'）
- `getFullVersion()` - 获取完整版本（如 'v0.3.0'）
- `getAppName()` - 获取应用名称
- `getRepoInfo()` - 获取仓库信息

## 模块说明

### app.js - 主应用入口

负责应用的整体初始化和公共功能：

- **启动流程**: 启动画面、进度条、模块加载
- **导航控制**: 工具面板切换
- **设置面板**: 窗口置顶、版本信息、更新检查
- **错误日志**: 错误收集和显示
- **工具函数**: Tauri API封装、通用辅助函数

### tools/lcd-tool.js - LCD点阵生成工具

功能：
- 图片上传和预览
- 文字转点阵
- 二值化处理
- 多格式导出（Hex、C数组、Arduino、Python、二进制）
- 预设分辨率配置

### tools/serial-tool.js - 串口调试助手

功能：
- 串口列表刷新
- 串口配置（波特率、数据位、停止位、校验位）
- 数据收发
- HEX/文本模式切换
- 历史记录和预设管理

### tools/timestamp-tool.js - 时间戳转换工具

功能：
- 实时时间戳显示
- 时间戳转日期时间
- 日期时间转时间戳
- 多时区支持
- 时间偏移计算

### tools/onenet-tool.js - OneNET Token生成器

功能：
- Token生成（支持SHA-256、SHA-1、MD5）
- 连接验证
- 过期时间设置
- 历史记录管理

## 开发规范

### 模块初始化

每个工具模块应导出一个初始化函数：

```javascript
function initXxxTool() {
  // 初始化逻辑
}

// 在 app.js 中调用
if (typeof initXxxTool === 'function') {
  initXxxTool();
}
```

### Tauri API调用

使用封装好的工具函数：

```javascript
// 调用Rust命令
invokeWrapper('command_name', { arg1: value1 })
  .then(result => { })
  .catch(error => { });

// 监听事件
listenWrapper('event-name', (event) => { });
```

### 错误处理

使用全局错误日志：

```javascript
logError('错误信息', '模块名称');
```
