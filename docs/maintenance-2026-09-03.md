# 2026-09-03 维护记录与发布准备

> **最新决策：用户要求保持完全免费的 Firebase 方案。v205 改用 Spark + 人工确认收款开通，取代下文 v204 的付费后端发布计划。Blaze、Functions、Stripe webhook 不再是当前上线前提。详见 [免费方案运营](free-plan-operations.md)。下文保留早期检查过程供追溯。

本轮改动整理为 `codex/release-v204` 发布候选版本。生产发布因下述 Firebase
计费与支付配置阻碍暂停，不能将候选版本视为已上线版本。工作区原有的
`.firebase/hosting..cache` 修改未纳入本轮修复。

## 已完成的代码修复

- `saveState()` 第一行同步 `window.state = state`。IndexedDB 按 UID 分区，写事务完成后才报告保存成功；失败保留内存数据并提示备份。
- 云同步采用显式接口、写入队列和 Firestore 事务；删除记录留下同步标记，避免离线设备恢复已删除交易或 SOP。SOP 删除同时清理偏好与引用。
- 截图缩减仍限制为 750KB；保留本地截图时不覆盖更新的收益数据。纯文本超过限制会报错，保留本地记录。
- 用户切换取消旧会话回调，关闭旧弹窗；截图读取过程中切换用户会取消旧提交。已有用户缓存资料可用于离线启动，订阅缓存不写回服务端。
- 平仓、交易录入防止重复提交；非法平仓结果不会先修改交易状态。后台同步保留正在填写的 Sheet 表单。
- R 统一为净收益 / `trade.risk`。旧 R-only 备份仅在没有明确 P&L 时转换；无有效风险时不伪造 R。
- 月报按月份、账户和平仓时间筛选，排除未平仓交易；内容转义。免费 CSV 导出与首页承诺一致，并保护文本字段的公式前缀。
- 支付跳转参数不再开通 Pro。客户端不可写订阅；兑换码由服务端库存、哈希、事务及限流验证。Stripe webhook 校验签名、订单、价目白名单、用户和账期，重复通知不重复开通。
- 恢复版本化离线缓存；移除线上测试脚本、重复初始化和重复模拟运算。启动卡片展示实际日期、纪律记录和权益。
- Hosting 与 GitHub Pages 仅发布显式列出的 18 个运行文件；备份、截图目录、后端、测试与配置不进入产物。CI 增加回归测试。

## 已执行验证

- `npm test`：45 项通过。Firestore 权限用例默认跳过，已另行运行下方模拟器命令并通过。
- Firestore 模拟器：实际验证同一用户读写、跨用户拒绝、未登录拒绝、禁止自行升级 Pro、禁止写兑换码库存、允许统计资料更新。
- 后端入口加载与 JavaScript 语法检查通过。
- 浏览器使用临时副本、合成用户和内存 Firebase 替身：录入交易、平仓、P&L 覆盖冲突 R 输入、刷新保留交易、A/B 账户隔离、退出回首页、月报筛选表单均已检查；没有写生产 Firestore。
- 月报生成 HTML 的筛选和转义由回归测试验证。内置浏览器没有提供新报告窗口，因此尚未完成真实打印 / PDF 输出检查。
- `npm run prepare:hosting` 生成产物，文件清单和 `git diff --check` 通过。

可重复执行：

```sh
npm test
npm ci --prefix functions
npx firebase-tools emulators:exec --only firestore --project demo-trd-audit 'node --test tests/firestore-rules.test.cjs'
npm run prepare:hosting
```

后端测试包含模拟依赖的处理器测试，不等同于真实 Stripe 沙盒支付或部署后的 callable 端到端测试。

## 发布前必须准备

### 旧数据与版本兼容

新本地键为 `trd-journey-os-v1:user:<uid>`，游客使用 `:guest`。
原来的无用户键没有删除。只有旧数据明确含有匹配的 `ownerUid` 时才自动迁移；
无归属旧缓存不会自动上传到当前账户，避免共享浏览器串号。

**发布前在旧版本上导出每个需要保留的账户 JSON，特别是仅本地存在的大截图。**
上线后登录对应账户再合并导入备份。云端已有记录可以重新下载，但云端曾被缩减的截图不能据此恢复。
System 中新增 Recover previous local backup 入口：已知其他 UID 的备份拒绝恢复；无归属备份需要手动确认这是自己的日志，再进入导入预览。恢复不会删除原始缓存。

同步元数据和新规则要求所有终端刷新到新版本。不要让旧版本继续写入；
也不要直接回滚到能自行开通 Pro 的旧 `auth.js` / 旧规则。

