# Views 视图目录

本目录用于存放可复用的HTML视图模板片段。

## 用途

- 存放各工具面板的HTML模板
- 存放公共组件的HTML模板
- 支持动态加载和复用

## 规划结构

```
views/
├── components/        # 公共组件
│   ├── header.html       # 头部组件
│   └── footer.html       # 底部组件
└── tools/            # 工具面板
    ├── lcd-tool.html     # LCD工具面板
    ├── serial-tool.html  # 串口工具面板
    ├── timestamp-tool.html # 时间戳工具面板
    └── onenet-tool.html  # OneNET工具面板
```

## 使用方式

通过JavaScript动态加载HTML片段：

```javascript
async function loadView(viewName) {
  const response = await fetch(`views/${viewName}.html`);
  const html = await response.text();
  document.getElementById('container').innerHTML = html;
}
```

## 注意事项

- 当前版本HTML内容仍在 `index.html` 中
- 后续重构可将各工具面板拆分到此目录
- 拆分后需配合前端路由或动态加载机制
