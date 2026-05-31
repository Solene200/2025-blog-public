# 这个项目里 Next.js、GitHub、Git 到底怎么串起来

这份文档专门回答几个问题：

1. 这个项目里，`Next.js` 和 `GitHub` 到底是怎么关联的。
2. 为什么这里经常会说“GitHub 当后端”，它到底存了什么。
3. 每一次写博客、每一次保存配置、每一次 commit，背后真实发生了什么。
4. `git pull`、`git rebase`、`non-fast-forward` 在这个项目里应该怎么理解。
5. 博客索引页、RSS、sitemap 这些“索引”到底是怎么做出来的。

---

## 1. 先给结论：这是一个“前端界面 + GitHub 内容仓库 + 部署平台”的项目

把这个项目先粗暴拆成三层最容易理解：

1. `Next.js` 负责页面、编辑器、按钮、交互和渲染。
2. `GitHub 仓库` 负责存内容和版本历史。
3. `Vercel / Cloudflare` 这类部署平台负责把仓库构建成真正可访问的网站。

所以这里的“GitHub 作为后端”，不是传统意义上的：

- Node 服务
- MySQL / PostgreSQL
- Redis
- CMS 数据库

而是：

- 你的文章内容直接存在仓库文件里
- 你的站点配置直接存在仓库文件里
- 每次站内编辑保存，本质上是在给仓库新增一个 commit

从代码上看，这个结论非常明确：

- GitHub 仓库配置在 [`src/consts.ts`](../src/consts.ts)。
- README 明确要求先部署站点，再配置 `GitHub App`，让前端有权限写仓库，见 [`README.md`](../README.md)。
- 写博客、删博客、改首页配置、改分享列表，都是直接调用 GitHub API 写仓库，而不是调用你自己写的后端接口，见：
  - [`src/app/write/services/push-blog.ts`](../src/app/write/services/push-blog.ts)
  - [`src/app/write/services/delete-blog.ts`](../src/app/write/services/delete-blog.ts)
  - [`src/app/blog/services/save-blog-edits.ts`](../src/app/blog/services/save-blog-edits.ts)
  - [`src/app/(home)/services/push-site-content.ts`](../src/app/%28home%29/services/push-site-content.ts)

---

## 2. 这个项目里，“GitHub 作为后端”到底是什么意思

更准确地说，这个项目把 GitHub 仓库同时当成了三样东西：

1. 内容存储。
2. 版本历史。
3. 写入入口的目标端。

### 2.1 它存的不是“记录”，而是“文件”

例如博客内容不是存在某张数据库表里，而是直接存在这些文件里：

- `public/blogs/<slug>/index.md`
- `public/blogs/<slug>/config.json`
- `public/blogs/index.json`
- `public/blogs/categories.json`

举例：

- 单篇文章正文：`public/blogs/daily-note/index.md`
- 单篇文章元数据：`public/blogs/daily-note/config.json`
- 博客列表索引：`public/blogs/index.json`
- 分类索引：`public/blogs/categories.json`

首页配置、分享列表、项目列表也是同样思路：

- 首页配置：`src/config/site-content.json`
- 卡片样式配置：`src/config/card-styles.json`
- 分享列表：`src/app/share/list.json`
- 项目列表：`src/app/projects/list.json`

所以这里的“后端数据”，其实就是“仓库里的文件内容”。

### 2.2 它为什么像后端

因为从用户视角看，你点一次“保存”，系统确实完成了这些典型后端职责：

1. 做身份认证。
2. 校验是否有写仓库权限。
3. 持久化内容。
4. 生成版本记录。
5. 等部署完成后，让新内容对外可见。

只是这些动作不是你自己写的服务端 API 做的，而是 GitHub 帮你做了持久化和版本管理。

---

## 3. 这里并不是“浏览器直接运行 git 命令”

这是理解整个项目最关键的一点。

浏览器在站内保存博客时，并没有执行：

```bash
git add .
git commit -m "..."
git push origin main
```

它走的是另一条线：

1. 浏览器拿到 GitHub App 的私钥。
2. 在前端签发 JWT。
3. 用 JWT 向 GitHub 换 installation token。
4. 调 GitHub REST API / Git Data API。
5. 远端由 GitHub 创建 blob、tree、commit，并更新 branch ref。

也就是说：

- **结果**和 `git commit + git push` 类似
- **执行位置**完全不同

不是你本机 `.git` 在提交，而是 GitHub 服务器端在替你改远端仓库。

