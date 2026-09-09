# 2026-09-09 静态完整性与重复执行清理

## 检查结果

- 所有 JavaScript / CJS 文件语法通过，HTML 313 个 ID 无重复，本地资源无缺失。
- 清除 `summaryCardsFor`、`monthlyCards` 和 `mediaBadges` 的失效重复定义；保留当前实际生效的统计与风控徽章行为。
- 首页模块卡片、顶部 Log Trade、Start Trade 和 Dock 改为单一点击入口，避免一次点击重复打开、重复播放声音或重复渲染。
- `triggerBentoAction` 只保留 `app.js` 的主实现；经济新闻禁用占位函数只保留一份。
- `longGameLogic.js` 纳入与其他运行脚本一致的 v211 浏览器缓存版本。

## 防回退检查

- 新增静态完整性测试，持续检查重复 HTML ID、缺失本地资源、重复顶层函数、Hosting / Service Worker 清单漂移、资源版本漂移和重复点击入口。
- 同一测试固定验证 `saveState()` 首行、R 倍数公式、SOP 偏好清理和 Cloud Sync 禁用原生 `alert()`。
- 原有交易数据、IndexedDB、Firestore、付费方案与业务计算没有迁移或结构改动。
