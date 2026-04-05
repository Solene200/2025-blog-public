# 2025 Blog 项目讲解（初学者版）

这份文档的目标不是只告诉你“哪个文件干了什么”，而是帮你真的看懂这个项目为什么这样设计、数据怎么流动、每一层应该怎么读。

## 1. 先用一句话认识这个项目

这是一个基于 `Next.js App Router` 的个人博客项目，但它不只是“展示博客”。

它同时包含：

- 前台展示站点
- 前台可视化编辑能力
- 博客写作后台
- 图片/项目/分享/博主管理页面
- 使用 `GitHub App + GitHub API` 直接把内容写回仓库

你可以把它理解成：

```text
Next.js 前端 + GitHub 仓库当内容仓库/数据库 + GitHub App 当写权限入口
```

也就是说，这个项目的“后端数据库思路”不是 MySQL / MongoDB，而是：

- 内容存在仓库文件里
- 前端读取这些文件展示
- 用户在页面上编辑后，再通过 GitHub API 提交 commit

这也是这个项目最核心、最特别的地方。

## 2. 技术栈总览

根据 `package.json`，这个项目的主技术栈是：

| 技术 | 版本/状态 | 在项目里的作用 |
| --- | --- | --- |
| `Next.js` | `16.0.10` | 整个应用框架，负责路由、构建、部署 |
| `React` | `19.x` | UI 组件开发 |
| `TypeScript` | `5.x` | 类型约束，主开发语言 |
| `JavaScript` | 允许混用 | `tsconfig.json` 里开启了 `allowJs: true` |
| `Tailwind CSS` | `v4` | 原子化样式系统 |
| `motion` | `12.x` | 页面动画、卡片动画、弹窗动画 |
| `Zustand` | `5.x` | 全局状态管理 |
| `SWR` | `2.x` | 拉取博客索引、分类等远程/静态数据 |
| `marked` | `17.x` | Markdown 解析 |
| `shiki` | `3.x` | 代码高亮 |
| `katex` | `0.16.x` | 数学公式渲染 |
| `jsrsasign` | `11.x` | 在浏览器里给 GitHub App 签 JWT |
| `sonner` | `2.x` | 提示消息 toast |
| `@svgr/webpack` | 已启用 | 把 `.svg` 当 React 组件导入 |
| `@opennextjs/cloudflare` | 已启用 | 支持部署到 Cloudflare |

### 2.1 你提到的技术栈，对应关系是这样

- `ts, js`：项目主体是 TypeScript，但允许 JS 文件存在
- `next.js`：整个项目的应用框架
- `tailwind css`：项目里确实在用，而且是 Tailwind v4
- `motion`：页面和弹窗动画几乎都靠它
- `github ap`：准确说是 `GitHub App + GitHub REST API + Git Data API`
- `react`：所有界面都是 React 组件

### 2.2 一个初学者很容易疑惑的点：为什么没有 `tailwind.config.js`？

因为这是 `Tailwind CSS v4` 的写法。

它主要通过这些文件工作：

- `src/styles/globals.css`
- `src/styles/theme.css`
- `postcss.config.mjs`

你会看到：

- `@import 'tailwindcss';`
- `@plugin 'tailwindcss-animate';`
- `@theme { ... }`
- `@utility ...`

也就是说，这个项目把很多 Tailwind 配置直接写在 CSS 里了，而不是传统的 `tailwind.config.js`。

## 3. 先看目录，再看代码

项目最重要的目录是这些：

```text
public/
  blogs/                 博客正文、博客配置、博客图片
  images/                各类静态图片资源
  live2d/                Live2D 模型文件
  music/                 音乐资源

src/
  app/                   Next.js App Router 页面
  components/            通用组件
  config/                站点配置、首页卡片配置
  hooks/                 自定义 hooks
  layout/                全局布局与背景
  lib/                   工具库、GitHub API、Markdown 渲染等
  styles/                全局样式
  svgs/                  SVG 图标

scripts/
  gen-svgs-index.js      生成 SVG 索引
```

### 3.1 这个项目最重要的三类数据

#### 第一类：博客内容

放在 `public/blogs/` 里，例如：

```text
public/blogs/xxx/index.md
public/blogs/xxx/config.json
public/blogs/index.json
public/blogs/categories.json
```

这说明博客正文是“文件型内容”。

#### 第二类：页面列表数据

放在 `src/app/**/list.json` 里，例如：

- `src/app/share/list.json`
- `src/app/projects/list.json`
- `src/app/bloggers/list.json`
- `src/app/pictures/list.json`
- `src/app/about/list.json`
- `src/app/snippets/list.json`

这类数据通常被页面直接 `import` 进来。

#### 第三类：站点配置数据

放在：

- `src/config/site-content.json`
- `src/config/card-styles.json`
- `src/config/card-styles-default.json`

这部分控制：

- 网站标题、描述、主题色
- 首页卡片大小/顺序/偏移/开关
- 社交按钮
- 背景图
- 艺术图
- 帽子、备案、圣诞主题等

## 4. 运行方式与构建方式

`package.json` 里最关键的脚本：

```json
"dev": "next dev --turbopack -p 2025",
"build": "next build",
"start": "next start",
"build:cf": "opennextjs-cloudflare build",
"preview": "opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare deploy"
```

### 4.1 本地开发

你本地主要会用：

```bash
pnpm i
pnpm dev
```

它会启动在 `2025` 端口。

### 4.2 部署思路

这个项目明显考虑了两种部署方向：

- 常规 Next.js 部署
- Cloudflare + OpenNext 部署

所以它不是一个只能跑在某一个平台上的项目。

## 5. 先从项目入口开始读

如果你是初学者，最好的入口顺序是：

1. `src/app/layout.tsx`
2. `src/layout/index.tsx`
3. `src/app/(home)/page.tsx`

### 5.1 `src/app/layout.tsx`

这是 App Router 的全局根布局。

它做了几件关键事：

- 引入全局样式 `globals.css`
- 从 `site-content.json` 读取网站标题和描述
- 生成 `metadata`
- 把主题色写进 HTML 的 CSS 变量
- 渲染自定义 `<Head />`
- 用 `Layout` 包裹所有页面

这说明：

- 网站主题不是写死在 CSS 里的
- 而是“配置文件 -> CSS 变量 -> 页面样式”

也就是配置驱动 UI。

### 5.2 `src/layout/index.tsx`

这是所有页面共享的视觉壳子。

它负责：

- 初始化中心点坐标 `useCenterInit()`
- 初始化响应式尺寸状态 `useSizeInit()`
- 渲染背景图和气泡背景
- 渲染 `Toaster`
- 渲染全局导航卡片 `NavCard`
- 桌面端显示音乐卡片 `MusicCard`
- 移动端显示回到顶部按钮

所以你可以把它理解成：

```text
页面内容只是中间那块
全局氛围、悬浮导航、音乐、提示消息，都在 Layout 这一层统一处理
```

## 6. 首页为什么这么“自由摆放”？

首页文件在 `src/app/(home)/`。

这里的 `(home)` 是 Next.js 的“路由分组”语法。

注意：

- 文件夹叫 `(home)`
- 但 URL 不会变成 `/(home)`
- 真正首页仍然是 `/`

### 6.1 首页主入口：`src/app/(home)/page.tsx`

这个文件负责把首页所有卡片组装起来：

- `ArtCard`
- `HiCard`
- `ClockCard`
- `CalendarCard`
- `SocialButtons`
- `ShareCard`
- `AritcleCard`
- `WriteButtons`
- `LikePosition`
- `HatCard`
- `BeianCard`

并且它会根据 `cardStyles.xxx.enabled` 决定某张卡片显不显示。

所以首页不是一个固定写死的页面，而是：

```text
一组可开关、可拖拽、可调大小、可调偏移的卡片系统
```

### 6.2 首页卡片位置怎么计算？

核心答案是两个 hook：

- `src/hooks/use-center.ts`
- `src/hooks/use-size.ts`

#### `use-center`

它会算出浏览器窗口中心点：

- `centerX`
- `centerY`
- 以及一个稍微向上偏移的 `x/y`

很多卡片位置都是“相对中心点”计算出来的。

例如 `HiCard` 通常在正中间，`ArtCard` 在它上方，`SocialButtons` 在它下方。

#### `use-size`

它会计算：

- `maxXL`
- `maxLG`
- `maxMD`
- `maxSM`
- `maxXS`

用来判断当前是不是移动端，决定某些卡片是否隐藏或改布局。

### 6.3 `Card` 组件是首页布局的基础积木

`src/components/card.tsx` 是所有卡片的通用外壳。

它负责：

- 接收 `x / y / width / height`
- 用 `motion` 做入场动画
- 在桌面端用绝对定位摆卡片
- 在移动端弱化顺序和定位逻辑

再结合 `globals.css` 里的 `@utility card`，就形成了项目很有辨识度的“毛玻璃浮层卡片”。

### 6.4 首页为什么能拖拽编辑？

核心在：

- `src/app/(home)/home-draggable-layer.tsx`
- `src/app/(home)/stores/layout-edit-store.ts`
- `src/app/(home)/stores/config-store.ts`

#### `home-draggable-layer.tsx`

它不是卡片本身，而是卡片上面的一层“编辑蒙版”。

当 `editing = true` 时，它会显示：

- 拖拽边框
- 右下角拉伸手柄

然后修改对应卡片的：

- `offsetX`
- `offsetY`
- `width`
- `height`

#### `config-store.ts`

它保存运行时配置：

- `siteContent`
- `cardStyles`
- `configDialogOpen`

#### `layout-edit-store.ts`

它专门保存“布局编辑状态”：

- 是否正在编辑
- 编辑前快照
- 拖拽时改偏移
- 拉伸时改尺寸
- 保存或取消

### 6.5 首页每张卡片大概负责什么？

#### `hi-card.tsx`

首页中心卡片。

内容包括：

- 头像
- 问候语
- 用户名

它是整个首页的视觉中心。

#### `art-card.tsx`

上方大图卡片。

它读取 `siteContent.artImages` 和 `currentArtImageId` 来显示当前首图。

点击会进入 `/pictures`。

#### `clock-card.tsx`

七段数码管风格时钟。

点击会跳转到 `/clock`，进入完整秒表/计时器页面。

#### `calendar-card.tsx`

当前月份日历卡片。

#### `social-buttons.tsx`

首页下方一排社交入口。

它支持：

- 普通链接
- GitHub/Juejin/X/TG/Instagram 等图标
- 邮箱复制
- 微信/QQ 二维码弹出

#### `aritcle-card.tsx`

显示最新文章摘要。

它依赖 `useLatestBlog()`，也就是从博客索引里取最新一篇。

#### `share-card.tsx`

随机展示一条分享资源。

数据来自 `src/app/share/list.json`。

#### `write-buttons.tsx`

包含：

- “写文章”按钮
- 打开首页配置面板的按钮

#### `like-position.tsx`

负责摆放点赞按钮。

点赞按钮本体其实是通用组件 `src/components/like-button.tsx`。

#### `hat-card.tsx`

给头像上方显示帽子装饰。

帽子的编号、是否翻转来自 `siteContent`。

## 7. 首页配置面板是怎么工作的？

首页配置弹窗在：

- `src/app/(home)/config-dialog/index.tsx`

它有 3 个 tab：

- 网站设置
- 色彩配置
- 首页布局

### 7.1 网站设置

组件入口：

- `src/app/(home)/config-dialog/site-settings/index.tsx`

这部分能改：

- 站点标题/描述/用户名
- favicon / avatar
- 备案信息
- 社交按钮
- 艺术图
- 背景图
- 是否显示秒
- 摘要位置
- 是否隐藏编辑按钮
- 是否缓存 PEM
- 是否启用文章分类
- 是否启用圣诞主题
- 帽子配置

### 7.2 色彩配置

在 `color-config.tsx` 里。

它改的是：

- `theme`
- `backgroundColors`

也就是：

- 全局主题色
- 背景浮动气泡颜色

而且支持预设色板和随机配色。

### 7.3 首页布局

在 `home-layout.tsx` 里。

它直接以表格形式编辑：

- 宽度
- 高度
- 显示顺序
- 横向偏移
- 纵向偏移
- 是否启用

### 7.4 配置真正保存到哪里？

保存逻辑在：

- `src/app/(home)/services/push-site-content.ts`

这个文件做的事很重要：

1. 获取 GitHub 安装 token
2. 获取分支最新 commit
3. 如果有图片，先上传图片 blob
4. 生成新的：
   - `src/config/site-content.json`
   - `src/config/card-styles.json`
5. 用 GitHub Git Data API 创建 tree
6. 创建 commit
7. 更新分支 ref

所以“保存配置”本质上不是写本地状态，而是给 GitHub 仓库发一次 commit。

## 8. 博客系统怎么工作的？

博客系统是这个项目的核心业务。

### 8.1 博客文件结构

每篇博客都长这样：

```text
public/blogs/<slug>/
  config.json
  index.md
  图片文件...
```

还有两个总索引：

```text
public/blogs/index.json
public/blogs/categories.json
```

### 8.2 为什么博客数据放 `public/`？

因为详情页是客户端直接 `fetch('/blogs/<slug>/index.md')` 去读的。

换句话说，博客正文不是 build 时打包进 JS，而是作为静态资源直接访问。

这有两个好处：

- Markdown 文件结构清晰
- CDN/静态托管友好

### 8.3 博客列表页：`src/app/blog/page.tsx`

这个页面负责：

- 拉取博客索引
- 按日/周/月/年/分类分组
- 展示已读状态
- 编辑模式下删除文章
- 编辑模式下调整分类

它依赖的 hook：

