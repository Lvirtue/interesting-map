# 中国行政区划网站

首页、行政区划目录和邮箱注册/登录共用一个 Node 服务。目录公开可查，数据读取项目内的 `public/divisions.js`，不依赖线上行政区划接口；用户及会话存入本地 SQLite。

目录可切换“按层级”和“按类型”视图。类型选项取自本地官方数据，并额外提供跨级的“市”（直辖市、地级市、县级市）；筛选后的树保留上级节点作为定位路径，仍按代码排序并逐级展开。名称/代码搜索可以与类型筛选组合使用。

## 本地启动

需要 Node.js 22.13 或更新版本：

```sh
npm install
npm run dev
```

访问 `http://127.0.0.1:3000`。没有配置 SMTP 时，开发模式会将验证链接输出到服务端终端；点击该链接即可在本地完成邮箱验证。这**不会发送真实邮件**。重启开发服务会使未设置固定密钥的已有会话失效。

## 发送真实邮件

在项目根目录按 `.env.example` 创建 `.env`，配置 `BETTER_AUTH_URL`（网站公开访问地址）、稳定且随机的 `BETTER_AUTH_SECRET`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_FROM`，如邮件服务商要求认证，再配置 `SMTP_USER` 和 `SMTP_PASSWORD`。不要把 `.env` 提交到版本库。

生产模式 `npm start` 要求 HTTPS 网站地址及 SMTP 配置；请使用 Caddy 或 Nginx 在同一域名上启用 HTTPS 并转发到本机 `127.0.0.1:3000`。部署前备份 `data/`（SQLite 主文件及 WAL），不要公开该目录。反向代理应保留 `Host` 以及 HTTPS 协议头。生产服务的环境变量还应设置稳定的 `BETTER_AUTH_SECRET`；设置 `HOST` 可以更改监听地址。

## 行政区划数据

数据取自[民政部行政区划代码](https://dmfw.mca.gov.cn/XzqhVersionPublish.html)公开页面使用的接口：

```text
GET https://dmfw.mca.gov.cn/xzqh/getList?code=0&trimCode=true&maxLevel=3
```

原始快照为 `official-xzqh-2025.json`，截止日期为 2025-12-31。更新快照后运行 `npm run build:data`，再运行 `npm test`。直辖市和省直辖县级行政区直接使用官方树层级；港澳台只显示省级。省、地级代码在页面按六位格式补零展示；台湾省代码在官方接口中标为“资料暂缺”。