---

## 4. 站内“写博客”一次，背后真实发生的操作

这条链路在 [`src/app/write/services/push-blog.ts`](../src/app/write/services/push-blog.ts) 里非常完整。

### 4.1 认证阶段

认证逻辑在 [`src/lib/auth.ts`](../src/lib/auth.ts) 和 [`src/lib/github-client.ts`](../src/lib/github-client.ts)：

1. 先看浏览器 `sessionStorage` 里有没有缓存 token。
2. 如果没有，就读取当前导入的 GitHub App 私钥。
3. 用私钥签发 JWT。
4. 调 `/repos/{owner}/{repo}/installation` 拿 installation id。
5. 再调 `/app/installations/{id}/access_tokens` 换到 installation token。

对应代码位置：

- JWT 签发：[`src/lib/github-client.ts`](../src/lib/github-client.ts) 第 40-45 行
- 获取 installation id：同文件第 56-175 行
- 获取 installation token：同文件第 177-191 行
- 统一认证入口：[`src/lib/auth.ts`](../src/lib/auth.ts) 第 106-139 行

### 4.2 内容准备阶段

发布文章时，`pushBlog()` 会做这些事情：

1. 读取当前远端分支最新 commit SHA。
2. 处理本地图片，算 hash，转 base64。
3. 上传图片 blob。
4. 把 Markdown 里的 `local-image:<id>` 占位符替换成真正的线上路径。
5. 生成 `config.json`。
6. 更新 `public/blogs/index.json`。

对应代码位置：

- 拿远端分支 SHA：[`src/app/write/services/push-blog.ts`](../src/app/write/services/push-blog.ts) 第 40-45 行
- 上传正文图和封面图：同文件第 71-103 行
- 生成 `index.md`：同文件第 112-119 行
- 生成 `config.json`：同文件第 121-139 行
- 更新 `public/blogs/index.json`：同文件第 141-164 行

### 4.3 真正提交阶段

准备好所有文件后，这个项目会直接调用 GitHub 的 Git Data API：

1. `createBlob`
2. `createTree`
3. `createCommit`
4. `updateRef`

对应代码：

- API 封装在 [`src/lib/github-client.ts`](../src/lib/github-client.ts)
  - `getRef`：第 226-237 行
  - `createTree`：第 247-261 行
  - `createCommit`：第 263-277 行
  - `updateRef`：第 279-291 行
  - `createBlob`：第 344-363 行

在 `pushBlog()` 里的实际调用顺序：

- 创建 tree：[`src/app/write/services/push-blog.ts`](../src/app/write/services/push-blog.ts) 第 166-168 行
- 创建 commit：同文件第 170-172 行
- 更新 `heads/main`：同文件第 174-176 行

### 4.4 最后发生了什么

到这一步，远端仓库已经真的多了一个 commit。

当前仓库里最近的远端提交记录就能证明这一点。例如：

- `19b19b7`，提交信息是 `新增文章: login-mode`
- 作者显示为 `solene200[bot]`
- 修改了 `public/blogs/index.json`
- 新增了 `public/blogs/login-mode/index.md`
- 新增了 `public/blogs/login-mode/config.json`
- 新增了文章图片

这说明站内发文并不是“改缓存”或者“改数据库”，而是**真的向远端仓库写入了 Git 历史**。

---

## 5. 站内“保存首页配置 / 分享列表 / 项目列表”，本质也是同一件事

这不是博客专属逻辑，整个项目基本都走同样套路。

例如：

- 保存首页配置：[`src/app/(home)/services/push-site-content.ts`](../src/app/%28home%29/services/push-site-content.ts)
- 保存分享列表：[`src/app/share/services/push-shares.ts`](../src/app/share/services/push-shares.ts)
- 保存项目列表：[`src/app/projects/services/push-projects.ts`](../src/app/projects/services/push-projects.ts)

它们的共通流程都是：

1. 拿 GitHub token。
2. 读取远端分支头。
3. 生成新 blob。
4. 组装 tree。
5. 创建 commit。
6. 更新远端分支引用。

所以这个项目真正的“后端能力”，其实是一套统一的“前端直写 GitHub”模式。

---

## 6. 读数据时，并不是实时读 GitHub API，而是读部署后的静态文件

这是另一个非常重要、也最容易被忽略的点。

### 6.1 写入线

写入线是：

`浏览器 -> GitHub API -> 远端仓库`

### 6.2 读取线

读取线大多数时候是：

