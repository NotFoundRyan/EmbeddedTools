# Assets 静态资源目录

本目录包含应用程序的静态资源文件。

## 文件说明

| 文件 | 描述 |
|------|------|
| javascript.svg | JavaScript 图标 |
| tauri.svg | Tauri 框架图标 |

## 使用说明

静态资源通过相对路径引用：

```html
<img src="assets/javascript.svg" alt="JavaScript" />
```

## 注意事项

- 图片资源建议使用 SVG 格式，保持清晰度
- 大型图片资源考虑使用外部CDN或压缩优化
- 资源命名使用小写字母和连字符