- `useBlogIndex()`：读取 `/blogs/index.json`
- `useCategories()`：读取 `/blogs/categories.json`
- `useReadArticles()`：本地持久化“已读”

#### 这里的设计非常值得你记住

博客列表页并没有直接去扫描文件夹，而是读索引文件。

也就是说：

```text
文章详情依赖真实文件
文章列表依赖 index.json
```

这是一种很常见也很实用的优化思路。

### 8.4 博客详情页：`src/app/blog/[id]/page.tsx`

详情页做的事情相对单纯：

1. 从 URL 取 slug
2. 调 `loadBlog(slug)`
3. 把 markdown、config、cover 读回来
4. 交给 `BlogPreview` 渲染

如果 slug 是 `liquid-grass`，还会额外挂载一个特效组件。

### 8.5 `loadBlog.ts`

`src/lib/load-blog.ts` 很重要。

它统一读取：

- `/blogs/<slug>/config.json`
- `/blogs/<slug>/index.md`

也就是说：

- 详情页用它
- 编辑页加载文章也用它

这是一种“读文章逻辑复用”的设计。

## 9. Markdown 是怎么变成网页的？

这是这个项目另一个关键点。

渲染链路是：

```text
Markdown 字符串
-> marked 解析
-> shiki 代码高亮
-> katex 数学公式
-> 生成 HTML + TOC
-> html-react-parser 转成 React 节点
-> 替换图片和代码块组件
```

对应文件：

- `src/lib/markdown-renderer.ts`
- `src/hooks/use-markdown-render.tsx`
- `src/components/blog-preview.tsx`
- `src/components/blog-sidebar.tsx`
- `src/components/blog-toc.tsx`
- `src/components/code-block.tsx`
- `src/components/markdown-image.tsx`

### 9.1 `markdown-renderer.ts`

它做了这些事：

- 用 `marked` 解析 Markdown
- 给标题生成 `id`
- 抽出目录 `toc`
- 注册数学公式扩展
- 用 `shiki` 高亮代码块
- 返回 `html + toc`

### 9.2 `use-markdown-render.tsx`

这个 hook 再做第二步：

- 把 HTML 解析成 React 结构
- 把普通 `<img>` 替换成 `MarkdownImage`
- 把 `<pre>` 替换成 `CodeBlock`

所以这个项目并不是“Markdown 直接 innerHTML 塞进去”，而是做了一层 React 化处理。

### 9.3 `blog-preview.tsx`

这是文章页主展示组件。

它负责：

- 标题
- 标签
- 日期
- 摘要
- 正文
- 右侧目录/封面/点赞/回到顶部

## 10. 写作系统怎么工作的？

写作页面在：

- `src/app/write/page.tsx`
- `src/app/write/[slug]/page.tsx`

这两个页面分别代表：

- 新建文章
- 编辑已有文章

### 10.1 写作页面核心状态

最关键的 store 是：

- `src/app/write/stores/write-store.ts`
- `src/app/write/stores/preview-store.ts`

#### `write-store.ts`

它保存：

- 当前模式：`create` / `edit`
- 原始 slug
- 表单内容：标题、slug、markdown、tags、date、summary、hidden、category
- 图片列表
- 封面图
- 是否正在 loading

这相当于“写作后台的数据中枢”。

### 10.2 编辑器：`components/editor.tsx`

这个编辑器不是富文本编辑器，而是“增强版 Markdown 文本框”。

它支持：

- 标题输入
- slug 输入
- Markdown 正文输入
- 快捷键：
  - `Ctrl/Cmd + B` 加粗
  - `Ctrl/Cmd + I` 斜体
  - `Ctrl/Cmd + K` 插链接
  - `Tab` 缩进
- 粘贴图片自动进入图片列表

### 10.3 写作时图片怎么处理？

这是初学者很容易看不懂的点。

#### 编辑时

本地图片不会立刻有正式 URL。

所以项目先插入这种占位写法：

```md
![](local-image:abc123)
```

#### 预览时

`use-write-data.ts` 会把 `local-image:xxx` 替换成浏览器本地 `blob:` 预览地址。

#### 发布时

`push-blog.ts` 会：

1. 给图片算 hash
2. 上传到 `public/blogs/<slug>/`
3. 把 Markdown 里的 `local-image:xxx` 换成正式 URL

所以它是一个“三阶段图片流”：

```text
本地文件 -> 占位符 -> 本地预览 URL -> GitHub 上传后正式 URL
```

### 10.4 预览模式

`preview.tsx` 会复用博客展示组件 `BlogPreview`。

这说明项目没有写两套文章渲染逻辑，而是：

- 预览和正式文章尽量共用同一套显示组件

这是一个很好的工程习惯。

### 10.5 发布逻辑：`push-blog.ts`

这是写作系统最核心的服务文件。

它会：

1. 校验 slug
2. 获取 GitHub token
3. 取当前分支最新 commit
4. 上传本地图片
5. 生成 `index.md`
6. 生成 `config.json`
7. 更新 `public/blogs/index.json`
8. 创建 tree / commit / update ref

#### 一个很重要的限制

在编辑模式下：

- 不允许修改 slug

这是为了避免“文章目录重命名”带来的复杂文件迁移问题。

### 10.6 删除文章：`delete-blog.ts`

删除逻辑会：

- 找到 `public/blogs/<slug>/` 下所有文件
- 一次性从 git tree 里删掉
- 再同步更新 `public/blogs/index.json`

## 11. GitHub App 授权链路，是整个项目的“后端”

如果你只能记住这个项目一个核心设计，那就是这里。

### 11.1 相关文件

- `src/hooks/use-auth.ts`
- `src/lib/auth.ts`
- `src/lib/github-client.ts`
- `src/lib/aes256-util.ts`

### 11.2 授权流程

页面上导入 `.pem` 私钥后，会发生这些事：

1. `useAuthStore.setPrivateKey()` 保存私钥到 Zustand
2. 如果开启了 `isCachePem`，会把 PEM 加密后存进 `sessionStorage`
3. 需要写仓库时，调用 `getAuthToken()`
4. `getAuthToken()` 会：
   - 用私钥签发 GitHub App JWT
   - 查询这个仓库对应的 installation id
   - 创建 installation token
5. 后续所有写操作都带着这个 token 调 GitHub API

### 11.3 `github-client.ts` 干了什么？

它封装了 GitHub API 请求，例如：

- `getRef`
- `createBlob`
- `createTree`
- `createCommit`
- `updateRef`
- `readTextFileFromRepo`
- `listRepoFilesRecursive`

这意味着本项目的“保存内容”本质上就是手动走一遍 git object 流程：

```text
blob -> tree -> commit -> ref
```

这也是为什么我前面说：这个项目的 GitHub 仓库，本身就像数据库。

### 11.4 对初学者来说，这个设计意味着什么？

意味着这个项目几乎没有传统后端接口层。

不是：

```text
前端 -> 你自己写的后端 -> 数据库
```

而是：

```text
前端 -> GitHub API -> GitHub 仓库
```

## 12. 为什么有的内容在 `public/`，有的内容在 `src/app/**/list.json`？

这是项目理解里的关键分层。

### 12.1 放在 `public/` 的内容

适合“运行时直接 fetch 的内容”，例如：

- 博客 Markdown
- 博客配置
- 博客图片

因为它们本来就是静态资源。

### 12.2 放在 `src/app/**/list.json` 的内容

适合“页面直接 import 的列表型数据”，例如：

- 项目列表
- 分享列表
- 博主列表
- 关于页内容

这类数据更像“页面配置”而不是“单独内容文件”。

### 12.3 放在 `src/config/` 的内容

适合“全站级设置”，例如：

- 主题
- 首页布局
- 社交入口
- 开关项

## 13. 其他页面模块，应该怎么理解？

这些页面大多数都遵循一个很统一的模式：

```text
读取 list.json -> 在前端进入编辑模式 -> 本地修改 state -> 保存时 push 到 GitHub
```

### 13.1 `about/`

- 页面：`src/app/about/page.tsx`
- 数据：`src/app/about/list.json`
- 保存：`src/app/about/services/push-about.ts`

这是一个可编辑的 Markdown 介绍页。

### 13.2 `share/`

- 页面：`src/app/share/page.tsx`
- 网格：`src/app/share/grid-view.tsx`
- 数据：`src/app/share/list.json`
- 保存：`src/app/share/services/push-shares.ts`

展示“推荐资源”，支持 logo 上传。

### 13.3 `bloggers/`

- 页面：`src/app/bloggers/page.tsx`
- 网格：`src/app/bloggers/grid-view.tsx`
- 数据：`src/app/bloggers/list.json`
- 保存：`src/app/bloggers/services/push-bloggers.ts`

展示推荐博主，支持头像上传。

### 13.4 `projects/`

- 页面：`src/app/projects/page.tsx`
- 数据：`src/app/projects/list.json`
- 保存：`src/app/projects/services/push-projects.ts`

展示项目卡片，支持封面图。

### 13.5 `pictures/`

- 页面：`src/app/pictures/page.tsx`
- 数据：`src/app/pictures/list.json`
- 保存：`src/app/pictures/services/push-pictures.ts`

这个页面稍微特别，因为它还处理：

- 分组图片
- 拖拽布局
- 本地偏移量缓存
- 删除旧图片文件

它更像一个“轻量图床/画廊管理页”。

### 13.6 `snippets/`

随机展示一句短句，可编辑管理列表。

### 13.7 `clock/`

完整秒表/计时器页面。

首页时钟卡片点击后会跳到这里。

### 13.8 `live2d/`

通过外部 CDN 加载 `PIXI + Live2D`，展示 Live2D 模型。

### 13.9 `image-toolbox/`

浏览器端图片压缩/转 WebP 工具。

这个页面完全偏工具页，不依赖 GitHub 写入。

### 13.10 `svgs/`

SVG 图标画廊，支持搜索和复制 import 语句。

### 13.11 `wuthering-waves/`

一个偏个人/实验性质的小工具页，用来分析抽卡记录。

## 14. 通用组件层怎么读？

如果你想提升自己的 React 工程理解，`src/components/` 很值得看。

### 14.1 值得优先看的组件

- `card.tsx`
- `nav-card.tsx`
- `blog-preview.tsx`
- `dialog-modal.tsx`
- `like-button.tsx`
- `music-card.tsx`

### 14.2 `nav-card.tsx`

这是全局导航卡片。

它会根据当前路由切换成三种形态：

- 首页：完整导航
- 写作页：缩小导航
- 其他页：图标导航

这也是项目“悬浮卡片式导航”的关键。

### 14.3 `dialog-modal.tsx`

项目里很多弹窗都复用它。

它负责：

- portal 到 `document.body`
- Esc 关闭
- 点击遮罩关闭
- 锁定 body 滚动
- `motion` 入场退场动画

### 14.4 `like-button.tsx`

点赞数据不是存 GitHub，而是请求外部接口：

```text
https://blog-liker.yysuni1001.workers.dev/api/like
```

所以点赞系统和内容系统是分开的。

### 14.5 `music-card.tsx`

这是一个浏览器端 Audio 播放器卡片。

在首页显示；
在非首页时，只有“正在播放”才继续悬浮显示。

## 15. 样式层怎么读？

最关键的样式文件：

- `src/styles/globals.css`
- `src/styles/theme.css`
- `src/styles/article.css`

### 15.1 `theme.css`

这里定义了主题变量：

- `--color-brand`
- `--color-primary`
- `--color-bg`
- `--color-card`
- `--color-article`

所以组件里看到的 `bg-brand`、`text-primary` 等，本质上都和这些 CSS 变量有关。

### 15.2 `globals.css`

这里不仅有全局样式，还有很多自定义 utility：

- `card`
- `card-rounded`
- `text-linear`
- `bg-linear`
- `brand-btn`

这说明项目没有完全依赖 Tailwind 默认类，而是结合了“项目自己的视觉原语”。

## 16. 项目的几个关键设计思想

这里我专门用“初学者视角”总结一下。

### 16.1 设计思想一：配置驱动 UI

首页很多内容不是写死在组件里，而是由：

- `site-content.json`
- `card-styles.json`

控制。

这叫“配置驱动”。

### 16.2 设计思想二：文件就是内容数据库

博客正文、页面列表、站点设置，都存在仓库文件里。

所以这个项目的核心不是数据库表，而是：

- JSON
- Markdown
- 图片文件

### 16.3 设计思想三：前端直接写 GitHub

很多网站是：

- 前端发请求给自己的后端

这个项目是：

- 前端拿 GitHub App 权限
- 直接操作 GitHub 仓库

这是它最大的架构特点。

### 16.4 设计思想四：复用展示层

博客正式页和预览页，复用同一套渲染组件。

这是非常好的工程习惯。

## 17. 给初学者的阅读顺序

如果你现在要真正把这个项目吃透，我建议按下面顺序读。

### 第一轮：先看“页面怎么跑起来”

1. `package.json`
2. `src/app/layout.tsx`
3. `src/layout/index.tsx`
4. `src/app/(home)/page.tsx`

这一轮目标：

- 知道项目入口在哪里
- 知道首页是卡片拼出来的

### 第二轮：看首页怎么组成

1. `src/hooks/use-center.ts`
2. `src/hooks/use-size.ts`
3. `src/components/card.tsx`
4. `src/app/(home)/hi-card.tsx`
5. `src/app/(home)/art-card.tsx`
6. `src/components/nav-card.tsx`

这一轮目标：

- 知道卡片为什么摆在那个位置
- 知道响应式和动画怎么做

### 第三轮：看博客系统

1. `src/app/blog/page.tsx`
2. `src/app/blog/[id]/page.tsx`
3. `src/lib/load-blog.ts`
4. `src/lib/markdown-renderer.ts`
5. `src/hooks/use-markdown-render.tsx`
6. `src/components/blog-preview.tsx`