`浏览器 -> 当前已部署的网站静态资源`

不是：

`浏览器 -> GitHub API -> 仓库最新文件`

证据很直接：

- 博客详情页通过 [`src/lib/load-blog.ts`](../src/lib/load-blog.ts) 第 21-37 行，去请求：
  - `/blogs/<slug>/config.json`
  - `/blogs/<slug>/index.md`
- 博客列表页通过 [`src/hooks/use-blog-index.ts`](../src/hooks/use-blog-index.ts) 第 22-43 行，请求：
  - `/blogs/index.json`
- 分类通过 [`src/hooks/use-categories.ts`](../src/hooks/use-categories.ts) 第 29-42 行，请求：
  - `/blogs/categories.json`

这意味着一个非常现实的现象：

1. 你刚保存成功。
2. GitHub 远端已经有新 commit。
3. 但部署平台还没重新构建完成。
4. 这时页面读到的仍然可能是旧静态文件。

所以 README 才会特别提醒：保存后要等部署完成再刷新。

### 6.3 这也解释了一个常见现象

如果：

- `public/blogs/<slug>/index.md` 和 `config.json` 存在
- 但 `public/blogs/index.json` 没更新进去

那么就会出现：

- 详情页 `/blog/<slug>` 能打开
- 但是博客列表页 `/blog` 里没有这篇文章

因为：

- 详情页的数据源是“单篇文件”
- 列表页的数据源是“总索引文件”

这两条读取链路不是一回事。

---

## 7. 博客索引页是怎么做出来的

这个项目的博客索引页不是运行时扫描目录生成的，而是**显式维护一份索引文件**：

- `public/blogs/index.json`

### 7.1 这份索引里存什么

每一项大概长这样：

```json
{
  "slug": "daily-note",
  "title": "任务清单软件",
  "tags": ["开发", "开源"],
  "date": "2026-01-23T09:56",
  "summary": "一款极简的任务清单",
  "cover": "/blogs/daily-note/899dca52074bfa0c.webp",
  "hidden": false,
  "category": "开源"
}
```

它扮演的是“列表页材料化索引”的角色。

### 7.2 索引怎么更新

发文时：

- `pushBlog()` 调 [`prepareBlogsIndex()`](../src/lib/blog-index.ts)
- 先读远端当前的 `public/blogs/index.json`
- 按 `slug` 合并文章
- 再重新排序

对应代码：

- [`src/lib/blog-index.ts`](../src/lib/blog-index.ts) 第 25-37 行
- [`src/app/write/services/push-blog.ts`](../src/app/write/services/push-blog.ts) 第 141-164 行

删文时：

- `deleteBlog()` 会删掉文章目录
- 再同步更新 `public/blogs/index.json`

对应代码：

- [`src/app/write/services/delete-blog.ts`](../src/app/write/services/delete-blog.ts) 第 16-46 行

博客管理页批量保存时：

- `saveBlogEdits()` 会重写：
  - `public/blogs/index.json`
  - `public/blogs/categories.json`

对应代码：

- [`src/app/blog/services/save-blog-edits.ts`](../src/app/blog/services/save-blog-edits.ts) 第 34-54 行

### 7.3 列表页怎么显示

博客列表页组件是 [`src/app/blog/page.tsx`](../src/app/blog/page.tsx)。

它会：

1. 通过 `useBlogIndex()` 拉取 `/blogs/index.json`
2. 通过 `useCategories()` 拉取 `/blogs/categories.json`
3. 在前端按年 / 月 / 周 / 日 / 分类分组
4. 再渲染成列表

对应代码：

- 读取索引：[`src/app/blog/page.tsx`](../src/app/blog/page.tsx) 第 27-34 行
- 按时间和分类分组：同文件第 58-125 行

### 7.4 首页“最新文章”也是从这份索引来的

首页文章卡片不是单独扫文章目录，它也是基于 `index.json`。

- `useLatestBlog()` 在 [`src/hooks/use-blog-index.ts`](../src/hooks/use-blog-index.ts) 第 46-58 行
- 它只是把 `useBlogIndex()` 拿到的列表按日期排序后取第一篇

所以：

- `index.json` 丢了或没更新
- 首页“最新文章”也会一起不对

---

## 8. RSS 和 sitemap 也是围绕这份索引做的

这一点很重要，因为它说明 `public/blogs/index.json` 不只是给 `/blog` 页面用。

### 8.1 sitemap

