# 企业线上参访 · 主站融合说明

## 最终目录

`office-tour/` 与主站 `index.html` 同级是正确位置。不要把它移动到 `assets/`，因为它拥有自己的 HTML、模块脚本、数据、Three.js 依赖和 14 站影像目录。

```text
dreamworks_succession_ecosystem/
├── index.html
├── server.js
├── office-tour-auth.js
├── office-tour/
│   ├── index.html
│   ├── app.js
│   ├── navigation.js
│   ├── scene.js
│   ├── styles.css
│   ├── data/tour.json
│   ├── media/01…14/
│   ├── thumbs/01…14/
│   └── vendor/three/
└── qa/check-office-tour-integration.mjs
```

## 本地验收

1. 从 `.env.example` 复制所需变量到本机 `.env` 或部署平台，但不要提交真实值。
2. 当前 Node 服务不会自动读取 `.env` 文件；本地可在启动命令前注入变量，部署平台则在环境变量面板设置。
3. 运行 `npm test`，然后运行 `npm start`。
4. 打开 `http://localhost:8000/office-tour/`，通过独立参访验证后测试三个模式。

示例（把值替换为本机测试值，不要提交）：

```bash
OFFICE_TOUR_USERNAME='local-reviewer' \
OFFICE_TOUR_PASSWORD='replace-this-locally' \
OFFICE_TOUR_SESSION_SECRET='replace-with-at-least-32-random-characters' \
npm start
```

## 发布与回滚

- 发布单元是整个主项目；`office-tour/` 不是另起一个端口或外部站点。
- 线上入口固定为 `/office-tour/`，静态资源使用相对路径，因此可以在同一域名部署。
- 回滚入口只需暂时移除主导航链接；若要阻断直接访问，可清空参访凭据并保持 `OFFICE_TOUR_PUBLIC=false`，验证页会显示尚未配置且不会下发影像。
- 在视频校准和现场复核完成前，页面仍明确标记为 beta，3D 模型不得用于测绘、施工或疏散判断。
