# Styles 样式目录

本目录包含应用程序的所有样式文件，采用模块化结构组织。

## 目录结构

```
styles/
├── base/           # 基础样式
│   ├── variables.css   # CSS变量定义（颜色、字体、间距等）
│   ├── reset.css       # CSS重置样式
│   └── responsive.css  # 响应式媒体查询
├── components/     # 公共组件样式
│   ├── splash.css      # 启动画面样式
│   ├── sidebar.css     # 侧边栏导航样式
│   ├── settings.css    # 设置面板样式
│   └── modal.css       # 弹窗对话框样式
├── tools/          # 各工具模块样式
│   ├── lcd-tool.css    # LCD点阵生成工具样式
│   ├── serial-tool.css # 串口调试助手样式
│   ├── timestamp-tool.css # 时间戳转换工具样式
│   └── onenet-tool.css # OneNET Token生成器样式
└── main.css        # 主入口文件（导入所有模块）
```

## 使用说明

### CSS变量

所有全局变量定义在 `base/variables.css` 中，包括：

- **主题色**: `--primary`, `--primary-hover`, `--success`, `--danger`
- **背景色**: `--bg-page`, `--bg-card`
- **文字色**: `--text-main`, `--text-sub`
- **边框**: `--border`, `--radius`
- **玻璃效果**: `--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-blur`

### 添加新工具样式

1. 在 `tools/` 目录下创建新的CSS文件
2. 在 `main.css` 中添加导入语句
3. 使用已定义的CSS变量保持风格统一

### 样式命名规范

- 使用小写字母和连字符命名
- 按功能模块前缀命名，如 `lcd-`, `serial-`, `onenet-`
- 使用BEM命名法或语义化命名