[`src/app/sitemap.ts`](../src/app/sitemap.ts) 第 1-34 行直接静态导入了：

- `public/blogs/index.json`

然后把每一篇文章生成 sitemap entry。

### 8.2 RSS

[`src/app/rss.xml/route.ts`](../src/app/rss.xml/route.ts) 第 4-14 行也直接导入了：

- `site-content.json`
- `public/blogs/index.json`

然后把博客索引转成 RSS XML。

所以如果 `index.json` 不正确，受影响的通常不止博客列表页，还包括：

- 首页最新文章
- sitemap
- RSS

---

## 9. `git pull` 和 `git rebase` 在这个项目里该怎么理解

先说结论：

- **站内编辑保存**时，不会执行 `git pull`，也不会执行 `git rebase`。
- **你自己的本地仓库**想跟上远端时，才需要 `git fetch / git pull / git rebase`。

### 9.1 站内编辑时为什么不需要 pull

因为站内编辑根本不依赖你的本地仓库。

它直接：

1. 读取远端当前 `main` 的 SHA。
2. 基于那个 SHA 创建新的 commit。
3. 再让 GitHub 更新远端 `main` 指针。

这条链路里没有你的本地 clone 参与。

### 9.2 那什么时候需要 pull

当你在本地继续开发代码、继续 `git push` 时，就必须先把“站内编辑产生的远端新 commit”同步回来。

否则你的本地历史会落后于远端。

当前这个仓库就是一个现成例子。现在本地状态显示：

- `main...origin/main [behind 18]`

也就是说，本地 `main` 比远端 `origin/main` 落后 18 个提交。

再看最近远端提交，能看到很多类似：

- `2026-05-18T11:02:22+00:00 新增文章: login-mode`
- `2026-05-18T11:28:53+00:00 删除:pnpm-upgrade | 更新索引 | 更新分类`
- `2026-05-18T12:09:52+00:00 更新站点配置`

作者都是：

- `solene200[bot]`

这就说明：远端最近这些提交很可能都是通过站内 GitHub App 写进去的，而不是当前这份本地仓库做出来的。

### 9.3 `git pull` 是什么

`git pull` 本质上等于：

```bash
git fetch
git merge
```

如果远端只是比你新，而你本地没有分叉提交，它会直接 fast-forward。

### 9.4 `git pull --rebase` 是什么

`git pull --rebase` 本质上更接近：

```bash
git fetch
git rebase origin/main
```

当“远端有新提交，你本地也有自己的提交”时，它会把你的本地提交临时拿下来，再重新接到远端最新提交后面。

效果通常是：

- 历史更直
- 少一个 merge commit

### 9.5 当前仓库有没有强制配置 rebase

从当前 `.git/config` 看，没有显式的 `pull.rebase=true` 配置，只有：

- `origin` 远端地址
- `main` 跟踪 `origin/main`

见 [`.git/config`](../.git/config)。

所以你本地执行 `git pull` 时到底是 merge 还是 rebase，不是这个仓库代码强制决定的，而是取决于你本机 Git 配置和你具体使用的命令。

---

## 10. 为什么会出现 `non-fast-forward`，明明没有多人协作

这是很多人第一次把“站内可视化编辑”和“本地 Git 开发”混在一起时最容易误解的点。

### 10.1 `non-fast-forward` 的本质

它的意思不是“多人协作才会冲突”，而是：

> 你准备推上去的那个分支，不是远端当前分支头的直接后继。

换句话说，远端分支已经先往前走了，而你本地还停在旧位置。

### 10.2 即使只有你一个人，也完全可能发生

只要远端分支被下面任何一种方式推进过，本地就可能落后：

1. 你在站内点击过“保存”。
2. 你在另一台电脑 push 过。
3. 你在 GitHub 网页上直接改过文件。
4. 某个 GitHub App / bot 帮你提交过。

所以“没有多人协作”不等于“远端只有一个写入入口”。

这个项目恰好就有一个额外写入入口：

- 站内前端 + GitHub App

### 10.3 用这个仓库当前状态举例

当前本地：

- `HEAD -> main` 停在 `352d4ee`

当前远端：

- `origin/main` 已经到 `10eba66`

这中间多出来的大量提交，都是远端新增的。

所以如果你现在本地再基于 `352d4ee` 直接 `git push origin main`，GitHub 很可能会拒绝，原因就是：

- 远端已经不是你以为的那个旧分支头了
- 你的 push 不是 fast-forward

### 10.4 正确理解这个错误

