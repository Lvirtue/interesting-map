# 中国行政区划网站

首页全国矢量地图、省级地图、行政区划目录和邮箱注册/登录共用一个 Node 服务。点击全国地图的省份会显示概况，点说明框箭头进入省图；省图展示所有地级行政区，右侧名录按行政代码排序，省直辖县级单位单列。目录公开可查，数据读取项目内的 `public/divisions.js`，不依赖线上行政区划接口；用户及会话存入本地 SQLite。

地图边界来自 [cn-atlas](https://github.com/BarbarossaWang/cn-atlas) 的 2023 年 TopoJSON（上游为 [shengshixian.com](https://github.com/ruiduobao/shengshixian.com)，包声明 ISC，上游仓库 MIT）。`assets/cn-atlas-2023.json` 为生成输入，运行 `npm run build:map` 将边界投影为 `public/map-data.json` 供浏览器离线加载。**边界为 2023 版，区划名录为 2025 年末版，不能作为法定边界或审图成果使用。** 台湾省 710000 是地图参考码，民政部快照该项代码标为“资料暂缺”。

目录可切换“按层级”和“按类型”视图。类型选项取自本地官方数据，并额外提供跨级的“市”（直辖市、地级市、县级市）；筛选后的树保留上级节点作为定位路径，仍按代码排序并逐级展开。名称/代码搜索可以与类型筛选组合使用。

历史代码页 `public/retired.html` 收录有旧版代码表和官方调整依据可交叉核验的部分地级停用代码，按原代码排序，支持搜索、查看详情、导出当前搜索结果的 CSV/JSON。数据保存在 `public/retired-divisions.json`，详情附调整依据及历史代码来源。该目录**不是全部历年停用代码**；调整批准年份不代表代码停用的准确日期。现行对应代码按本站 2025-12-31 快照核对。

已采集的地级行政区词条旁有“详情”链接，展示从中文维基百科自动摘录的精简概况与历史沿革；省级概况也显示于地图说明框。未采集的词条仍按原样展示区划树，目录标明当前收录量。原始文章及修订信息按代码缓存至 `data/wiki-prefectures/` 与 `data/wiki-provinces/`（不提交），加工后的 `public/prefecture-profiles.json` 和 `public/province-profiles.json` 随网站静态发布。百科资料不是行政代码的核实依据，人口、经济数字也不是实时统计；摘要以 CC BY-SA 4.0 署名并保留修订版本链接。

首次更新概况资料时，从维基媒体官方数据转储下载多流索引，再运行：

```sh
curl -L -o data/wiki-prefectures-index.txt.bz2 https://dumps.wikimedia.org/zhwiki/latest/zhwiki-latest-pages-articles-multistream-index.txt.bz2
npm run fetch:profiles
npm run build:profiles
```

导入器只下载目标词条所在的压缩分块，支持断点续传；HTTP 429 限流后等待 300 秒重试同一分块。索引与数据转储必须来自同一次转储发布，更新时应一起刷新。默认跳过已有缓存；指定 `python3 scripts/fetch-prefecture-dump.py --refresh` 可重新抓取全部省、地级文章。网络采集仅在更新资料时进行，网站查询只读取本地文件。加工脚本不会为原文缺失的栏目编造内容。

## 仓库结构

| 路径 | 类型 | 用途 |
| --- | --- | --- |
| `server/` | 服务端源码 | Express 入口与邮箱登录/注册逻辑；`npm run dev` 和 `npm start` 均运行 `server/index.mjs` |
| `public/*.js`（除 `divisions.js`） | 浏览器端源码 | 页面交互、搜索、筛选与账户操作，由浏览器直接加载 |
| `public/*.html`、`public/*.css` | 静态资源 | 首页、目录、账户页面及样式，由 Express 直接提供 |
| `public/divisions.js` | 生成的静态数据 | `npm run build:data` 从官方快照生成，供浏览器读取；需要保留在仓库中供部署使用 |
| `public/retired-divisions.json` | 历史静态数据 | 已核实的停用代码、对应区划及来源，由浏览器本地查询和导出 |
| `public/prefecture-profiles.json` | 概况静态数据 | 从本地百科原文加工的地级行政区摘要，含修订来源 |
| `public/province-profiles.json`、`public/map-data.json` | 地图静态数据 | 省级概述及投影后的矢量边界，部署时保留 |
| `assets/cn-atlas-2023.json` | 边界输入 | 2023 年 TopoJSON，供 `npm run build:map` 复现 |
| `official-xzqh-2025.json` | 原始数据 | 行政区划官方快照，是生成 `public/divisions.js` 的输入 |
| `scripts/`、`test/` | 开发工具与测试 | 数据生成脚本和自动化测试，不是服务运行入口 |
| `package.json`、`package-lock.json`、`.env.example` | 项目配置 | 依赖、命令与环境变量模板 |
| `node_modules/` | 本地依赖 | `npm install` / `npm ci` 生成，不提交；其中的 `.bin/` 是依赖安装提供的命令 |
| `data/`、`.env`、`certs/` | 本地运行数据与机密 | SQLite 数据、实际环境变量与证书，不提交或公开 |

本项目没有自行编译的 `bin/` 或可执行发布文件。部署时拉取源码和静态文件，在服务器运行 `npm ci` 安装依赖；不要将 `node_modules/` 或运行时数据打包进 Git 仓库。

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
