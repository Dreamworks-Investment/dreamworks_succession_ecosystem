# 战略定位智能体入口配置

打开：

`js/strategy-agent-config.js`

将：

```javascript
window.STRATEGY_INTERACTION_URL = '';
```

替换为正式智能体地址，例如：

```javascript
window.STRATEGY_INTERACTION_URL = 'https://your-agent.example.com/';
```

配置后，第二章末尾会：
1. 隐藏“互动入口待接入”；
2. 显示“进入战略定位智能体”；
3. 通过新标签页打开智能体。

未配置地址时不会展示可点击的假入口。
