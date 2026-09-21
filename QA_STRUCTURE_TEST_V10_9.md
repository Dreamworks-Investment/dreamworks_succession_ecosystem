# V10.9 结构、语法与服务检查

## 结构检查

```json
{
  "cover_title": "致敬标杆，无脑贡献",
  "cover_subtitle": "从头到尾，价值都是唯一衡量标准",
  "gallery_order": [
    "original-01.png",
    "original-05.png",
    "original-03.png",
    "original-04.png",
    "original-02.png",
    "client-1998-case-insert.jpeg",
    "original-06.png"
  ],
  "new_image_exists": true,
  "funnel_title": "漏斗式多品牌升级路径",
  "funnel_brands": [
    "品牌A",
    "品牌B",
    "品牌C"
  ],
  "triangle_cards": [
    {
      "title": "心智易认同",
      "subtitle": "符合已有认知和未来趋势"
    },
    {
      "title": "内部可实现",
      "subtitle": "符合基础，突出优势"
    },
    {
      "title": "外部能打赢",
      "subtitle": "差异化竞争优势"
    }
  ],
  "market_cards": [
    {
      "year": "2015–2022",
      "title": "电动化替代",
      "subtitle": "红利基本兑现"
    },
    {
      "year": "2023–2025",
      "title": "续航与价格",
      "subtitle": "没有赢家，只有幸存者"
    },
    {
      "year": "2025",
      "title": "智能驾驶",
      "subtitle": "主要生态位已被抢占"
    },
    {
      "year": "2026",
      "title": "空间与家庭正在加速内卷",
      "subtitle": "正在加速内卷"
    },
    {
      "year": "2026+",
      "title": "心智战场",
      "subtitle": "谁赢得情感认同，谁定义下一个十年"
    }
  ],
  "old_full_slogan_count_in_strategy": 0,
  "old_short_slogan_count_in_strategy": 0,
  "new_slogan_count_in_strategy": 5,
  "duplicate_ids": []
}
```

## JavaScript语法检查

```json
{
  "app.js": {
    "passed": true,
    "stderr": ""
  },
  "charts.js": {
    "passed": true,
    "stderr": ""
  },
  "enterprise.js": {
    "passed": true,
    "stderr": ""
  },
  "home-journey.js": {
    "passed": true,
    "stderr": ""
  },
  "home.js": {
    "passed": true,
    "stderr": ""
  },
  "report.js": {
    "passed": true,
    "stderr": ""
  },
  "strategy-agent-config.js": {
    "passed": true,
    "stderr": ""
  },
  "strategy.js": {
    "passed": true,
    "stderr": ""
  },
  "wealth.js": {
    "passed": true,
    "stderr": ""
  }
}
```

## 本地HTTP检查

测试端口：18009

```json
{
  "index": 200,
  "home_css": 200,
  "chapter1_css": 200,
  "chapter2_css": 200,
  "new_image": 200
}
```

## 视觉检查说明

已完成HTML结构、CSS资源、JavaScript语法和Node服务检查。
当前执行环境的Chromium受管理员访问策略限制，未将结构检查冒充为真实浏览器视觉截图验收。
客户部署后仍建议在1920×1080路演屏幕核对一次：
1. 1998模块新增竖版图片的阅读比例；
2. 五阶段时间线中“空间与家庭正在加速内卷”的换行；
3. 漏斗品牌A/B/C标签与段落高度；
4. 定位三角关三项说明的投屏字号。