`non-fast-forward` 不是“你做错了什么特别高级的事”，只是说明：

- 你的本地历史过时了
- 你需要先把远端历史接回来

通常处理顺序是：

1. `git fetch origin`
2. 看一下差异
3. 选择 `git pull origin main` 或 `git pull --rebase origin main`
4. 解决冲突
5. 再 `git push`

---

## 11. 这里还有一个“远端侧”的 non-fast-forward 保护

这个补充很重要。

不仅本地 `git push` 会遇到 fast-forward 保护，这个项目的站内写入本身也有类似约束。

原因在于：

1. 代码先 `getRef()` 取远端当前分支 SHA。
2. 再用这个 SHA 作为 parent 创建新 commit。
3. 然后 `updateRef(..., force = false)` 更新分支。

对应代码：

- 读取 ref：[`src/lib/github-client.ts`](../src/lib/github-client.ts) 第 226-237 行
- 更新 ref：同文件第 279-291 行

注意 `force` 默认是 `false`。

这意味着如果：

1. 你先拿到远端旧 SHA
2. 你还没提交时，另一个保存动作已经先把远端推进了
3. 你再更新 ref

那这次更新也可能失败，因为你基于的是过时分支头。

所以这个项目即使不走本地 `git push`，**远端 API 写入本身也在遵守 Git 的线性历史约束**。

---

## 12. GitHub 作为存储，底层到底怎么存

从 Git 的角度，核心不是“表”和“行”，而是四种对象关系：

1. `blob`：文件内容。
2. `tree`：目录结构。
3. `commit`：一次提交，指向一个 tree 和父 commit。
4. `ref`：分支指针，比如 `refs/heads/main`。

这个项目用 GitHub API 时，几乎就是在手工构造这四层关系。

### 12.1 一篇博客发布后，Git 里发生了什么

可以粗略理解成这样：

```text
refs/heads/main
    ->
  commit C2
    parent -> commit C1
    tree   -> tree T2

tree T2 里包含：
    public/blogs/<slug>/index.md       -> blob
    public/blogs/<slug>/config.json    -> blob
    public/blogs/index.json            -> blob
    public/blogs/<slug>/<image>.png    -> blob
```

所以“GitHub 存博客”这句话，底层真实含义是：

- GitHub 替你存了一组新的 Git 对象
- 然后把 `main` 分支指针移到新 commit 上

### 12.2 GitHub 在这之外还额外提供了什么

GitHub 比纯 Git 仓库多提供了：

1. 身份认证。
2. 仓库权限模型。
3. REST API / Git Data API。
4. 网页浏览界面。
5. 搜索和代码索引。
6. App / bot 机制。

但这个项目运行时真正依赖的是：

- GitHub 的权限和 API
- Git 的对象模型

---

## 13. 你说的“索引”，这里其实有三种完全不同的东西

这一段专门用来防止概念混淆。

### 13.1 Git 的 index

如果你说的是 Git 自己的 `index`，那通常指的是：

- 暂存区
- 也就是 `git add` 之后、`git commit` 之前那层本地状态

这个东西存在于你本地 `.git/index`，和博客列表页没有直接关系。

### 13.2 GitHub 的代码搜索索引

如果你说的是 GitHub 网站的“索引”，那更像是：

- GitHub 为了让你能在网页上搜索代码、文件名、符号
- 对仓库内容做的内部搜索索引

这个项目运行时**并没有**用到 GitHub 的搜索索引来生成博客列表。

### 13.3 这个项目自己的博客索引

这个项目真正依赖的是：

- `public/blogs/index.json`

这是应用层自己维护的一份“博客目录索引”。

所以：

- Git 的 index 不是它
- GitHub 搜索索引也不是它
- 它是这个博客项目自己生成的一份 JSON 列表

---

## 14. 整个 Git 流程图，我按这个项目拆给你

### 14.1 站内保存博客 / 配置 的流程图

```text
你在网页里点保存
    ->
前端读取私钥 / 缓存 token
    ->
签发 GitHub App JWT
    ->
向 GitHub 换 installation token
    ->
读取远端 main 当前 SHA
    ->
把图片 / Markdown / JSON 转成 blob
    ->
组装 tree
    ->
创建 commit
    ->
updateRef 到 main
    ->
远端仓库出现新 commit
    ->
部署平台检测到仓库更新
    ->
重新构建站点
    ->
新的静态文件可被访问
```

### 14.2 本地改代码并 push 的流程图