### Firebase Functions 与 Stripe

1. 确认 Firebase 项目支持 Cloud Functions，管理员使用自己的安全凭据部署。
2. 在 Secret Manager / Firebase CLI 中配置 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_TIERS`。不要放在前端、Git 或聊天中。
3. `STRIPE_PRICE_TIERS` 为真实 Stripe **price ID** 到 `monthly`、`quarterly`、`yearly`、`lifetime` 的 JSON 映射。代码不推测价格 ID。
4. 部署 `redeemKey`、`stripeWebhook`（区域 `us-central1`），在 Stripe 注册返回的 webhook 地址，订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`invoice.paid`。
5. 确认现有 Payment Links 将登录 Firebase UID 作为 `client_reference_id`，真实订单的价目与映射一致。在 Stripe 测试模式跑完支付、续费和重复通知，再部署新规则和前端。
6. TNG/DuitNow 仍由管理员确认收款后发码。旧“只要前缀匹配”的码不再有效；须将已售未兑换码导入服务端库存，或重新发放随机码。

管理员发新码的脚本为 `functions/issue-code.cjs`，需要 ADC 和明确的 `GCLOUD_PROJECT`；本轮未运行发码脚本。

新前端依赖新兑换后端。**不要单独上线本轮前端。** GitHub `main` 推送会自动发布 Pages，推送前也需要完成上述配置。

后端及规则就绪后的 Hosting 发布命令保持：

```sh
npx firebase-tools deploy --only hosting
```

上述命令仅部署 Hosting，不部署 Functions 或 Firestore Rules。

## 待继续处理

- 服务端免费额度已补齐并通过模拟器验证；生产生效前仍需部署新规则及执行下述旧订阅时间字段迁移。
- 真实 Stripe 沙盒 / Firebase callable 端到端测试及生产配置。
- 退款、争议、管理员撤权仍需显式人工操作，未实现自动撤销流程。
- 单文档长期增长后的分文档迁移；当前继续保留 750KB 保护及本地备份提示。
- 真实 Firebase 登录状态下的设备离线重启和重新联网测试；当前已验证静态应用缓存及 UID 资料缓存逻辑。
- 法务页目前还是占位入口，内容与商家资料需要确认后补齐。

## 本次继续修复的结果

- 新增 `backupCore.js`：拒绝不相关 / 损坏 JSON，过滤原型键及旧同步元数据；确认导入时读取最新状态，保留 Long Game 各类记录。
- 转义截图、记录 ID、日期和行为分析内容；内联事件参数同时处理 HTML / JavaScript 上下文；外链限制为 HTTP(S)，截图允许标准位图 data URL，iframe 加入 sandbox。
- 分组对象不再受 `__proto__`、`constructor` 等策略名影响。
- 最大回撤和权益序列按平仓时间排序；热图按实际记录的 Session 分类，移除无法从无时区旧数据可靠推断的纽约上午 / 下午分组。
- 手机风控卡片采用换行布局；表单标签关联控件；Sheet 增加名称、Tab 焦点循环及关闭后的焦点恢复。启动器覆盖的后台视图不参与键盘导航。
- 计划、复盘、设置和自我反省等待持久化成功；“清空全部”也清理 Long Game、奖励和经验；“恢复演示”不再受已清除演示标记影响。
- 后台同步保留活动页面及 Sheet 中的未提交输入。手动重跑 Monte Carlo 会重新采样，普通重绘仍使用缓存。
- Service Worker 第一次接管页面不再突然刷新；只有点击更新按钮后才自动重载。版本更新为 v204。
- 已检查 390px 手机视口的 Today、Journal、System、Review 及录入表单，无页面级横向溢出；修复前后的风控卡片均通过截图核验。
- 临时服务停止后，浏览器仍从 Service Worker 缓存重新加载并进入应用。此验证使用合成 Firebase 替身，不代表真实支付 / Auth 网络端到端验证。
- 免费用户超过云端额度时明确提示本地数据仍保留；权限拒绝不再自动反复重试。开通 Pro 的资料更新会重新触发同步。
- CI 除普通回归测试外，增加 Java 21、Firebase 依赖安装和实际 Firestore 模拟器规则测试。

### 新增规则发布前的订阅迁移

规则以服务端 `validUntilTimestamp` 判断普通 Pro 是否仍在付费期内。旧版本可能仅存 ISO `validUntil`，上线新规则前先用管理员 ADC 运行：

```sh
# GCLOUD_PROJECT 必须事先设为确认过的目标项目。
node functions/migrate-profiles.cjs
# 检查 dry-run 结果后才应用：
node functions/migrate-profiles.cjs --apply
```

脚本只补充时间戳，事务内重新检查最新资料，不改变套餐、状态或日志；无有效到期日期的记录需要管理员核查。本轮未运行生产迁移。

规则允许免费账户最多保存 20 笔。已有 20 笔以上的过期账户可保留、编辑、减少历史记录，不能继续增加记录数量；不会自动删除超额记录。

- 最后补充的恢复流程实测：含引号的记录 ID、HTML 样式文本、无效截图链接均可安全显示；手动认领 → 预览 → 合并 → 交易详情成功，恢复后统计为预期 +3R。仅含交易的旧备份不再额外生成默认 SOP。

## 发布前最终检查（2026-09-03）

- 本地与远端 `main` 均起于 `53a4b16`，没有待合并的远端提交。
- Firebase Hosting 站点确认是 `https://trd-journal-market.web.app`，HTTP 200；当前线上 `app.js` / `auth.js` 仍为 v193。
- Firebase 账号可读取 Hosting 站点，但 Cloud Functions API 返回 403 `SERVICE_DISABLED`。
- 读取 Secret Manager 元数据时，Firebase CLI 明确要求先升级 Blaze；Cloud Billing API 确认 `billingEnabled: false`。没有读取支付密钥内容，也没有修改计费设置。
- 因 Secret Manager 尚不可用，无法核实三项 Stripe 密钥、真实 price ID 映射和 webhook 配置。真实支付端到端验收与旧订阅迁移尚未执行。
- 兑换成功后改为强制读取服务端资料，避免继续使用旧免费缓存；读取期间退出账号不会重新打开旧账号，并在开通 Pro 后重试待同步数据。新增两项回归用例通过。
- 最终结果：45 项普通测试通过，1 项 Firestore 模拟器规则测试单独通过；18 个公开运行文件构建成功，差异格式检查通过。

