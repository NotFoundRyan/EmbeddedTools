# Tools 工具模块目录

本目录包含各功能工具的JavaScript实现。

## 文件说明

| 文件 | 功能描述 |
|------|----------|
| lcd-tool.js | LCD点阵生成工具 - 图片/文字转点阵数据 |
| serial-tool.js | 串口调试助手 - 串口通信调试 |
| timestamp-tool.js | 时间戳转换工具 - 时间格式互转 |
| onenet-tool.js | OneNET Token生成器 - 物联网平台鉴权 |

## 开发指南

### 添加新工具

1. 创建新的JS文件，命名格式：`xxx-tool.js`
2. 实现初始化函数 `initXxxTool()`
3. 在 `index.html` 中引入脚本
4. 在 `app.js` 的初始化流程中添加加载调用

### 代码规范

- 使用函数作用域，避免全局污染
- DOM操作在初始化函数内进行
- 异步操作使用 async/await
- 错误使用 logError() 记录

### 与Rust后端通信

```javascript
// 调用Tauri命令
const result = await invokeWrapper('command_name', {
  param1: value1,
  param2: value2
});

// 监听后端事件
listenWrapper('event-name', (event) => {
  console.log(event.payload);
});
```
