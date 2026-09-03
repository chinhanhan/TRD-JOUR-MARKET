# Firebase Spark 免费方案（v205）

网站继续使用现有 Firebase Spark 项目 `trd-journal-market`。不升级 Blaze，不部署云函数，不配置 Secret Manager 或 webhook。超出 Spark 免费额度时，相关云服务可能受限；本地日志与备份功能仍保留。Stripe 自身的收款手续费不属于 Firebase 费用。

## 日常使用

- 登录、20 笔免费记录、离线保存和云同步保持可用。
- 收款仍用现有 Stripe Payment Links 或 TNG/DuitNow QR。
- 用户付款后通过页面的支持入口发送收据；旧兑换码也交由支持人工核验。页面不会自动发送 WhatsApp 消息。
- 必须在实际 Stripe 订单 / 银行流水中核对收款、套餐与 Firebase UID；聊天截图或支付回跳参数不能单独作为开通依据。
- 没有付款用户时，无需执行任何开通操作。

## 确认收到付款后的管理员操作

1. 打开 Firebase Console → Firestore Database → Data → `users` → 用户发来的 UID，核对 email。
2. 只编辑该文档中的 `subscription` 字段，不修改 `data/state`、其他用户或任何交易。
3. 设置以下字段；保存后页面的资料监听会更新会员权限，用户也可点击 **Check activation status**。

| 字段 | 类型 | 值 |
| --- | --- | --- |
| `plan` | string | `pro` |
| `status` | string | `active` |
| `tier` | string | `monthly` / `quarterly` / `yearly` / `lifetime` |
| `limit` | number | `999999` |
| `provider` | string | `manual_stripe` 或 `manual_tng` |
| `validUntil` | string | 到期时间的 ISO UTC 字符串，例如 `2026-10-03T00:00:00.000Z`；示例不是当前用户的到期日 |
| `validUntilTimestamp` | timestamp | 与 `validUntil` 相同的时刻；有期限套餐必须填写 |

月 / 季 / 年套餐根据实际已付款账期填写到期时间；Stripe 订阅续费需要逐次核验并更新，当前没有自动续费授权同步。TNG 套餐可按已售条款从现有未到期日或当前日开始延长。终身套餐使用 `tier=lifetime`，`validUntil` 可设为 `2099-12-31T23:59:59.999Z`。

取消自动续费需在 Stripe Dashboard 操作对应订阅；网站当前没有自助客户门户。取消续费不等于立即撤销已经付款的有效期。确认退款 / 撤权时，将该用户 `subscription.plan` 设为 `free`、`status` 设为 `revoked`、`limit` 设为 `20`；保留其历史日志。

不要在网站前端或聊天中填写管理员密钥。管理员通过 Firebase Console 登录处理，普通用户无权改动订阅。

## 发布

```sh
npm test
npm ci --prefix functions
npx firebase-tools emulators:exec --only firestore --project demo-trd-audit 'node --test tests/firestore-rules.test.cjs'
npm run prepare:hosting
npx firebase-tools deploy --only firestore:rules --project trd-journal-market
npx firebase-tools deploy --only hosting
```

`functions/` 中依赖用于本地回归测试；当前 `firebase.json` 未注册 Functions，不会部署后端。GitHub 的 `main` 推送执行自动回归检查和 `dist/` 构建，不发布 GitHub Pages；正式网站由 Firebase Hosting 提供。