**发布决策：候选代码可保存到 GitHub 的 `codex/release-v204` 分支，暂不合并 `main`、不部署 Firebase。**
`main` 推送会自动部署 GitHub Pages；后端未准备完成时不能触发此流程。

下一步由项目所有者在 Firebase 控制台启用 Blaze 并配置安全的 Stripe 服务端凭据与价目映射，
随后依次完成云函数、webhook 验证、旧订阅迁移、新规则、前端的协调发布。


## v205 免费方案发布检查

- 用户明确不接受 Firebase 付费方案，因此保留 Spark；从 `firebase.json` 移除 Functions 部署配置，生产前端没有云函数请求。
- 原有 Stripe Payment Links、TNG/DuitNow QR 保留。付款页、常见问题及回跳提示明确说明需人工确认收款，去除即时开通和五分钟审批承诺。
- 原兑换入口替换为联系支持验证收据 / 旧兑换码及查询开通状态。账号 UID 随用户主动点击后的 WhatsApp 草稿传递；没有自动发送消息。
- Pro 仍仅由管理员修改 Firestore 订阅资料，客户端不能自行升级；开通后实时资料监听和主动查询会刷新权限。云函数代码留作未部署的备选实现。
- 生产资料只读检查：1 个已有 Pro 资料，无待补充的到期时间字段，无无效到期字段；未修改现有会员或交易数据。
- 本次 47 项普通回归测试通过，Firestore 规则用例单独运行；公开产物仍为 18 个文件。新增人工开通查询、待审核反馈、账号切换与支持链接回归测试。
- 部署仅涉及 Firestore Rules、Firebase Hosting；GitHub 保存源码并执行检查，不启用结算账户或付费服务。


### v205 发布结果

- `npx firebase-tools deploy --only firestore:rules --project trd-journal-market` 成功。
- `npx firebase-tools deploy --only hosting` 成功，正式站为 https://trd-journal-market.web.app 。
- 部署后逐一核对 18 个线上运行文件与本地发布产物的 SHA-256；全部一致。正式首页在浏览器中加载成功。
- 部署后 Cloud Billing 再次确认 `billingEnabled: false`，没有升级套餐。
- Firestore 模拟器规则测试通过；人工开通流程的浏览器测试使用合成账号，没有创建真实订单或会员。
- 后续维护以免费方案为准。v204 的 Blaze / webhook 配置步骤仅作为未启用方案的历史记录。

- GitHub 正式分支已推送 v205。后续核查发现仓库从未启用 Pages，旧流程在配置 Pages 时返回 404（此前版本也失败）。现改为纯回归检查与公开产物构建，Firebase 作为唯一正式托管；没有新增第二套托管服务。
