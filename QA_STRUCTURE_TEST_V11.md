# V11 首页交互金字塔结构检查

## 结构

```json
{
  "homepage_nav_targets": [
    "roadshow-curated-start",
    "home-value-summary",
    "home-inheritance-principle",
    "home-strategy-transition",
    "home-value-cycle"
  ],
  "removed_old_nav_items": true,
  "removed_old_standalone_sections": {
    "roadshow-curated-profile": true,
    "home-module-1998": true,
    "home-module-2005": true,
    "home-module-2011": true,
    "home-module-2020": true
  },
  "pyramid_layers": [
    "传承模式",
    "公益模式",
    "投资模式",
    "商业模式",
    "企业家土壤"
  ],
  "investment_layer_renamed": true,
  "panel_count": 5,
  "panel_image_counts": {
    "soil": 0,
    "business": 7,
    "investment": 5,
    "charity": 6,
    "legacy": 5
  },
  "duplicate_ids": [],
  "css_link_present": true,
  "js_link_present": true
}
```

## JavaScript

```json
{
  "app.js": true,
  "charts.js": true,
  "enterprise.js": true,
  "home-interactive-pyramid.js": true,
  "home-journey.js": true,
  "home.js": true,
  "report.js": true,
  "strategy-agent-config.js": true,
  "strategy.js": true,
  "wealth.js": true
}
```

## 本地HTTP

```json
{
  "index": 200,
  "pyramid_css": 200,
  "pyramid_js": 200,
  "business_image": 200,
  "investment_image": 200,
  "charity_image": 200,
  "legacy_image": 200
}
```
