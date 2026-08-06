# AI-Mindfulness

MIED（正念干预哀伤）AI 功能原型。当前 `develop` 分支用于腾讯云中国站 EdgeOne Makers 的小范围内部测试；仅内测成员可填写本人手机号后六位用于追踪匹配，其他内容应使用虚拟数据，不得录入真实研究参与者信息。

## 在线版本

- 腾讯云长期链接：<https://balance2607-d8gv98m3ic5ebe21a-1461999613.tcloudbaseapp.com/mied/index.html>
- GitHub Pages 海外链接：<https://cuiliechuan1.github.io/AI-Mindfulness/>

两个入口使用相同的 v18 测评页面和账户界面。研究人员登录后台后可通过“进入参与者端”切换到参与者页面，并可从参与者页面返回后台。当前账户、填写记录和手机号后六位只保存在当前浏览器中，不会跨设备同步；该版本仅用于内部演示与匿名测试，不是集中式研究数据采集系统。

## 本地检查

```bash
npm ci
npm run build:cloudbase
npm run auth:init
npm run check
```

本项目是无第三方运行时依赖的静态 HTML 应用，构建输出为 `dist/`。`npm run auth:init` 仅在首次配置或经过批准的密钥轮换时运行；日常检查不会静默更换密钥。内测访问门槛由 EdgeOne Middleware 与 Edge Function 实现；密码和会话签名私钥只能保存在服务端环境变量中。

完整部署、环境变量、回滚与安全说明见 [DEPLOYMENT.md](DEPLOYMENT.md)。
