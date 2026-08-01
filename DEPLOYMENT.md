# EdgeOne Makers 内测部署说明

## 环境用途

- 用途：MIED AI demo 的小范围功能与体验测试。
- 数据边界：仅使用虚拟账号和虚拟数据；不得输入真实研究参与者信息。
- 平台：腾讯云中国站 EdgeOne Makers。
- 项目名称：`mied-ai-internal-test`（名称冲突时仅首次改用带简短日期的名称，之后始终复用同一项目）。
- 部署环境：`preview`，使用 EdgeOne 默认临时访问网址。
- 部署分支：`develop`。
- 不在此阶段绑定域名、修改 DNS、办理 ICP 备案或配置 GitHub Actions。

## 构建配置

- 安装命令：`npm ci`
- 构建命令：`npm run build`
- 输出目录：`dist`
- 完整检查：`npm run check`

首次配置先运行 `npm run auth:init`；日常的 `npm run check` 只复用现有本机凭据，不会静默轮换密钥。检查会构建静态文件、检查常见密钥格式与路径，并执行语法检查和测试。构建产物只包含 `index.html`、`internal-login.html` 和 `robots.txt`；Edge Function 与 Middleware 由 EdgeOne CLI 从项目根目录识别。

## 内测访问控制

1. `edge-functions/api/internal-auth.js` 在服务端读取密码和 ECDSA P-256 私钥。
2. 验证成功后，服务端签发最长 8 小时的 `HttpOnly`、`SameSite=Strict` 会话 Cookie；线上 HTTPS 环境同时设置 `Secure`。
3. `middleware.js` 只使用可以公开的验签公钥，未验证请求会被重定向到内测登录页。
4. 密码失败限制为同一边缘实例/IP 在 15 分钟内最多 5 次；这是轻量的实例内限制，不是跨全部边缘节点的全局持久限流。若后续扩大测试范围，应在批准后接入平台级 WAF、KV 或持久存储。
5. 此门槛用于降低默认网址被偶然访问的风险，不代替正式身份系统、研究数据平台或临床服务安全控制。

## 环境变量

只在 EdgeOne Makers 服务端配置以下变量，不得写入 HTML、前端 JavaScript、`edgeone.json` 或 Git：

- `INTERNAL_TEST_PASSWORD`：内测访问密码。
- `INTERNAL_TEST_SIGNING_PRIVATE_KEY`：Base64 编码的 PKCS#8 ECDSA P-256 会话签名私钥。

首次在本机生成（命令不会打印密码或私钥）：

```bash
npm run auth:init
```

生成值位于被 Git 忽略的 `.internal-test-secrets/`。不要在聊天、Issue、Pull Request、终端截图或日志中粘贴其内容。公钥会自动写入 `middleware.js`，公钥不属于秘密。

在另一台机器上首次运行会生成新的密钥对并更新仓库公钥。除非同时更新 Makers 中的 `INTERNAL_TEST_SIGNING_PRIVATE_KEY`，不得提交该公钥变化。需要轮换时使用 `npm run auth:init -- --rotate`，并把私钥环境变量和公钥作为同一次受控更新完成。

登录并关联同一个 Makers 项目后，可在 PowerShell 中从本机文件读取值并直接传给官方 CLI，避免把真实值写进命令历史：

```powershell
$internalTestPassword = (Get-Content .internal-test-secrets/password.txt -Raw).Trim()
$internalSigningKey = (Get-Content .internal-test-secrets/signing-private-key.pkcs8.b64 -Raw).Trim()
edgeone makers env set INTERNAL_TEST_PASSWORD $internalTestPassword
edgeone makers env set INTERNAL_TEST_SIGNING_PRIVATE_KEY $internalSigningKey
Remove-Variable internalTestPassword, internalSigningKey
```

## 本地测试

使用腾讯官方 EdgeOne CLI 启动本地环境，不使用第三方静态服务器：

```powershell
npm ci
npm run check
$env:INTERNAL_TEST_PASSWORD = (Get-Content .internal-test-secrets/password.txt -Raw).Trim()
$env:INTERNAL_TEST_SIGNING_PRIVATE_KEY = (Get-Content .internal-test-secrets/signing-private-key.pkcs8.b64 -Raw).Trim()
$env:PAGES_SOURCE = 'skills'
edgeone makers dev --name mied-ai-internal-test --skip-env-sync
```

完成测试后关闭开发服务并移除当前 PowerShell 进程中的变量：

```powershell
Remove-Item Env:INTERNAL_TEST_PASSWORD, Env:INTERNAL_TEST_SIGNING_PRIVATE_KEY
```

## 首次部署与手动更新

首次部署服务端函数项目前执行：

```powershell
$env:PAGES_SOURCE = 'skills'
edgeone makers init
```

以后每次都在 `develop` 分支、同一项目名称上重新部署预览环境：

```powershell
git switch develop
git pull --ff-only origin develop
npm ci
npm run check
$env:PAGES_SOURCE = 'skills'
edgeone makers deploy -n mied-ai-internal-test -e preview --json
```

若首次创建时因重名实际采用了带日期的名称，后续命令必须替换为已经创建并记录在 `edgeone.json` 中的实际项目名，不得重复创建项目。

## 回滚

1. 在 `develop` 上确认需要回退的部署提交。
2. 使用 `git revert <commit>` 创建可审计的回滚提交，不使用破坏历史的强制重置。
3. 运行 `npm ci && npm run check`。
4. 对同一个 Makers 项目再次运行 preview 部署命令。
5. 在线验证登录门槛、首页、静态资源和主要导航。

## 永远禁止提交

- `.env`、`.env.local`、`.env.production` 和其他含真实值的环境文件。
- `.edgeone/.token`、`.edgeone/auth.json` 或其他认证文件。
- `.internal-test-secrets/` 中的密码、公钥源文件和私钥。
- `node_modules/`、`dist/`、缓存和本地日志。
- 腾讯云密钥、EdgeOne Token、GitHub Token、模型 API Key、数据库密码、管理员明文密码。
- 真实姓名、电话、邮箱、研究参与者记录或其他可识别数据。