```text
你在本地改代码
    ->
git add
    ->
git commit
    ->
git fetch origin
    ->
检查本地和 origin/main 是否分叉
    ->
如果远端已前进：
    选择 git pull 或 git pull --rebase
    ->
解决冲突
    ->
git push origin main
    ->
远端仓库更新
    ->
部署平台重新构建
```

### 14.3 两条线最核心的区别

站内保存：

- 不依赖你当前这台机器的本地 Git 仓库
- 直接改远端

本地开发：

- 依赖你自己的 clone
- 需要自己同步远端历史

---

## 15. 这个项目里，`git pull` 还是 `git rebase` 更适合

如果只从“把本地同步到远端最新”这个目标看：

- **没有本地提交时**，`git pull` 就够了。
- **本地有提交、远端也有新提交时**，`git pull --rebase origin main` 通常更干净。

我更建议你在这个项目里养成一个习惯：

```bash
git fetch origin
git status -sb
git log --oneline --graph --decorate --left-right HEAD...origin/main
```

看清楚到底是：

1. 只有远端前进了。
2. 只有本地前进了。
3. 本地和远端都前进了。

然后再决定：

- `git pull origin main`
- 或 `git pull --rebase origin main`

如果你经常站内改内容，又经常本地改代码，`pull --rebase` 往往会更顺手，因为它更接近“把我本地代码接到远端最新历史后面”。

---

## 16. 这个仓库当前能看出的额外事实

这是我根据仓库当前状态直接观察到的，不是泛泛而谈。

### 16.1 当前本地明显落后远端

当前 `git status -sb` 显示：

- `main...origin/main [behind 18]`

说明这份本地代码没有跟上远端。

### 16.2 远端最近很多提交是 bot 做的

最近远端提交作者大多是：

- `solene200[bot]`

这和“站内 GitHub App 直接写仓库”的设计是对得上的。

### 16.3 仓库里没有 `.github/workflows`

当前仓库里看不到 GitHub Actions 工作流。

所以自动部署大概率不是“仓库内 workflow 在做”，而是：

- Vercel 连接 GitHub 仓库后自动重建
- 或 Cloudflare 侧的 Git 集成自动重建

这是根据：

- README 的 Vercel 部署说明
- `wrangler.toml` 的 Cloudflare 配置
- 仓库内没有 `.github/workflows`

做出的合理判断。

---

## 17. 还有哪些值得补充的理解

### 17.1 这不是传统后端，更像“Git 驱动 CMS”

这套架构最合适的理解不是“GitHub 等于数据库”，而是：

> GitHub 仓库承担了内容仓库、版本历史和写入目标，Next.js 只是把它做成了一个可视化 CMS 界面。

### 17.2 读写不是同一条链路

这是调试时最值钱的认知：

- 写入看 GitHub 提交有没有成功
- 读取看部署是否完成、静态资源是否更新

不要把这两件事混成一件事。

### 17.3 `index.json` 是整个博客系统的中轴

这个文件一旦不一致，可能同时影响：

- `/blog` 列表页
- 首页最新文章
- 分类
- sitemap
- RSS

所以它是这个项目里最关键的“内容总索引”。

### 17.4 站内编辑和本地开发并存时，要把远端当成第一现场

因为站内保存是直接改远端。

这意味着：

- 你的本地仓库不再天然是“唯一真相”
- 真正最新的历史在远端 `origin/main`

如果你继续本地开发代码，先同步远端是必须动作。

### 17.5 这套方案对个人博客很方便，但安全边界要清楚

这个项目为了实现“站内直接编辑”，把 GitHub App 私钥导入到浏览器侧使用，再通过 token 换取写仓库能力。

对个人博客来说，这样做很方便。

但它不是传统意义上的严密服务端密钥隔离模型，所以更适合：

- 自己维护的个人站
- 可接受 Git 驱动内容流

不太适合直接照搬到强多用户、多角色、高安全要求的后台系统里。

---

## 18. 最后用一句话收束

这个项目的本质是：

> `Next.js` 负责做 UI 和读取部署后的静态文件，`GitHub App + GitHub API` 负责把编辑结果直接写进远端仓库，部署平台再把仓库重新构建成可访问的网站。

所以：

- 站内点“保存”本质上是在制造远端 commit
- 本地 `git pull / rebase` 是为了把这些远端 commit 同步回你的开发机
- 博客索引页不是 GitHub 自动帮你扫出来的，而是项目自己维护的 `public/blogs/index.json`