这一轮目标：

- 知道博客怎么读
- 知道 Markdown 怎么渲染

### 第四轮：看写作系统

1. `src/app/write/stores/write-store.ts`
2. `src/app/write/components/editor.tsx`
3. `src/app/write/components/actions.tsx`
4. `src/app/write/services/push-blog.ts`
5. `src/app/write/services/delete-blog.ts`

这一轮目标：

- 知道文章怎么写
- 知道图片怎么上传
- 知道发布本质上在改哪些仓库文件

### 第五轮：看 GitHub 授权

1. `src/hooks/use-auth.ts`
2. `src/lib/auth.ts`
3. `src/lib/github-client.ts`

这一轮目标：

- 彻底看懂“为什么前端能写 GitHub”

## 18. 你现在最应该知道的 5 个结论

### 结论 1

这个项目不是“普通博客模板”，而是“前端可编辑博客系统”。

### 结论 2

它的核心后端不是数据库，而是 GitHub 仓库本身。

### 结论 3

首页是一个可配置、可拖拽、可调尺寸的卡片布局系统。

### 结论 4

博客正文通过 `Markdown + Shiki + KaTeX + React 组件替换` 渲染。

### 结论 5

理解这个项目，最关键的是看懂两条线：

- 页面展示线
- GitHub 写入线

## 19. 如果你接下来要继续学，我建议你先动手改这 3 个地方

### 练习 1：改站点标题

改：

```text
src/config/site-content.json
```

看它如何影响：

- 页面标题
- 导航卡片标题
- metadata

### 练习 2：改首页中心卡片文案

改：

```text
src/app/(home)/hi-card.tsx
```

看你能不能自己判断：

- 哪部分是数据
- 哪部分是样式
- 哪部分是布局

### 练习 3：新建一篇博客

看：

- `/write`
- `src/app/write/services/push-blog.ts`
- `public/blogs/`

目标是把“页面表单 -> GitHub commit -> 静态文件”这条线彻底打通。

## 20. 最后一句总结

如果用最短的话总结这个项目：

```text
这是一个用 Next.js 做界面、用 GitHub 仓库存内容、用 GitHub App 获得写权限的可视化博客系统。
```

当你真正理解了这句话，基本就理解了这个项目的大框架。

## 21. 这个项目的动画为什么看起来舒服？

你提到“这个页面的动画做得很好，怎么做的”，这个问题非常关键。

这个项目的动画好看，不是因为单个动画特别花，而是因为它做对了 4 件事：

- 入场动画统一
- 悬浮/点击反馈统一
- 局部高亮切换流畅
- 背景动画和内容动画分层

换句话说，它不是“哪里都乱动”，而是每一层只做刚刚好的动画。

### 21.1 先记住这个项目常见的几种动画类型

#### 第一种：入场动画

最常见写法是：

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.6 }}
  animate={{ opacity: 1, scale: 1 }}
/>
```

作用是：

- 初始透明、缩小
- 进入时淡入并放大到正常尺寸

你在这些文件里都能看到：

- `src/components/card.tsx`
- `src/app/blog/page.tsx`
- `src/app/write/components/actions.tsx`
- `src/components/blog-sidebar.tsx`
- `src/components/dialog-modal.tsx`

#### 第二种：按钮交互动画

最常见写法是：

```tsx
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

这表示：

- 鼠标移上去，轻微放大
- 按下去，轻微缩小

这类动画的好处是非常实用：

- 不会太夸张
- 但用户会明确感到“按钮是活的”

这个项目几乎所有主要按钮都沿用了这一套。

#### 第三种：弹窗出现/消失动画

它通常和 `AnimatePresence` 一起使用。

例如 `src/components/dialog-modal.tsx`：

```tsx
<AnimatePresence>
  {open && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
      />
    </motion.div>
  )}
</AnimatePresence>
```

这一套的效果是：

- 遮罩层先淡入
- 内容框再从下面轻微浮上来
- 关闭时反过来

所以弹窗会显得很轻，而不是突然硬切出来。

#### 第四种：共享高亮动画

最典型的是 `src/components/nav-card.tsx` 里的：

```tsx
<motion.div layoutId='nav-hover' />
```

这个 `layoutId` 的作用可以简单理解为：

- 告诉 motion：“这其实是同一个高亮块”
- 当它从 A 项移动到 B 项时，不要瞬间消失重建
- 而是平滑地“滑过去”

这就是为什么导航高亮看起来像在“流动”，而不是“闪现”。

### 21.2 这个项目的动画节奏是怎么统一的？

关键常量在：

```text
src/consts.ts
```

里面有：

- `INIT_DELAY`
- `ANIMATION_DELAY`

这两个常量控制了很多组件的出现顺序。

例如首页卡片：

- 每张卡片都有 `order`
- `Card` 组件会根据 `order * ANIMATION_DELAY` 决定延迟出现

所以首页不是“一次性全弹出来”，而是有一点点错落顺序。

这正是页面显得高级的原因之一。

### 21.3 首页卡片动画为什么特别顺？

核心组件是：

```text
src/components/card.tsx
```

它的逻辑可以概括成：

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.6, left: x, top: y, width, height }}
  animate={{ opacity: 1, scale: 1, left: x, top: y, width, height }}
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
/>
```

这里有两个值得你记的点。

#### 点 1：位置和尺寸也在 `animate` 里

这意味着卡片不仅会淡入，还会跟随：

- `x`
- `y`
- `width`
- `height`

变化。

所以当你改首页布局、拖拽卡片、修改宽高时，卡片不会生硬跳一下，而是动画过渡到新位置。

#### 点 2：动画和布局系统耦合得很自然

首页卡片不是先写死，再额外加动画。

而是：

- 布局数据本来就存在配置里
- `Card` 直接把布局数据喂给 `motion`

所以布局变化天然就是动画变化。

### 21.4 背景动画是怎么做的？

这个项目的背景不是单一方案，而是两层。

#### 第一层：模糊气泡背景

文件：

```text
src/layout/backgrounds/blurred-bubbles.tsx
```

这个动画并不是纯 `motion` 做的。

它其实是：

- `motion.div` 只负责整体淡入
- 真正的泡泡移动由 `canvas + 噪声算法 + requestAnimationFrame` 完成

也就是说：

```text
motion 负责 UI 层过渡
canvas 负责高性能背景动画
```

这是很合理的做法，因为像这种大量模糊圆形漂浮的背景，用 canvas 会更灵活。

#### 第二层：圣诞飘雪

文件：

```text
src/layout/backgrounds/snowfall.tsx
```

这个就比较典型地用 `motion` 做。

每一片雪花都是一个 `motion.div`，关键写法大概是：

```tsx
animate={{
  y: window.innerHeight + 200,
  x: `-${(Math.random() * window.innerWidth) / 5}px`,
  rotate: ...
}}
transition={{
  duration: ...,
  delay: ...,
  repeat: Infinity,
  ease: 'linear'
}}
```

你可以把它理解成：

- 从屏幕上方开始
- 线性匀速向下落
- 带一点横向漂移
- 无限循环

### 21.5 点赞按钮为什么看起来特别“活”？

文件：

```text
src/components/like-button.tsx
```

这个组件好看的原因是它不只做一种动画，而是做了 3 层：

#### 第一层：按钮本身入场和 hover/tap

也就是常规的：

- `initial`
- `animate`
- `whileHover`
- `whileTap`

#### 第二层：数字徽标弹一下

点赞数出现时：

```tsx
<motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} />
```

这让数字变化不会显得死板。

#### 第三层：爱心粒子散开

它用 `AnimatePresence` 把多个小爱心粒子向外炸开：

```tsx
animate={{
  opacity: [1, 1, 0],
  scale: [0, 1.2, 0.8],
  x: particle.x,
  y: particle.y
}}
```

所以用户点击时，会得到很明显的正反馈。

### 21.6 导航动画为什么高级？

导航动画的关键不只是 `motion`，而是它“动得对”。

文件：

```text
src/components/nav-card.tsx
```

它主要做了两件好事。

#### 第一件：高亮块使用 `layoutId`

这会让高亮背景在多个导航项之间“滑动”。

#### 第二件：使用 spring 动画

你会看到：

```tsx
transition={{
  type: 'spring',
  stiffness: 400,
  damping: 30
}}
```

这会让移动既快又不僵硬。

如果你之后自己写导航动画，这套思路是非常值得抄的。

### 21.7 如果你想自己改动画，最先改哪里？

我建议你按这个顺序改。

#### 低风险，最适合先改

- `src/consts.ts` 里的 `INIT_DELAY`、`ANIMATION_DELAY`
- 各组件里的 `whileHover` / `whileTap`
- 各组件里的 `initial / animate / transition`

#### 中风险，需要理解后再改

- `src/components/card.tsx`
- `src/components/nav-card.tsx`
- `src/components/dialog-modal.tsx`

#### 高风险，先别乱动

- `src/layout/backgrounds/blurred-bubbles.tsx`
- `src/app/(home)/home-draggable-layer.tsx`

因为这两个已经不是单纯“加动画”，而是跟背景算法、拖拽交互绑在一起了。

### 21.8 如果你以后自己写动画，建议你照着这个项目学这几个原则

#### 原则 1：先做静态布局，再加动画

不要一上来就写很多 `motion`，先把页面搭稳。

#### 原则 2：全站统一手感

这个项目按钮几乎都统一：

- hover 放大一点
- tap 缩小一点

这比每个按钮都自己发明一套效果要高级得多。

#### 原则 3：入场动画别太重

这个项目大多数只是：

- 淡入
- 轻微缩放

这正是它看起来舒服的原因。

#### 原则 4：背景动画和内容动画分开

大背景用 canvas 或独立层；
内容卡片用 `motion`。

这样性能和视觉都会更稳定。

## 22. 如果你想把整站内容都换成你自己的，怎么操作？

这一节非常实用，我按“最省事”的顺序写。

你有两种改法：

- 方式 A：尽量用页面自带的编辑功能
- 方式 B：直接改仓库文件然后自己提交

如果你已经配置好了 GitHub App，我建议优先用方式 A；
如果你暂时不想配 GitHub App，也可以直接改文件后 `git push`。

### 22.1 第一步：先换网站身份信息

先改：

```text
src/config/site-content.json
```

重点字段：

- `meta.title`
- `meta.description`
- `meta.username`
- `socialButtons`
- `theme`
- `artImages`
- `currentArtImageId`
- `backgroundImages`
- `currentBackgroundImageId`

这一步会直接影响：

- 浏览器标题
- SEO 描述
- 首页中心卡片
- 首页社交按钮
- 首页首图/背景图
- 全站主题色

### 22.2 第二步：换头像、favicon、首页图

你可以改这些资源：

```text
public/images/avatar.png
public/favicon.png
public/images/art/*
public/images/background/*    （如果你自己新增这个目录）
```

如果你是通过页面上的配置面板上传，最终本质上也是改这些资源和配置 JSON。

### 22.3 第三步：清掉原作者的博客，换成你的博客

这是最重要的一步。

#### 最方便的方法：用页面操作

进入：

```text
/blog
```

然后：

1. 点右上角“编辑”
2. 全选文章
3. 删除
4. 保存

这样项目会自动：

- 删除对应博客目录
- 更新 `public/blogs/index.json`
- 更新 `public/blogs/categories.json`

#### 手动改文件的方法

你也可以直接改：

```text
public/blogs/
```

但手动改时要同时维护这几项：

- 删除不需要的博客目录 `public/blogs/<slug>/`
- 重写 `public/blogs/index.json`
- 重写 `public/blogs/categories.json`

如果你手动删了目录，却没改索引，博客列表页就会乱。

### 22.4 第四步：开始写你自己的博客

进入：

```text
/write
```

然后创建你自己的文章。

发布后，会自动生成：

```text
public/blogs/<slug>/index.md
public/blogs/<slug>/config.json
public/blogs/index.json
```

如果你正文里插入本地图片，还会自动把图片上传到：

```text
public/blogs/<slug>/
```

### 22.5 第五步：改 About 页面

改：

```text
src/app/about/list.json
```

或者直接打开：

```text
/about
```

点击编辑。

这里适合换成：

- 你是谁
- 你做什么
- 你的博客定位
- 联系方式

### 22.6 第六步：改项目、分享、博主、图片等附加内容

如果你不想保留原作者的这些内容，就分别改这些文件：

```text
src/app/projects/list.json
src/app/share/list.json
src/app/bloggers/list.json
src/app/pictures/list.json
src/app/snippets/list.json
```

你可以：

- 直接进入页面用编辑模式改
- 或直接编辑 JSON

### 22.7 第七步：如果你不需要某些功能，可以先隐藏

最省事的方法不是立刻删代码，而是先隐藏。

你可以在：

```text
src/config/card-styles.json
```

里把这些卡片的 `enabled` 改成 `false`：

- `shareCard`
- `hatCard`
- `beianCard`
- `musicCard`
- `articleCard`
- `socialButtons`

这样你先把页面变成适合自己的样子，再决定要不要删代码。

### 22.8 如果你想把“整站换成我的”做得更干净，我建议按这个顺序执行

#### 清单顺序

1. 先 fork/复制这个仓库到你自己的 GitHub。
2. 先改 `src/config/site-content.json`，换标题、用户名、主题色、社交链接。
3. 再换 `public/images/avatar.png` 和 `public/favicon.png`。
4. 清空原博客内容。
5. 用 `/write` 发布你自己的第一篇文章。
6. 再改 `about/projects/share/bloggers/pictures` 这些附加内容。
7. 最后决定哪些卡片保留，哪些卡片隐藏。

这个顺序的好处是：

- 前 3 步改完，站点“身份”就已经换成你了
- 后面只是逐步替换内容，不会乱

### 22.9 如果你想使用前端编辑功能，还要做一件事

你需要配置 GitHub App 对接你自己的仓库。

重点配置在：

```text
src/consts.ts
```

和环境变量：

- `NEXT_PUBLIC_GITHUB_OWNER`
- `NEXT_PUBLIC_GITHUB_REPO`
- `NEXT_PUBLIC_GITHUB_BRANCH`
- `NEXT_PUBLIC_GITHUB_APP_ID`
- `NEXT_PUBLIC_GITHUB_ENCRYPT_KEY`

如果这些不对，前端虽然能打开编辑界面，但保存不到你自己的仓库。

### 22.10 如果你不想配 GitHub App，也能换成你自己的内容吗？

可以。

你可以完全不使用页面编辑功能，直接：

1. 改仓库文件
2. 本地提交
3. 推送到 GitHub

也就是说，GitHub App 是“站内可视化编辑”的能力，不是站点展示本身的硬依赖。

## 23. 哪些地方最好不要乱改？

这里我按风险等级说。

### 23.1 高风险：如果你还想保留“前端直接发布内容”的能力，这些尽量别乱动

#### 1. GitHub 授权与提交链路

这些文件尽量不要随便改：

```text
src/lib/auth.ts
src/lib/github-client.ts
src/hooks/use-auth.ts
```

因为它们是整套“前端拿权限、前端签发 JWT、前端提交 commit”的核心。

#### 2. 博客目录结构

这些约定不要随便变：

```text
public/blogs/<slug>/index.md
public/blogs/<slug>/config.json
public/blogs/index.json
public/blogs/categories.json
```

因为：

- `/blog` 页面要读 `index.json`
- 详情页要读 `index.md` 和 `config.json`
- 写作发布逻辑也默认往这里写

#### 3. 上传文件的路径约定

这些前缀最好不要乱改：

- `/blogs/<slug>/`
- `/images/share/`
- `/images/blogger/`
- `/images/pictures/`

因为各个 `push-*.ts` 服务都写死依赖这些目录规则。

#### 4. 配置 JSON 的字段名

值你可以改，但 key 尽量不要乱删乱改。

例如：

```text
src/config/site-content.json
src/config/card-styles.json
```

因为很多组件都直接读这些字段。

如果你把字段名改了，页面就会出现：

- 读不到数据
- 样式失效
- 某些卡片不显示

#### 5. 路由路径和导航对应关系

例如：

- `/blog`
- `/projects`
- `/about`
- `/share`
- `/bloggers`
- `/write`

这些路径如果改了，你还要同步改：

- `src/components/nav-card.tsx`
- 各卡片上的 `Link`
- 可能还有 sitemap / rss / 其他入口

所以初学阶段最好先别改路由名。

### 23.2 中风险：可以改，但最好理解后再改

这些文件你不是不能碰，而是建议先读懂再动：

```text
src/components/card.tsx
src/components/nav-card.tsx
src/app/(home)/home-draggable-layer.tsx
src/layout/backgrounds/blurred-bubbles.tsx
src/app/write/services/push-blog.ts
src/app/blog/services/save-blog-edits.ts
```

因为它们牵涉到：

- 布局系统
- 动画系统
- 拖拽系统
- GitHub 提交流程
- 文件生成规则

### 23.3 低风险：你知道自己在改什么时再碰

这些配置层如果改错了，一般不至于把架构搞坏，但可能会让开发体验受影响：

```text
next.config.ts
tsconfig.json
postcss.config.mjs
```

如果你现在主要目标是“换成自己的站点”，这几处通常没必要动。

## 24. 哪些地方你可以放心大胆改？

下面这些基本都属于“高自由度区域”。

### 24.1 文案类内容

你可以随便改：

- 网站标题
- 首页文案
- About 页面
- 博客正文
- 项目/分享/博主描述
- snippets 短句

### 24.2 视觉类内容

你可以随便改：

- 主题色
- 背景色
- 背景图
- 头像
- favicon
- 首页艺术图
- 帽子图

### 24.3 首页卡片布局

这些都可以大胆调：

- 卡片宽高
- 卡片顺序
- 卡片偏移
- 卡片开关

对应文件：

```text
src/config/card-styles.json
```

### 24.4 各列表数据

这些你基本可以当内容表来改：

```text
src/app/projects/list.json
src/app/share/list.json
src/app/bloggers/list.json
src/app/pictures/list.json
src/app/about/list.json
src/app/snippets/list.json
```

### 24.5 首页具体卡片内容

这些文件的 JSX 文案和布局你也可以改：

```text
src/app/(home)/hi-card.tsx
src/app/(home)/art-card.tsx
src/app/(home)/aritcle-card.tsx
src/app/(home)/share-card.tsx
src/app/(home)/social-buttons.tsx
src/app/(home)/clock-card.tsx
src/app/(home)/calendar-card.tsx
```

只要你不把依赖的关键字段删掉，改文案、改结构、改样式通常都没问题。

### 24.6 页面动画参数

你也可以改：

- `whileHover`
- `whileTap`
- `transition`
- `initial`
- `animate`

我建议你这样改：

- 先改数值，不改结构
- 先改缩放和时长，不改复杂逻辑

例如先尝试：

- `scale: 1.05` 改成 `1.02`
- `duration: 1` 改成 `0.6`
- `INIT_DELAY` 改小一点

这样风险最低。

## 25. 如果我是你，我会怎么改这个网站？

如果你的目标是“把它彻底变成我的站点，同时尽量不踩坑”，我会这样做。

### 第一阶段：只换身份，不动架构

改这些：

- `src/config/site-content.json`
- `public/images/avatar.png`
- `public/favicon.png`
- `src/app/about/list.json`

这一步做完，你的网站已经像“你的站”了。

### 第二阶段：清空原内容，写你自己的内容

改这些：

- 删除原博客
- 写自己的博客
- 改 `projects/share/bloggers/pictures`

这一步做完，内容层就属于你了。

### 第三阶段：按你的风格做视觉修改

改这些：

- 主题色
- 首页布局
- 卡片开关
- 动画速度

### 第四阶段：最后再决定要不要删功能

比如你不需要：

- Live2D
- 音乐卡片
- 帽子
- 分享页
- 博主页

我建议你先隐藏，再删代码。

因为“隐藏”可逆，“直接删”容易把依赖链一起搞乱。

## 26. 最后给你的实操建议

如果你之后真要长期维护这个站，我建议你记住这 3 条。

### 建议 1：先改内容，后改结构

先把：

- 标题
- 头像
- 博客
- About

换成自己的。

等内容稳定了，再折腾布局和架构。

### 建议 2：先隐藏，别急着删除

很多你现在觉得“没用”的模块，可能以后还会用到。

所以先通过：

- `enabled: false`
- 不显示入口

来隐藏，通常更稳。

### 建议 3：保留这套 GitHub 写入链路

这个项目最值钱的地方，其实就是：

```text
前端直接改内容 -> GitHub 自动存档 -> 网站重新部署
```

如果你把这条链路保住，你后面维护博客会轻松很多。

## 27. 把这个站换成你自己的站：最短执行清单

这一节我故意写得很短，目标是让你可以直接照着做，不需要再自己重新整理步骤。

### 27.1 最短路径版本

#### 第 1 步：先复制到你自己的仓库

你需要先有你自己的 GitHub 仓库。

做法：

1. fork 这个仓库，或者新建一个仓库后把代码推过去。
2. 确保后续部署指向的是你自己的仓库，不是原作者仓库。

#### 第 2 步：先换站点身份

优先改这个文件：

```text
src/config/site-content.json
```

至少先改：

- `meta.title`
- `meta.description`
- `meta.username`
- `socialButtons`

改完后，你的网站标题、首页名字、社交链接基本就已经不是原站了。

#### 第 3 步：换头像和 favicon

替换这两个文件：

```text
public/images/avatar.png
public/favicon.png
```

这是“最值回票价”的一步，因为视觉身份会立刻变成你的。

#### 第 4 步：删掉原博客

最省事的方法：

1. 打开 `/blog`
2. 点“编辑”
3. 全选
4. 删除
5. 保存

如果你还没配 GitHub App，就手动删：

```text
public/blogs/<原有slug>/
public/blogs/index.json
public/blogs/categories.json
```

#### 第 5 步：发布你的第一篇博客

打开：

```text
/write
```

填写：

- 标题
- slug
- 正文
- 标签
- 摘要

然后发布。

这是最关键的一步，因为一旦你有了自己的第一篇文章，这个站就真正开始属于你了。

#### 第 6 步：改 About 页面

改：

```text
src/app/about/list.json
```

或者进入 `/about` 用编辑模式改。

建议你先写：

- 你是谁
- 你写什么
- 为什么做这个站
- 怎么联系你

#### 第 7 步：决定保留哪些模块

如果你暂时不想要这些内容：

- 分享
- 博主
- 图片墙
- 帽子
- 音乐
- 备案

先不要删代码，先在：

```text
src/config/card-styles.json
```

里把对应卡片设成：

```json
"enabled": false
```

### 27.2 如果你今天只想做最核心的 4 件事

那就只做这些：

1. 改 `src/config/site-content.json`
2. 换 `public/images/avatar.png`
3. 清空原博客
4. 发布你自己的第一篇博客

只做完这四步，这个站就已经基本完成“换成你的站”的核心动作了。

### 27.3 我建议你不要一开始就做的事

先别急着做这些：

- 改路由路径
- 改 GitHub 提交逻辑
- 改博客目录结构
- 重写首页布局系统
- 删除大量模块代码

因为这些都不影响“变成你的站”，但很容易把你自己绕进去。

### 27.4 真正推荐的执行顺序

最稳的顺序是：

1. 先换身份
2. 再换内容
3. 再隐藏不需要的功能
4. 最后才改视觉和动画

你按这个顺序做，几乎不会乱。

## 28. 从真实代码看 Motion：先精讲 `card.tsx`，再精讲 `nav-card.tsx`

这一节我不只讲“概念”，而是直接对照代码讲。

### 28.1 先看 `card.tsx`：为什么首页卡片动画这么顺？

文件：

```text
src/components/card.tsx
```

这个组件非常值得你认真看，因为首页大部分卡片都要经过它。

### 28.2 第一步：它先控制“什么时候出现”

关键代码：

```tsx
let [show, setShow] = useState(false)

useEffect(() => {
  if (show) return
  if (x === 0 && y === 0) return
  setTimeout(() => {
    setShow(true)
  }, order * ANIMATION_DELAY * 1000)
}, [x, y, show])
```

这段的意思是：

- 卡片刚开始先不渲染
- 当位置已经算出来后，再延迟一小段时间显示
- 延迟时间由 `order` 决定

所以首页卡片会按顺序慢慢出现。

这一步其实还没用到复杂动画，但它决定了动画节奏。

### 28.3 第二步：真正的入场动画在这里

关键代码：

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.6, left: x, top: y, width, height }}
  animate={{ opacity: 1, scale: 1, left: x, top: y, width, height }}
/>
```

这里要分开理解。

#### `initial`

表示动画开始前的状态：

- `opacity: 0`：透明
- `scale: 0.6`：缩小
- `left/top/width/height`：位置和尺寸先放到最终值

#### `animate`

表示动画完成后的状态：

- `opacity: 1`
- `scale: 1`
- 位置和尺寸仍然是当前传入值

你可能会疑惑：

既然 `left/top/width/height` 前后一样，为什么还写进去？

答案是：

- 因为这个组件后面会复用
- 当 `x/y/width/height` 变化时，`motion` 会把这些变化也做成补间动画

所以它不只是“入场动画组件”，还是“布局变化动画组件”。

### 28.4 第三步：用户交互反馈在这里

关键代码：

```tsx
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

这是最常见、也最好用的一套按钮/卡片反馈。

它的好处是：

- hover 时会有轻微放大，告诉用户“可以交互”
- tap 时会轻微缩小，告诉用户“我按到了”

而且数值非常克制，没有夸张到破坏布局。

### 28.5 `card.tsx` 为什么写得好？

因为它把 3 件事合在了一个基础组件里：

- 延迟出现
- 入场动画
- hover / tap 反馈

结果就是：

- 首页卡片统一风格
- 其他地方复用也统一风格

这就是“把动画做成基础设施”，而不是每个页面自己乱写。

### 28.6 如果你要改 `card.tsx`，最安全的改法是什么？

你可以先只改这些数值：

- `scale: 0.6` 改成 `0.8`
- `whileHover: 1.05` 改成 `1.02`
- `whileTap: 0.95` 改成 `0.98`

效果会立刻变化，但不会破坏结构。

不建议你一开始就改：

- `show` 的控制逻辑
- `order` 的延迟策略
- `x/y/width/height` 的动画绑定

### 28.7 再看 `nav-card.tsx`：为什么导航高亮像在滑动？

文件：

```text
src/components/nav-card.tsx
```

这个组件最值得学的部分，是这一段：

```tsx
<motion.div
  layoutId='nav-hover'
  initial={false}
  animate={...}
  transition={{
    type: 'spring',
    stiffness: 400,
    damping: 30
  }}
/>
```

### 28.8 `layoutId='nav-hover'` 到底是什么意思？

你可以把它理解成：

```text
这个高亮背景虽然看起来在不同菜单项下面，
但 motion 认为它始终是“同一个元素”
```

这样当你 hover 不同导航项时：

- 它不会销毁旧高亮，再创建新高亮
- 而是把同一个高亮块从旧位置平滑移动到新位置

这就是“共享布局动画”的核心。

### 28.9 `initial={false}` 是干嘛的？

它的作用是：

- 首次渲染时不要做额外初始动画
- 直接用当前状态

这样导航高亮不会在页面刚加载时乱跳一下。

这个细节很重要。

### 28.10 `animate={...}` 里做了什么？

它会根据导航显示模式不同，计算不同的位置和大小。

#### 在图标模式下

```tsx
{
  left: hoveredIndex * (itemHeight + 24) - extraSize,
  top: -extraSize,
  width: itemHeight + extraSize * 2,
  height: itemHeight + extraSize * 2
}
```

意思是：

- 高亮块跟着当前 hover 的图标横向移动
- 宽高围绕图标扩一圈

#### 在完整模式下

```tsx
{
  top: hoveredIndex * (itemHeight + 8),
  left: 0,
  width: '100%',
  height: itemHeight
}
```

意思是：

- 高亮块在纵向菜单中上下滑动
- 宽度铺满整项

所以同一段 motion 代码，同时适配了两种导航布局。

### 28.11 `spring` 参数为什么重要？

关键代码：

```tsx
transition={{
  type: 'spring',
  stiffness: 400,
  damping: 30
}}
```

可以这样记：

- `stiffness` 越大，越“想快速到位”
- `damping` 越大，越“抑制弹跳”

这组参数在这里的效果是：

- 反应快
- 但不会弹得很夸张

所以导航高亮会显得有弹性，但仍然干净。

### 28.12 `nav-card.tsx` 还有一个很妙的点

关键代码：

```tsx
onMouseEnter={() => setHoveredIndex(index)}
```

也就是说：

- hover 到哪一项
- 就更新 `hoveredIndex`
- `motion.div` 根据新的 `hoveredIndex` 重新算位置

这里的思路其实非常简单。

真正厉害的地方不在“状态多复杂”，而在：

- 只维护一个 `hoveredIndex`
- 让动画层自己根据索引计算位置

这是很值得模仿的写法。

### 28.13 如果你要自己仿写一个类似导航动画，最小模板是什么？

你可以把它抽象成：

```tsx
const [active, setActive] = useState(0)

<div className='relative'>
  <motion.div
    layoutId='highlight'
    animate={{ top: active * 48 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    className='absolute left-0 w-full h-12 rounded-xl'
  />

  {list.map((item, index) => (
    <button key={item.id} onMouseEnter={() => setActive(index)}>
      {item.label}
    </button>
  ))}
</div>
```

这就是这个思路的最小化版本。

### 28.14 你现在学 Motion，最应该先吃透什么？

结合这个项目，我建议你先完全搞懂这 6 个属性：

- `initial`
- `animate`
- `exit`
- `whileHover`
- `whileTap`
- `transition`

然后再学：

- `AnimatePresence`
- `layoutId`

如果这 8 个概念你能熟练掌握，这个项目里大部分 `motion` 代码你都能看懂。

### 28.15 下一步最适合你怎么练？

我建议你直接做这两个练习。

#### 练习 1：自己改 `card.tsx` 的动画手感

试试：

- 把入场缩放从 `0.6` 改成 `0.85`
- 把 hover 从 `1.05` 改成 `1.02`
- 看页面整体气质怎么变化

#### 练习 2：自己改 `nav-card.tsx` 的高亮块

试试：

- 改 `stiffness`
- 改 `damping`
- 改高亮块圆角和背景色

你会非常直观地理解：

- 什么叫弹簧动画
- 什么叫共享布局动画

## 29. 再精讲两个 Motion 例子：`dialog-modal.tsx` 和 `like-button.tsx`

前一节你已经看过：

- 基础入场动画
- hover / tap 动画
- 共享布局动画

这一节继续补两块特别重要的能力：

- `AnimatePresence` 怎么让“关闭动画”成立
- 粒子动画和局部反馈动画怎么叠加

---

### 29.1 先看 `dialog-modal.tsx`：为什么弹窗能优雅地出现和消失？

文件：

```text
src/components/dialog-modal.tsx
```

这个组件很适合学习 `AnimatePresence`，因为弹窗正是它最经典的使用场景。

### 29.2 先理解一个核心问题：为什么普通条件渲染做不出“退出动画”？

普通写法是：

```tsx
{open && <Dialog />}
```

问题在于：

- 当 `open` 从 `true` 变成 `false`
- React 会立刻把 `Dialog` 从树上移除

既然组件都没了，那它就没有机会执行“慢慢消失”的动画。

所以要做退出动画，必须多一个机制：

```text
组件虽然逻辑上要消失了，
但先别立刻卸载，
先让它播放完 exit 动画，再真正移除
```

`AnimatePresence` 做的就是这件事。

### 29.3 这段代码是整个弹窗动画的关键

```tsx
return createPortal(
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
        >
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>,
  document.body
)
```

要分成三层理解。

#### 第一层：`createPortal(...)`

这不是动画本身，但对弹窗非常重要。

它表示：

- 弹窗不挂在当前组件内部层级里
- 而是直接渲染到 `document.body`

好处是：

- 不容易被父元素的 `overflow: hidden` 裁掉
- z-index 更好控制
- 更符合弹窗这种“全局浮层”的语义

#### 第二层：外层 `motion.div`

这层负责“遮罩层”的动画：

```tsx
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
```

效果就是：

- 打开时背景慢慢出现
- 关闭时背景慢慢变透明

这是弹窗舒服的第一步。

#### 第三层：内层 `motion.div`

这层负责“弹窗内容盒子”的动画：

```tsx
initial={{ opacity: 0, scale: 0.8, y: 20 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.8, y: 20 }}
```

意思是：

- 初始时稍微小一点
- 稍微向下偏一点
- 打开时上浮并变大到正常尺寸
- 关闭时反向退场

所以你看到的不是“啪一下弹出来”，而是“淡入 + 浮上来”。

### 29.4 为什么这里要分成外层和内层两个 `motion.div`？

因为两层职责不同。

#### 外层

负责：

- 全屏遮罩
- 点击遮罩关闭
- 背景模糊
- 透明度变化

#### 内层

负责：

- 真正的内容盒子
- 缩放和位移动画
- 阻止点击冒泡

这是一种非常标准而且好维护的分层方式。

### 29.5 `onClick={e => e.stopPropagation()}` 为什么要写？

因为外层点击是关闭弹窗：

```tsx
onClick={disableCloseOnOverlay ? undefined : onClose}
```

如果内层不阻止冒泡，那么：

- 你点弹窗内容
- 点击事件会继续冒泡到遮罩层
- 弹窗就会被误关闭

所以这里不是动画知识，但它和弹窗体验是绑在一起的。

### 29.6 这个弹窗组件为什么写得好？

因为它不只是“会动”，而是把一整套弹窗基础能力封装好了：

- portal
- 锁滚动
- Esc 关闭
- 点击遮罩关闭
- 进入动画
- 退出动画

也就是说，其他地方只要复用它，就自动继承这套体验。

### 29.7 如果你想自己改弹窗手感，优先改哪里？

最安全的是改这些值：

```tsx
scale: 0.8
y: 20
```

例如：

- `scale: 0.8` 改成 `0.92`，弹窗会更克制
- `y: 20` 改成 `10`，上浮感会更轻

如果你想让弹窗更有“重量感”，还可以加 `transition`：

```tsx
transition={{ duration: 0.25, ease: 'easeOut' }}
```

---

### 29.8 再看 `like-button.tsx`：为什么点赞按钮这么有反馈感？

文件：

```text
src/components/like-button.tsx
```

这个组件特别适合你学“多层动画叠加”的思路。

它不是靠单一动画好看，而是把 4 个小反馈叠在一起：

- 按钮本体入场
- hover/tap 缩放
- 数字徽标出现
- 爱心粒子散开
- 中心爱心跳一下

### 29.9 第一层：按钮本体动画

关键代码：

```tsx
<motion.button
  initial={{ opacity: 0, scale: 0.6 }}
  animate={{ opacity: 1, scale: 1 }}
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
/>
```

这一层你已经熟悉了。

它负责：

- 让按钮出现得自然
- 让用户 hover 和 click 时有触感

### 29.10 第二层：粒子数据先生成，再交给动画层播放

关键代码：

```tsx
const newParticles = Array.from({ length: 6 }, (_, i) => ({
  id: Date.now() + i,
  x: Math.random() * 60 - 30,
  y: Math.random() * 60 - 30
}))
setParticles(newParticles)
setTimeout(() => setParticles([]), 1000)
```

这段逻辑非常值得学。

它先做的不是动画，而是：

- 生成 6 个粒子
- 每个粒子都有随机目标位置
- 1 秒后清掉粒子

也就是说，动画真正依赖的是“状态”：

```text
先有 particles 这份数据
React 根据这份数据渲染多个 motion.div
motion 再把它们动起来
```

这是 React 里非常标准的动画思路。

### 29.11 第三层：粒子真正怎么动？

关键代码：

```tsx
<AnimatePresence>
  {particles.map(particle => (
    <motion.div
      key={particle.id}
      initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
      animate={{
        opacity: [1, 1, 0],
        scale: [0, 1.2, 0.8],
        x: particle.x,
        y: particle.y
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  ))}
</AnimatePresence>
```

这一段要拆成 4 点看。

#### 点 1：`initial`

```tsx
{ opacity: 1, scale: 0, x: 0, y: 0 }
```

意思是粒子一开始：

- 在按钮中心
- 是透明度 1
- 但尺寸是 0，所以像从中心“冒出来”

#### 点 2：`animate`

```tsx
opacity: [1, 1, 0]
scale: [0, 1.2, 0.8]
x: particle.x
y: particle.y
```

这里用到了数组写法。

你可以理解成关键帧动画：

- `opacity: [1, 1, 0]`
  - 先保持可见
  - 最后淡出
- `scale: [0, 1.2, 0.8]`
  - 从 0 变大
  - 稍微回落一点
- `x/y`
  - 向随机方向飞出去

这就是“爆开”的感觉来源。

#### 点 3：为什么粒子不用很大？

因为这里的核心不是看清粒子细节，而是给用户一种“点赞成功了”的瞬时情绪反馈。

所以粒子很小，反而更精致。

#### 点 4：为什么还要 `AnimatePresence`？

因为粒子 1 秒后会被 `setParticles([])` 清掉。

如果没有 `AnimatePresence`，React 一删除这些节点，它们就直接没了。

有了 `AnimatePresence`，它们就能先跑完退出过程。

### 29.12 第四层：数字徽标也有自己的动画

关键代码：

```tsx
<motion.span
  initial={{ scale: 0.4 }}
  animate={{ scale: 1 }}
>
  {count}
</motion.span>
```

这表示：

- 计数徽标不是静态出现
- 而是稍微“弹一下”

这类小动画很轻，但非常提升精致感。

### 29.13 第五层：中心爱心为什么会“跳”一下？

关键代码：

```tsx
<motion.div
  animate={justLiked ? { scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] } : {}}
  transition={{ duration: 0.6, ease: 'easeOut' }}
>
```

这里也用了关键帧数组。

意思是：

- 点赞后，中心爱心先放大
- 再回到正常大小
- 同时左右轻微摆一下

这就让“点赞”这个动作不只是数字变化，而是有真正的身体感。

### 29.14 这个组件最值得你学的点，不是具体参数，而是分层思路

它的思路是：

```text
一个行为，不只给一种反馈，
而是同时给：
按钮反馈 + 主图标反馈 + 数字反馈 + 粒子反馈
```

这就是为什么你会觉得它“很活”。

### 29.15 如果你自己想仿写类似效果，最简单的步骤是什么？

我建议你按这个顺序自己练。

#### 第一步

先写一个普通 `motion.button`：

- `initial`
- `animate`
- `whileHover`
- `whileTap`

#### 第二步

再加一个 `justLiked` 布尔值，让中间图标跳一下。

#### 第三步

最后再加 `particles` 数组，让多个小图标飞出去。

不要一开始就把所有效果一起上，不然你会被状态和动画一起绕晕。

### 29.16 学完这两个例子后，你应该真正掌握什么？

学完 `dialog-modal.tsx` 和 `like-button.tsx`，你应该掌握的是：

- `AnimatePresence` 的真实用途
- 为什么退出动画需要“延迟卸载”
- 如何用状态数组驱动多个动画元素
- 如何用关键帧数组写更丰富的动效
- 如何把一个交互拆成多层反馈

如果你能把这 5 点吃透，这个项目里 80% 的 motion 用法你都已经能自己推出来了。

### 29.17 下一步最适合你的练习

你可以直接做两个练习。

#### 练习 1：自己改弹窗手感

在 `dialog-modal.tsx` 里尝试改：

- `scale: 0.8 -> 0.92`
- `y: 20 -> 8`

感受“轻弹窗”和“重弹窗”的差别。

#### 练习 2：自己改点赞粒子

在 `like-button.tsx` 里尝试改：

- 粒子数量 `6 -> 10`
- 粒子扩散范围 `60 -> 100`
- 中心爱心放大比例 `1.4 -> 1.2`

你会非常直观地理解：

- 粒子多一点为什么更热闹
- 但也为什么更容易显乱

## 30. 背景动效怎么做的：为什么一个用 Canvas，一个用 Motion？

前面几节你看到的动画，大多是“UI 元素动画”：

- 卡片
- 按钮
- 弹窗
- 导航高亮
- 点赞反馈

但背景动画是另一类问题。

背景动画通常有两个特点：

- 元素很多
- 持续时间很长，甚至一直循环

所以背景动效不一定总适合直接堆很多普通 DOM 节点。

这个项目正好用了两种路线：

- `blurred-bubbles.tsx`：`canvas + 少量 motion`
- `snowfall.tsx`：大量 `motion.div`

这很适合学习“什么时候该用哪种方案”。

---

### 30.1 先看 `blurred-bubbles.tsx`：为什么它不用一堆 `<motion.div>` 画泡泡？

文件：

```text
src/layout/backgrounds/blurred-bubbles.tsx
```

这个背景的目标是：

- 画几个巨大、模糊、缓慢漂浮的彩色气泡
- 要看起来柔和
- 不能一团乱
- 还要尽量省性能

如果你用很多普通 DOM 元素去做：

- 每个泡泡一个 `div`
- 再加 `blur`
- 再加持续动画

是能做，但会有几个问题：

- 浏览器渲染压力更大
- 超大模糊层在 DOM 里不一定省
- 想做复杂物理行为会很别扭

所以这里作者选了更合适的方案：

```text
真正的泡泡运动和绘制交给 canvas
最外层的淡入交给 motion
```

这是非常合理的分工。

### 30.2 这个组件的结构可以拆成 4 层

#### 第 1 层：React 只负责挂一个 canvas

关键结构：

```tsx
const ref = useRef<HTMLCanvasElement>(null)
```

和最后的：

```tsx
<canvas ref={ref} className='h-full w-full' />
```

也就是说，React 本身并不一个个管理泡泡节点。

React 只负责：

- 把 canvas 放进页面
- 在组件挂载时启动动画循环
- 在卸载时清理

#### 第 2 层：`motion.div` 只负责整体淡入

关键代码：

```tsx
<motion.div
  animate={{ opacity: 1 }}
  initial={{ opacity: 0 }}
  transition={{ duration: 1 }}
>
  <canvas ... />
</motion.div>
```

这说明作者没有完全放弃 `motion`。

而是把 `motion` 用在它最擅长的地方：

- 整个背景层的进入过渡

这样用户打开页面时：

- 背景不会突兀出现
- 但内部泡泡怎么动，不交给 `motion`

### 30.3 第 3 层：初始化画布和 DPR 适配

关键代码：

```tsx
const DPR = Math.min(2, window.devicePixelRatio || 1)
canvas.width = Math.floor(width * DPR)
canvas.height = Math.floor(height * DPR)
ctx.scale(DPR, DPR)
```

这个非常值得你记。

因为 canvas 有两个尺寸：

- CSS 显示尺寸
- 实际像素尺寸

如果你只设置 CSS 宽高，不按设备像素比处理，高清屏上就容易糊。

这里的做法是：

- 读取 `devicePixelRatio`
- 放大 canvas 内部像素
- 再把绘图上下文按比例缩放回来

这样画面会更清晰。

### 30.4 第 4 层：它不是“随机乱飘”，而是简化物理系统

这个组件高级的地方，不是“会动”，而是“动得像自然现象”。

它主要做了 4 种力的叠加。

#### 力 1：噪声流场

关键代码：

```tsx
const n = noise.current(b.x * noiseScale, b.y * noiseScale + t * noiseTimeScale)
const angle = n * Math.PI * 2
const fx = Math.cos(angle) * speed * b.jitter
const fy = Math.sin(angle) * speed * b.jitter
```

你可以把它理解成：

- 每个泡泡当前位置都会查一个“风向”
- 这个风向来自噪声函数
- 所以泡泡不是直线走，而是像被柔和风场带着走

这里的 `makeNoise2D()` 在：

```text
src/layout/backgrounds/utils.ts
```

它本质上是一个简化版 simplex noise 实现。

初学者可以这样理解：

```text
随机数是跳着变的
噪声函数是连续变化的随机
```

而背景动画想看起来自然，往往更需要“连续变化的随机”。

#### 力 2：分离力

关键代码：

```tsx
if (d2 < minD * minD && d2 > 0.001) {
  const d = Math.sqrt(d2)
  const push = (minD - d) / minD
  sx += (dx / d) * push * 0.8
  sy += (dy / d) * push * 0.8
}
```

作用是：

- 两个泡泡太近时，把它们轻轻推开

这避免了背景最后全部挤成一团。

#### 力 3：覆盖引导

关键代码：

```tsx
const { tx, ty } = lowestOccupancyTarget()
...
const cx = (dxT / dT) * 0.05
const cy = (dyT / dT) * 0.05
```

这一块是很妙的设计。

作者先做了一个“占用网格”：

- 哪些地方最近泡泡经过得多
- 哪些地方比较空

然后让泡泡轻微朝“更空的区域”漂过去。

效果就是：

- 背景分布更均匀
- 不容易某一侧全是泡泡，另一侧空掉

#### 力 4：区域约束

关键代码：

```tsx
const bandMin = height * bottomBandStart
const bandMax = height * 1.5
```

这表示泡泡主要活动在屏幕底部一带，而不是满屏乱飞。

这也是这个背景看起来舒服的关键：

- 它不是抢页面主体注意力
- 而是主要做底部氛围

### 30.5 为什么这个组件还要自己做帧率控制？

关键代码：

```tsx
const FRAME_INTERVAL = 1000 / effectiveFps
...
if (accumulatedTime < FRAME_INTERVAL) {
  animRef.current = requestAnimationFrame(frame)
  return
}
```

这里很重要。

虽然它用了 `requestAnimationFrame`，但并不是每一帧都真正重算和重绘。

作者额外做了：

- 目标 FPS 限制
- 页面隐藏时跳过

这样做的原因是：

- 这种模糊大圆背景不需要 60fps
- 6fps 左右也已经足够柔和
- 低帧率能省很多资源

这是一种非常工程化的思路：

```text
不是所有动画都追求更快
而是追求“够用且稳定”
```

### 30.6 `blurred-bubbles.tsx` 最值得你学什么？

这个组件最值得学的是：

- React 负责生命周期
- canvas 负责高频绘制
- 数学/物理规则负责自然感
- `motion` 只负责最外层过渡

也就是说，作者没有执着于“全部都用 motion 做”。

而是根据场景选了更合适的工具。

这恰恰是成熟前端最重要的能力之一。

---

### 30.7 再看 `snowfall.tsx`：为什么这里反而直接用很多 `motion.div`？

文件：

```text
src/layout/backgrounds/snowfall.tsx
```

这个背景和气泡背景完全不一样。

雪花动画的特点是：

- 每个元素都很简单
- 每个元素的运动轨迹很单纯
- 大部分是从上往下线性移动
- 不需要复杂碰撞和物理

所以这里直接用很多 `motion.div` 就完全合理。

### 30.8 这个组件的思路特别简单

第一步，先随机生成一批雪花数据：

```tsx
for (let i = 0; i < count; i++) {
  ...
  newSnowflakes.push({
    id: i,
    type,
    size,
    duration,
    delay,
    left,
    rotate
  })
}
```

每片雪花有：

- 类型：小白点或雪花图片
- 大小
- 下落时长
- 延迟
- 初始横向位置
- 旋转角度

然后渲染时把每片雪花映射成一个 `motion.div`。

### 30.9 真正的雪花动画在这里

```tsx
<motion.div
  initial={{ y: 0, x: 0 }}
  animate={{
    y: window.innerHeight + 200,
    x: `-${(Math.random() * window.innerWidth) / 5}px`,
    rotate: snowflake.type === 'image' ? snowflake.rotate : 0
  }}
  transition={{
    duration: snowflake.duration,
    delay: snowflake.delay,
    repeat: Infinity,
    ease: 'linear'
  }}
/>
```

这段要这样理解。

#### `initial`

从元素自己的起点开始。

#### `animate.y`

落到屏幕底部之外。

也就是：

- 从屏幕上方开始
- 一路掉出屏幕

#### `animate.x`

给一点横向漂移。

这样雪不会死板地垂直下落。

#### `rotate`

只有雪花图片类型才旋转；
纯白点不旋转。

#### `repeat: Infinity`

无限循环下落。

#### `ease: 'linear'`

匀速下落。

这很合理，因为雪花下落通常不需要明显加速减速。

### 30.10 为什么这个组件不用 canvas 也没问题？

因为它的每个元素都很轻：

- 一个小白点，或者一张小图片
- 轨迹简单
- 不需要复杂相互作用

所以这里直接用 DOM + motion 的好处反而更多：

- 写法直观
- 好调样式
- 可以很容易混合图片和纯色点
- 和 React 组件心智一致

换句话说：

```text
简单重复元素 + 简单轨迹
很适合直接用 motion 列表渲染
```

### 30.11 这两个背景组件，怎么判断谁更适合你的场景？

你可以用下面这条经验法则。

#### 更适合用 `motion + DOM`

当你的动画满足这些条件时：

- 元素数量不算特别夸张
- 每个元素样式明确
- 轨迹比较简单
- 你希望方便地写 JSX / Tailwind

例如：

- 雪花下落
- 飘浮标签
- 气泡按钮
- 徽标散开

#### 更适合用 `canvas`

当你的动画满足这些条件时：

- 元素很多
- 每帧都要重绘
- 需要复杂位置计算
- 需要自定义物理/噪声/粒子系统
- 不太依赖 DOM 语义

例如：

- 流体背景
- 大量粒子系统
- 噪声驱动的抽象背景
- 轨迹模拟

### 30.12 这个项目在背景动画上的设计思路，非常值得你记住

它没有走两个极端。

不是：

- 所有动画都用 motion

也不是：

- 所有动画都自己写 canvas

而是：

- UI 交互型动画优先用 `motion`
- 抽象背景型动画按需用 `canvas`

这就是“为场景选工具”。

### 30.13 如果你以后想自己改这两个背景，建议怎么改？

#### 改 `snowfall.tsx`，比较安全的改法

你可以先改：

- `count`
- `DOT_RATIO`
- 雪花尺寸范围
- `duration`

例如：

- 雪花更少：更克制
- 雪花更大：更卡通
- duration 更长：更慢更柔和

#### 改 `blurred-bubbles.tsx`，先从参数下手

我建议你优先改这些参数：

- `count`
- `minRadius`
- `maxRadius`
- `bottomBandStart`
- `speed`
- `targetFps`
- `colors`

不要一上来就改：

- `updatePhysics()`
- `lowestOccupancyTarget()`
- `makeNoise2D()`

因为这些是这个背景自然感的核心。

### 30.14 如果你想把背景换成自己的风格，最稳的办法是什么？

我建议这样做。

#### 方法 1：先只换颜色

改：

```text
src/config/site-content.json
```

里的：

- `backgroundColors`
- `theme`

这一步最安全，而且效果立刻明显。

#### 方法 2：保留结构，只调参数

例如：

- 气泡更少
- 雪花更慢
- 背景更靠下

这比重写组件稳得多。

#### 方法 3：不需要某个背景就关掉入口逻辑

例如圣诞雪花，其实是通过：

```text
siteContent.enableChristmas
```

控制的。

所以你不需要雪花时，不用删组件，直接把开关关掉就行。

### 30.15 学完这一节后，你应该得到什么结论？

最重要的结论是这句：

```text
Motion 不是用来解决所有动画问题的，
而是用来高效解决“UI 层动画”问题的。
```

而：

```text
Canvas 更适合高频、抽象、算法驱动的背景动画。
```

如果你把这两个边界感学会了，你后面自己做页面动效时，思路会清晰很多。

## 31. 全局入口精讲：`src/app/layout.tsx` 和 `src/layout/index.tsx`

前面你已经看了很多页面和组件。

但如果你想真正理解“这个站为什么能统一运作”，必须吃透这两层：

- `src/app/layout.tsx`
- `src/layout/index.tsx`

你可以把它们理解成：

```text
src/app/layout.tsx   = Next.js 级别的总入口
src/layout/index.tsx = 网站视觉壳子和全局交互层
```

这两层关系非常重要。

---

### 31.1 先看 `src/app/layout.tsx`：为什么它是整个站最顶层的入口？

文件：

```text
src/app/layout.tsx
```

这个文件是 Next.js App Router 约定的根布局文件。

意思是：

- 所有页面最终都会经过它
- 它包住整个应用

### 31.2 它做的第一件事：加载全局样式

关键代码：

```tsx
import '@/styles/globals.css'
```

这一步非常基础，但意义很大。

因为：

- Tailwind v4 的导入在这里生效
- 全站基础颜色、utility、文章样式也都从这里进入

如果没有这行：

- 整个网站的 Tailwind 样式和自定义 utility 基本都会失效

### 31.3 它做的第二件事：从配置文件提取站点信息

关键代码：

```tsx
import siteContent from '@/config/site-content.json'

const {
  meta: { title, description },
  theme
} = siteContent
```

这说明 `layout.tsx` 本身不是写死标题和主题，而是从配置里读。

这里很值得你记住。

因为这意味着：

- 网站身份信息是数据
- 不是写死在 React 组件里的常量

这也是为什么你改 `site-content.json` 会牵一发动全身。

### 31.4 它做的第三件事：生成 `metadata`

关键代码：

```tsx
export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description
  },
  twitter: {
    title,
    description
  }
}
```

这一块是 Next.js 的标准能力。

作用是：

- 设置页面标题
- 设置 SEO 描述
- 设置 Open Graph
- 设置 Twitter 分享信息

也就是说：

```text
site-content.json -> metadata -> 搜索引擎/社交平台看到的信息
```

所以你如果要换成你自己的站，这里最先影响的就是：

- 浏览器标题
- 分享卡片标题和描述

### 31.5 它做的第四件事：把主题色写进 `<html>`

关键代码：

```tsx
const htmlStyle = {
  cursor: 'url(/images/cursor.svg) 2 1, auto',
  '--color-brand': theme.colorBrand,
  '--color-primary': theme.colorPrimary,
  '--color-secondary': theme.colorSecondary,
  '--color-brand-secondary': theme.colorBrandSecondary,
  '--color-bg': theme.colorBg,
  '--color-border': theme.colorBorder,
  '--color-card': theme.colorCard,
  '--color-article': theme.colorArticle
}
```

然后：

```tsx
<html lang='en' suppressHydrationWarning style={htmlStyle}>
```

这里的意义非常大。

它不是把主题变量写在某个局部组件上，而是直接写到整个 HTML 根节点。

结果就是：

- 全站所有地方都能读取这些 CSS 变量
- 样式天然全局统一

也就是说，主题系统的链路是：

```text
site-content.json
-> htmlStyle
-> <html style=...>
-> CSS 变量
-> globals.css / 各组件样式
```

这就是为什么这个项目可以做到“改一份 JSON，全站主题一起变”。

### 31.6 这里为什么直接在 `<html>` 上设置 cursor？

关键代码：

```tsx
cursor: 'url(/images/cursor.svg) 2 1, auto'
```

作用是：

- 自定义全站鼠标指针

这说明这个项目很多“品牌感”不是靠复杂逻辑，而是靠这种全局细节统一建立起来的。

### 31.7 `suppressHydrationWarning` 是什么？

关键代码：

```tsx
<html ... suppressHydrationWarning ...>
```

你现在可以先这样理解：

```text
告诉 React：
如果服务端和客户端在 hydration 时有一点点内容不一致，
先别大惊小怪报 warning
```

这个项目里之所以可能需要它，是因为：

- 有些样式和状态会在客户端进一步调整
- 页面里也有依赖浏览器环境的逻辑

对初学者来说，你先记住它是“减少 hydration 警告的保护开关”就够了。

### 31.8 `RootLayout` 真正返回了什么？

关键结构是：

```tsx
<html ...>
  <Head />
  <body>
    <script ... />
    <Layout>{children}</Layout>
  </body>
</html>
```

这里你要特别注意两层：

- `<Head />`
- `<Layout>{children}</Layout>`

#### `<Head />`

来自：

```text
src/layout/head.tsx
```

它补充的是：

- viewport
- manifest
- favicon
- 字体
- Google Analytics

也就是说，`metadata` 负责标准 SEO 信息，
而 `Head` 负责更偏手工控制的头部标签。

#### `<Layout>{children}</Layout>`

这是最关键的一层。

它表示：

- 当前页面内容不是直接放进 body
- 而是先交给 `src/layout/index.tsx`

所以：

```text
src/app/layout.tsx 决定应用结构
src/layout/index.tsx 决定站点外壳
```

这个边界你一定要分清。

### 31.9 中间那段内联 script 在干嘛？

关键代码：

```tsx
if (/windows|win32/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('windows');
}
```

作用是：

- 如果检测到 Windows 用户，就给 `<html>` 加一个 `windows` class

然后你会在 `globals.css` 里看到：

```css
.windows {
  @apply scrollbar-none;
}
```

也就是说，这是一种平台差异适配。

作者想解决的问题大概是：

- Windows 下滚动条和某些视觉效果不够统一

所以就用最简单的方式做了一个平台标记。

---

### 31.10 再看 `src/layout/index.tsx`：为什么它才是“网站外壳”？

文件：

```text
src/layout/index.tsx
```

这个文件一上来就有：

```tsx
'use client'
```

这说明它是客户端组件。

为什么这里必须是客户端？

因为它内部做了很多只能在浏览器里做的事：

- 读取窗口大小
- 读取页面中心点
- 控制 Toaster
- 控制移动端/桌面端差异
- 渲染一些依赖交互的浮层组件

所以你可以把它理解成：

```text
src/app/layout.tsx 负责“应用壳”
src/layout/index.tsx 负责“浏览器里的真实互动壳”
```

### 31.11 它做的第一件事：初始化全局布局状态

关键代码：

```tsx
useCenterInit()
useSizeInit()
```

这两行非常重要。

#### `useCenterInit()`

负责初始化：

- 视口中心点
- 页面宽高

对应 store 在：

```text
src/hooks/use-center.ts
```

#### `useSizeInit()`

负责初始化：

- `maxXL`
- `maxLG`
- `maxMD`
- `maxSM`
- `maxXS`

对应 store 在：

```text
src/hooks/use-size.ts
```

这两套状态是首页卡片、导航、音乐卡片、回到顶部按钮布局判断的基础。

也就是说：

```text
如果没有这两行，
整个响应式布局和中心定位体系都跑不起来
```

### 31.12 它做的第二件事：把配置 store 接到全局布局里

关键代码：

```tsx
const { cardStyles, siteContent, regenerateKey } = useConfigStore()
const { maxSM, init } = useSize()
```

这意味着全局布局层直接依赖：

- 当前站点配置
- 当前首页卡片配置
- 当前响应式状态

所以 `Layout` 不是“纯视觉壳”，它也是配置驱动的一部分。

### 31.13 它做的第三件事：渲染全局 Toaster

关键代码：

```tsx
<Toaster
  position='bottom-right'
  richColors
  icons={{ ... }}
  style={{ '--border-radius': '12px' }}
/>
```

这个很值得注意。

很多项目会在某个页面才放 toast 容器；
这个项目直接放在全局布局里。

好处是：

- 任意页面、任意组件都能直接 `toast.success(...)`
- 不需要每个页面自己再挂一份

这是一种非常标准而且正确的全局放置方式。

### 31.14 它做的第四件事：处理背景图

关键代码：

```tsx
const backgroundImages = (siteContent.backgroundImages ?? []) as Array<{ id: string; url: string }>
const currentBackgroundImageId = siteContent.currentBackgroundImageId
const currentBackgroundImage =
  currentBackgroundImageId && currentBackgroundImageId.trim()
    ? backgroundImages.find(item => item.id === currentBackgroundImageId)
    : null
```

然后：

```tsx
{currentBackgroundImage && (
  <div
    className='fixed inset-0 z-0 overflow-hidden'
    style={{
      backgroundImage: `url(${currentBackgroundImage.url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}
  />
)}
```

这说明背景图本身也是配置驱动的。

你在首页配置面板里选背景，本质上就是改变：

- `backgroundImages`
- `currentBackgroundImageId`

而全局布局层负责把它真正铺满整站。

### 31.15 它做的第五件事：永远渲染模糊气泡背景

关键代码：

```tsx
<BlurredBubblesBackground colors={siteContent.backgroundColors} regenerateKey={regenerateKey} />
```

这个很关键。

因为气泡背景不是首页专属，而是全站氛围层的一部分。

而且它接了两个配置：

- `colors`
- `regenerateKey`

意思是：

- 颜色能跟着站点主题变化
- 当配置层要求重新生成背景时，它能重新生成

### 31.16 `regenerateKey` 为什么有用？

你可以把它理解成：

```text
一个“请你重新生成背景”的计数器信号
```

例如用户在配置面板里改了背景颜色后，
如果只是 React 普通重渲染，不一定能得到新的气泡分布。

所以这里用一个 key-like 的数字信号，提醒背景组件重新初始化。

这是一个很好用的小技巧。

### 31.17 它做的第六件事：真正承载页面内容

关键代码：

```tsx
<main className='relative z-10 h-full'>
  {children}
  <NavCard />
  {!maxSM && cardStyles.musicCard?.enabled !== false && <MusicCard />}
</main>
```

这一段是整个“网站壳”的核心。

先拆开看。

#### `{children}`

表示当前页面真正内容：

- 首页
- 博客页
- About 页
- 写作页
- 项目页

都会被塞到这里。

#### `<NavCard />`

表示全局导航不是每个页面自己放，而是壳层统一放。

这很重要，因为它保证了：

- 所有页面导航位置统一
- 导航动画和布局规则统一

#### `<MusicCard />`

只有：

- 非移动端
- 并且卡片启用

才显示。

所以全局音乐卡片也属于“壳层组件”，不是单页组件。

### 31.18 它做的第七件事：移动端单独放一个回到顶部按钮

关键代码：

```tsx
{maxSM && init && (
  <ScrollTopButton className='bg-brand/20 fixed right-6 bottom-8 z-50 shadow-md' />
)}
```

这说明作者对移动端体验做了额外照顾。

因为移动端：

- 没有桌面端那样持续可见的音乐卡片和复杂布局
- 用户滚动长页面时更需要快速回顶

所以这个按钮放在全局壳层非常合理。

### 31.19 `src/layout/index.tsx` 为什么写得好？

因为它不是简单的“包一层 div”，而是把全局能力都集中到了正确的位置：

- 全局消息提示
- 全局背景
- 全局导航
- 全局音乐
- 全局移动端辅助按钮
- 响应式初始化
- 布局中心点初始化

也就是说：

```text
页面自己只关心页面内容
全局体验由 Layout 统一托管
```

这就是结构清晰的原因。

### 31.20 `src/app/layout.tsx` 和 `src/layout/index.tsx` 的分工，你最后一定要记住这张图

```text
src/app/layout.tsx
  -> Next.js 根布局
  -> metadata
  -> html/body
  -> 全局 CSS 变量
  -> Head
  -> 把页面交给 Layout

src/layout/index.tsx
  -> 浏览器里的全局 UI 外壳
  -> 背景
  -> Toast
  -> 全局导航
  -> 音乐卡片
  -> 移动端回顶按钮
  -> children 承载所有页面内容
```

如果你把这层分工吃透，后面读任何页面时都会更轻松。

### 31.21 如果你之后要自己改全局结构，最安全的改法是什么？

#### 适合改的

- `site-content.json` 对应的主题变量
- `Head` 里的字体、favicon、统计脚本
- `Layout` 里的背景/导航/音乐/回顶按钮是否显示

#### 暂时别乱动的

- `children` 的包裹关系
- `useCenterInit()` / `useSizeInit()`
- `main` 层级和 z-index 关系
- 背景层与内容层的层级关系

因为这些都是全站布局稳定的基础。

### 31.22 你现在最适合做的练习

我建议你做两个很小但很值的练习。

#### 练习 1：改全局主题

改：

```text
src/config/site-content.json
```

里的：

- `theme`
- `backgroundColors`

然后观察：

- `src/app/layout.tsx` 怎样把这些值注入 HTML
- `src/layout/index.tsx` 怎样把它们用于背景

#### 练习 2：临时关掉某个全局壳层组件

例如你先把：

- `MusicCard`
- `NavCard`

其中一个临时注释掉看看。

这样你会非常直观地理解：

- 哪些东西属于页面本身
- 哪些东西属于全局壳层

## 32. 首页主入口精讲：`page.tsx`、`config-store.ts`、`layout-edit-store.ts`

现在你已经知道：

- 全局入口怎么跑
- 全局壳层怎么挂
- 首页卡片系统大概是什么

接下来要真正吃透首页，就要看这三份文件：

- `src/app/(home)/page.tsx`
- `src/app/(home)/stores/config-store.ts`
- `src/app/(home)/stores/layout-edit-store.ts`

这三份文件的关系非常重要。

你可以先记住这张图：

```text
page.tsx
  -> 首页调度层
  -> 决定渲染哪些卡片
  -> 决定什么时候打开配置弹窗
  -> 决定是否显示“正在编辑布局”的提示条

config-store.ts
  -> 首页和站点的运行时配置中心
  -> 持有 siteContent / cardStyles / configDialogOpen

layout-edit-store.ts
  -> 专门管理首页拖拽编辑状态
  -> 持有 editing / snapshot
  -> 负责拖拽时修改 cardStyles
```

---

### 32.1 先看 `src/app/(home)/page.tsx`：为什么它是首页的“调度层”？

文件：

```text
src/app/(home)/page.tsx
```

它不是某一张卡片，也不是某一个功能弹窗。

它真正做的事情是：

- 读取当前首页配置
- 决定哪些卡片显示
- 决定桌面和移动端差异
- 决定配置弹窗是否打开
- 决定布局编辑提示条是否显示

所以这个文件的角色更像：

```text
首页总控台
```

### 32.2 为什么它是客户端组件？

开头第一行：

```tsx
'use client'
```

原因很直接，因为它用到了很多客户端能力：

- `useEffect`
- `toast`
- 键盘监听
- Zustand store
- `motion`

如果没有 `use client`，这些交互基本都跑不起来。

### 32.3 它一开始导入这么多卡片，不代表它复杂；只是它在做“装配”

文件开头有大量 import：

- `HiCard`
- `ArtCard`
- `ClockCard`
- `CalendarCard`
- `SocialButtons`
- `ShareCard`
- `AritcleCard`
- `WriteButtons`
- `LikePosition`
- `HatCard`
- `BeianCard`

这看起来很多，但不要被吓到。

因为 `page.tsx` 自己并不实现这些卡片内部逻辑。

它做的是：

- 把这些卡片像积木一样拼起来
- 再根据配置决定渲染哪些

所以读这个文件时，不要把它当成“大杂烩”，而要把它当成“首页装配器”。

### 32.4 它先拿了三类状态

关键代码：

```tsx
const { maxSM } = useSize()
const { cardStyles, configDialogOpen, setConfigDialogOpen, siteContent } = useConfigStore()
const editing = useLayoutEditStore(state => state.editing)
const saveEditing = useLayoutEditStore(state => state.saveEditing)
const cancelEditing = useLayoutEditStore(state => state.cancelEditing)
```

这三类状态分别代表：

#### 第一类：设备状态

来自：

```tsx
useSize()
```

这里主要用到了：

- `maxSM`

它决定是不是移动端。

#### 第二类：首页/站点运行时配置

来自：

```tsx
useConfigStore()
```

这里拿到：

- `cardStyles`
- `configDialogOpen`
- `setConfigDialogOpen`
- `siteContent`

也就是说：

- 当前有哪些卡片启用
- 配置弹窗是否打开
- 站点内容开关值

都在这里。

#### 第三类：布局编辑状态

来自：

```tsx
useLayoutEditStore()
```

这里拿到：

- `editing`
- `saveEditing`
- `cancelEditing`

也就是说，页面并不亲自管理拖拽细节；
它只是响应“当前是否在编辑布局”。

### 32.5 顶部那条“正在编辑首页布局”的提示条，作用是什么？

关键代码：

```tsx
{editing && (
  <div ...>
    ...
    <motion.button onClick={handleCancel}>取消</motion.button>
    <motion.button onClick={handleSave}>保存偏移</motion.button>
  </div>
)}
```

这段的角色很清楚：

- 只有布局编辑模式下才显示
- 告诉用户“现在你拖的是首页布局，不是普通浏览状态”
- 给出两个显式动作：
  - 取消
  - 保存偏移

为什么这一步重要？

因为拖拽布局这种操作，如果没有清晰的模式提示，用户会很容易迷惑：

- 我现在是在点卡片？
- 还是在拖卡片？
- 我改动是临时的，还是已经保存了？

所以这条提示条其实是 UX 非常关键的一层。

### 32.6 `handleSave()` 和 `handleCancel()` 真正保存到哪？

关键代码：

```tsx
const handleSave = () => {
  saveEditing()
  toast.success('首页布局偏移已保存（尚未提交到远程配置）')
}

const handleCancel = () => {
  cancelEditing()
  toast.info('已取消此次拖拽布局修改')
}
```

这里有个非常重要的点：

```text
这里的“保存”不是提交到 GitHub，
只是确认本次拖拽编辑在当前运行时状态里生效
```

也就是说分两步：

#### 第一步

拖拽布局 -> 更新运行时 `cardStyles`

#### 第二步

再打开配置弹窗，点击真正的保存 -> `push-site-content.ts` 提交到 GitHub

这就是为什么 toast 文案会特地写：

```text
尚未提交到远程配置
```

这个提示写得很好，因为它明确告诉了用户：

- 你只是本地确认了
- 还没真正写到仓库

### 32.7 为什么它还监听快捷键？

关键代码：

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === ',')) {
      e.preventDefault()
      setConfigDialogOpen(true)
    }
  }
  ...
}, [setConfigDialogOpen])
```

这意味着首页支持快捷键打开配置面板：

- `Ctrl/Cmd + L`
- `Ctrl/Cmd + ,`

这一步很有意思。

因为它说明作者把首页配置看成一个“经常需要调”的工具，而不是隐藏得很深的一次性后台功能。

### 32.8 真正渲染首页卡片的核心就在这一段

关键代码：

```tsx
<div className='max-sm:flex max-sm:flex-col max-sm:items-center max-sm:gap-6 max-sm:pt-28 max-sm:pb-20'>
  {cardStyles.artCard?.enabled !== false && <ArtCard />}
  {cardStyles.hiCard?.enabled !== false && <HiCard />}
  {!maxSM && cardStyles.clockCard?.enabled !== false && <ClockCard />}
  {!maxSM && cardStyles.calendarCard?.enabled !== false && <CalendarCard />}
  {cardStyles.socialButtons?.enabled !== false && <SocialButtons />}
  {!maxSM && cardStyles.shareCard?.enabled !== false && <ShareCard />}
  {cardStyles.articleCard?.enabled !== false && <AritcleCard />}
  {!maxSM && cardStyles.writeButtons?.enabled !== false && <WriteButtons />}
  {cardStyles.likePosition?.enabled !== false && <LikePosition />}
  {cardStyles.hatCard?.enabled !== false && <HatCard />}
  {cardStyles.beianCard?.enabled !== false && <BeianCard />}
</div>
```

这里你一定要学会看出两个维度。

#### 维度 1：配置开关维度

例如：

```tsx
cardStyles.artCard?.enabled !== false
```

表示：

- 默认开
- 只有显式设成 `false` 才隐藏

这是一种比较宽松的配置方式。

#### 维度 2：设备维度

例如：

```tsx
!maxSM && <ClockCard />
```

表示：

- 时钟卡片在移动端不显示

所以首页显示逻辑不是单纯“渲染全部卡片”，而是：

```text
配置决定一层
设备尺寸再决定一层
```

### 32.9 为什么首页外层 `div` 在移动端会切成普通竖排？

关键类名：

```tsx
max-sm:flex
max-sm:flex-col
max-sm:items-center
max-sm:gap-6
max-sm:pt-28
max-sm:pb-20
```

意思是：

- 桌面端：首页靠每张卡片自己的绝对定位
- 移动端：首页改成普通纵向排布

这非常合理。

因为移动端屏幕窄：

- 继续维持绝对定位卡片拼图，体验会很差
- 改成纵向卡片流，阅读和点击都更自然

所以你会发现这个项目不是“硬把桌面布局缩到手机上”，而是做了策略切换。

### 32.10 首页里的圣诞雪花为什么要渲染两层？

关键代码：

```tsx
{siteContent.enableChristmas && <SnowfallBackground zIndex={0} ... />}
...
{siteContent.enableChristmas && <SnowfallBackground zIndex={2} ... />}
```

这很值得观察。

作者不是只渲染一层雪花，而是前后各一层。

你可以把它理解成：

- 一层在内容后面
- 一层在内容前面

效果就是雪花更有空间层次感。

这是一种很简单但有效的视觉技巧。

### 32.11 `ConfigDialog` 为什么放在首页根部？

关键代码：

```tsx
<ConfigDialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} />
```

原因是：

- 它是首页层级的控制面板
- 需要直接访问首页配置和布局状态

如果把它散落到某张卡片内部，反而会把控制关系搞乱。

所以 `page.tsx` 放它，是合理的“调度层职责”。

---

### 32.12 再看 `config-store.ts`：它为什么是“运行时配置中心”？

文件：

```text
src/app/(home)/stores/config-store.ts
```

这个 store 很重要，因为它承接了：

- 初始配置文件
- 页面实时修改
- 配置弹窗预览
- 布局更新

也就是说，它不是单纯保存一个布尔值，而是整个首页和站点配置的运行时镜像。

### 32.13 它一开始从哪里拿默认值？

关键代码：

```tsx
import siteContent from '@/config/site-content.json'
import cardStyles from '@/config/card-styles.json'
```

然后：

```tsx
siteContent: { ...siteContent },
cardStyles: { ...cardStyles },
```

这表示：

- 启动时先从仓库里的 JSON 文件读取默认值
- 再复制进 Zustand store

所以这个 store 的定位不是“数据源本身”，而是：

```text
配置文件在仓库里
store 是运行时副本
```

这个边界很重要。

### 32.14 `ConfigStore` 里最关键的 4 个字段

#### `siteContent`

站点内容配置。

包括：

- 站点标题
- 用户名
- 社交按钮
- 主题
- 背景图
- 圣诞开关

#### `cardStyles`

首页卡片配置。

包括：

- 宽高
- 顺序
- 偏移
- 启用状态

#### `regenerateKey`

控制背景重新生成的信号。

#### `configDialogOpen`

控制首页配置弹窗是否打开。

### 32.15 为什么 `setSiteContent()` 和 `setCardStyles()` 这么简单？

关键代码：

```tsx
setSiteContent: (content: SiteContent) => {
  set({ siteContent: content })
},
setCardStyles: (styles: CardStyles) => {
  set({ cardStyles: styles })
},
```

作者这里没有做复杂 reducer，而是直接整块替换。

这样做的好处是：

- 心智简单
- 调试简单
- 适合配置对象

因为这类数据本来就更像“整份配置”，不是高频细粒度业务状态。

### 32.16 `resetSiteContent()` 和 `resetCardStyles()` 是干嘛的？

关键代码：

```tsx
resetSiteContent: () => {
  set({ siteContent: { ...siteContent } })
},
resetCardStyles: () => {
  set({ cardStyles: { ...cardStyles } })
},
```

作用是：

- 把运行时配置恢复成当前仓库默认配置

这对“预览后撤销”之类场景很有帮助。

### 32.17 `regenerateBubbles()` 为什么只加 1？

关键代码：

```tsx
regenerateBubbles: () => {
  set(state => ({ regenerateKey: state.regenerateKey + 1 }))
}
```

这其实就是一个非常典型的“重新初始化信号”。

重点不在数值本身，而在“变化”。

因为背景组件只需要知道：

```text
你要求我重新来一次
```

并不关心这个值到底是多少。

### 32.18 `configDialogOpen` 为什么也放进 store？

因为这个弹窗不是某一个局部小组件的状态。

它会被这些操作影响：

- 首页按钮点击
- 快捷键
- 配置保存后关闭
- 配置取消后关闭

所以把它放进共享 store 很合理。

---

### 32.19 最后看 `layout-edit-store.ts`：为什么要单独再开一个 store？

文件：

```text
src/app/(home)/stores/layout-edit-store.ts
```

很多初学者看到这里会问：

```text
为什么不把 editing、snapshot、setOffset、setSize
也都直接放到 config-store 里？
```

答案是：

因为“配置” 和 “编辑过程状态” 不是同一种东西。

#### `config-store`

更像：

- 当前首页应该长什么样

#### `layout-edit-store`

更像：

- 我现在是不是正在拖拽编辑
- 编辑前是什么样
- 我改了哪些偏移和尺寸

这就是状态分层。

### 32.20 `editing` 和 `snapshot` 分别是什么？

关键定义：

```tsx
editing: boolean
snapshot: CardStyles | null
```

#### `editing`

表示：

- 当前是不是正在布局编辑模式

#### `snapshot`

表示：

- 进入编辑模式前，先把当时的 `cardStyles` 拍一张快照

为什么要拍快照？

因为如果用户拖着拖着后悔了，必须能恢复。

### 32.21 `startEditing()` 真正干了什么？

关键代码：

```tsx
startEditing: () => {
  const { cardStyles } = useConfigStore.getState()
  set({
    editing: true,
    snapshot: { ...cardStyles }
  })
},
```

意思是：

1. 读取当前配置 store 里的卡片样式
2. 复制一份作为快照
3. 进入编辑模式

这一步非常关键，因为后面的取消功能全靠这份快照。

### 32.22 `cancelEditing()` 为什么要回写到 `config-store`？

关键代码：

```tsx
const { setCardStyles } = useConfigStore.getState()
setCardStyles(snapshot)
```

意思是：

- 如果取消编辑，就把最初快照重新写回配置 store

所以：

```text
layout-edit-store 不是自己保存最终布局
它只是临时编辑控制层
真正的布局数据还是放在 config-store
```

这一层分工你一定要记住。

### 32.23 `saveEditing()` 为什么反而很简单？

关键代码：

```tsx
saveEditing: () => {
  set({
    editing: false,
    snapshot: null
  })
}
```

这表示：

- 保存布局编辑时，并不需要再额外写数据
- 因为拖拽过程中，`cardStyles` 其实已经实时更新了

所以“保存”只是确认：

- 保留当前状态
- 退出编辑模式
- 丢掉快照

这是一种很干净的设计。

### 32.24 `setOffset()` 和 `setSize()` 为什么直接操作 `config-store`？

关键代码：

```tsx
const { cardStyles, setCardStyles } = useConfigStore.getState()
...
setCardStyles(next)
```

这表示：

- 拖拽过程不是存到 layout-edit-store 自己的小副本里
- 而是直接实时写到配置 store

这样做的好处是：

- 页面上的卡片会立刻响应
- 其他依赖 `cardStyles` 的地方也会同步看到变化

坏处是：

- 必须依赖 `snapshot` 才能撤销

但在这种场景下，这个取舍是合理的。

### 32.25 这三份文件连起来看，首页状态流其实很清楚

你可以把首页状态流理解成这样：

```text
仓库里的 JSON
-> config-store 初始化成运行时配置
-> page.tsx 读取 config-store 决定渲染哪些卡片
-> 进入布局编辑时，layout-edit-store 先记录 snapshot
-> 拖拽卡片时，实时修改 config-store.cardStyles
-> 取消时，用 snapshot 恢复
-> 保存时，只退出编辑模式
-> 真正提交到 GitHub，要靠 ConfigDialog 里的保存逻辑
```

这张流程图一定要理解。

因为它把“运行时编辑”和“真正写回仓库”清楚地分开了。

### 32.26 这套首页状态设计为什么值得学？

因为它做对了两件事。

#### 第一件：把状态按职责拆层

- 配置层一个 store
- 编辑过程层一个 store

#### 第二件：把“本地编辑”和“远程提交”拆成两阶段

不是一拖一下就写仓库，而是：

- 先本地调
- 确认后再真正提交

这让用户体验更稳，也更符合实际使用习惯。

### 32.27 如果你之后要自己改首页逻辑，哪些地方最适合先动？

#### 最适合先改

- `page.tsx` 里卡片显示顺序
- `page.tsx` 里移动端显示策略
- `config-store.ts` 里配置结构

#### 先别乱动

- `layout-edit-store.ts` 的 snapshot 回滚逻辑
- 拖拽时实时写 `config-store` 的链路
- 配置弹窗保存和拖拽保存之间的两阶段关系

因为这些已经是首页“可编辑系统”的核心机制了。

### 32.28 你现在最适合做的练习

#### 练习 1：自己关掉两张首页卡片

改：

```text
src/config/card-styles.json
```

把两张卡片设成：

```json
"enabled": false
```

再观察 `page.tsx` 是怎么根据这个开关决定渲染的。

#### 练习 2：自己加一个首页快捷入口

你可以模仿 `page.tsx` 的方式，在首页卡片列表里临时插入一个自己的小卡片组件。

这样你会更容易理解：

- 首页不是写死页面
- 而是“一个总控页 + 一堆可插拔卡片”
