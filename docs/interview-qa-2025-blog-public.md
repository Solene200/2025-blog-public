# 2025-blog-public 面试题深度回答

这份文档不是泛泛而谈的八股答案，而是基于当前 `2025-blog-public` 仓库的实际实现来回答。为了避免把“理想设计”误说成“项目现状”，我先给出两个必须先澄清的事实：

1. 这个项目没有传统意义上的“登录页”或 OAuth 跳转授权。
用户的“登录动作”其实是前端导入 GitHub App 的 `.pem` 私钥文件，然后浏览器直接签 JWT、直接请求 GitHub API。

2. 这个项目也没有“服务端代签 Installation Token”的中间层。
GitHub App JWT 的签发发生在浏览器里，Installation Token 是 GitHub 服务端签发后返回给前端，前端再拿它直接读写仓库。

如果面试官一开始就把这个项目理解成“Next.js 前端 + Vercel API Route + GitHub App 服务端签发”，你最好先把这个前提纠正掉，否则后面的回答会越来越偏。

---

## 先给出一张总图

当前项目最核心的链路可以概括成：

```text
用户导入 .pem 私钥
-> 前端 Zustand 保存私钥
-> 浏览器用私钥签 GitHub App JWT
-> 前端请求 GitHub 获取 installation id
-> 前端请求 GitHub 获取 installation token
-> 前端直接调 GitHub REST / Git Database API
-> 创建 blob / tree / commit / update ref
-> GitHub 仓库产生真实 commit
-> Vercel 因 push 触发重新部署
-> 用户刷新后看到新内容
```

对应关键文件：

- `src/lib/auth.ts`
- `src/lib/github-client.ts`
- `src/hooks/use-auth.ts`
- `src/app/write/services/push-blog.ts`
- `src/app/write/services/delete-blog.ts`
- `src/app/(home)/services/push-site-content.ts`
- `src/lib/markdown-renderer.ts`
- `src/hooks/use-markdown-render.tsx`
- `src/hooks/use-blog-index.ts`
- `src/app/(home)/stores/config-store.ts`

---

## 第一部分：项目深度面试题

### 1. 为什么选择“仓库即 CMS”？相比传统 Headless CMS，这种方案的核心优缺点是什么？

这个项目选择“仓库即 CMS”，本质上是在用 Git 仓库同时承担三种角色：

- 内容存储
- 版本历史
- 发布触发器

在当前仓库里，博客正文是 `public/blogs/<slug>/index.md`，文章元信息是 `public/blogs/<slug>/config.json`，博客索引是 `public/blogs/index.json`，全站主题和首页配置则写在 `src/config/site-content.json` 与 `src/config/card-styles.json`。也就是说，这个项目压根没有数据库表，也没有独立的 CMS 管理后台数据库。

为什么这个选择对当前项目成立？因为它的目标不是“多人协作的大型内容平台”，而是“个人博客 / 数字花园 / 可视化编辑的静态站点”。对于这类场景，仓库天然自带几个非常强的能力：

- 所有内容都是文件，迁移和备份极低成本。
- Git commit 天生就是审计日志和版本回滚记录。
- 内容变更和代码变更可以放在同一个交付链路里。
- GitHub + Vercel 这套组合对个人项目几乎零后端维护成本。

和 Strapi、Contentful 这类 Headless CMS 比，核心优点有这些：

- 架构简单。没有数据库、没有后台服务、没有单独的内容管理系统运维。
- 版本能力天然存在。每次编辑都是 commit，不需要额外做草稿历史、diff、回滚。
- 成本低。对个人站点来说，GitHub 仓库和 Vercel 已经够用。
- 内容 ownership 更强。文章、图片、主题配置最终都落成仓库文件，迁移成本很低。
- 与静态站点耦合顺滑。文件内容和构建产物直接对应，SEO、RSS、Sitemap 都容易做。

核心缺点也非常明确：

- 写入延迟高。当前项目每次内容写入本质上都是 push 到仓库，再等 Vercel 重建，不是数据库级实时写入。
- 冲突处理弱。它没有 CMS 常见的乐观锁、协作锁、草稿区、审核流。
- 前端直接持有写权限风险高。这个项目把 `.pem` 私钥给了浏览器，安全边界明显弱于服务端代签。
- 内容结构约束弱。没有成熟 CMS 的 schema、字段校验、富文本组件化、权限面板。
- 对高频编辑不友好。频繁改草稿会频繁产生 commit 和部署。

所以面试时最好的表述不是“仓库即 CMS 一定更好”，而是：

这个方案非常适合个人站点、内容结构相对稳定、希望极简运维并保留 Git 历史的场景；但如果是多人编辑、复杂审核流、细粒度权限、强实时预览和内容建模，传统 Headless CMS 会更合适。

---

### 2. GitHub App 认证全流程是什么？涉及几次网络请求？JWT 和 Installation Token 分别在哪里生成？

先纠正一下题目里的前提：当前项目没有“点击登录 -> 跳转 GitHub 授权页 -> 回调拿 code”这条 OAuth 流程。它的“登录”其实是导入 `.pem` 私钥文件。

当前项目的真实流程如下：

1. 用户在写作页、配置页、博客管理页点击“导入密钥”。
2. 前端 `<input type="file" accept=".pem">` 读取本地私钥文件。
3. `readFileAsText()` 把 `.pem` 内容读成字符串。
4. `useAuthStore.setPrivateKey()` 把私钥放进 Zustand。
5. 如果 `siteContent.isCachePem` 开启，则 `src/lib/auth.ts` 会用 AES-GCM 加密后写入 `sessionStorage`。
6. 用户点击“发布”或“保存”时，代码调用 `getAuthToken()`。
7. `getAuthToken()` 先检查 `sessionStorage` 里是否有未过期的 Installation Token。
8. 如果没有可用 token，就调用 `signAppJwt()` 在浏览器里用私钥签 GitHub App JWT。
9. 前端发起 `GET /repos/{owner}/{repo}/installation`，获取该仓库对应的 installation id。
10. 前端再发起 `POST /app/installations/{installationId}/access_tokens`，用 JWT 换 Installation Token。
11. GitHub 返回 `token` 和 `expires_at`，前端把它缓存到 `sessionStorage`。
12. 后续前端用这个 Installation Token 直接调用 GitHub API 读写仓库。

如果只算“认证阶段”，网络请求是 2 次：

1. `GET /repos/{owner}/{repo}/installation`
2. `POST /app/installations/{installationId}/access_tokens`

读取 `.pem` 文件本身不走网络，是本地 `FileReader` 行为。

如果继续算“拿到 Installation Token 后发布一篇最简单的无图文章”，还要追加这些请求：

1. `GET /repos/{owner}/{repo}/git/ref/heads/{branch}`
2. `GET /repos/{owner}/{repo}/contents/public/blogs/index.json?ref={branch}`
3. `POST /repos/{owner}/{repo}/git/blobs` 创建 `index.md`
4. `POST /repos/{owner}/{repo}/git/blobs` 创建 `config.json`
5. `POST /repos/{owner}/{repo}/git/blobs` 创建新的 `public/blogs/index.json`
6. `POST /repos/{owner}/{repo}/git/trees`
7. `POST /repos/{owner}/{repo}/git/commits`
8. `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}`

也就是说，最小发布链路是：

- 2 次认证请求
- 8 次写仓库请求
- 合计 10 次

如果文章里还有本地图片，每张图片还会额外多 1 次 `createBlob` 请求。

两个 token 的生成位置要说清楚：

- JWT 由前端在浏览器里生成。实现位于 `src/lib/github-client.ts` 的 `signAppJwt()`。
- Installation Token 不是前端本地生成的，而是 GitHub 服务器在收到 `POST /app/installations/{id}/access_tokens` 后签发，再返回给前端。

这也是为什么这个项目不是 OAuth，而是典型的 GitHub App app-auth + installation-auth 双阶段认证。

---

### 3. Token 缓存与自动续期机制是什么？前端缓存 Installation Token 有什么风险？中途过期怎么办？

当前项目的缓存与续期逻辑在 `src/lib/auth.ts`。

它做了两层缓存：

- Installation Token 缓存在 `sessionStorage` 的 `github_token`
- 私钥 PEM 可选缓存到 `sessionStorage` 的 `p_info`

Installation Token 的续期策略不是“定时器后台刷新”，而是“按需懒刷新”：

- `getTokenFromCache()` 每次取 token 都会检查 `expiresAt`
- 如果 `expiresAt <= Date.now() + 60s`，就认为即将过期，直接清缓存
- 之后 `getAuthToken()` 会重新签 JWT，再重新向 GitHub 申请 Installation Token

也就是说，这个项目采用的是：

- 过期前 60 秒 buffer
- 请求前检查
- 不做固定轮询刷新

这是比定时器更省资源的策略，适合低频操作型 CMS。

但把 Installation Token 缓存在前端，本质上有几类风险：

第一类是 XSS 风险。
只要站点存在任意脚本注入，注入脚本就能直接读取 `sessionStorage` 里的 token。

第二类是本机环境风险。
浏览器扩展、共享电脑、调试台暴露、远程控制都会让 token 泄漏。

第三类是前端“加密缓存”的安全感错觉。
这个项目虽然把 PEM 用 AES-GCM 加密后再放进 `sessionStorage`，但密钥来自 `NEXT_PUBLIC_GITHUB_ENCRYPT_KEY`，它本身也是打包进前端的公开配置。所以这更像“防手滑 / 防明文直读”的轻度保护，而不是可靠的 secret storage。

第四类是权限边界风险。
Installation Token 是短期令牌，风险比长期 PAT 低，但只要它还没过期，攻击者就能以该安装的权限直接操作仓库。

当前项目对 401 的处理也值得看清：

- `src/lib/github-client.ts` 的 `throwGitHubApiError()` 遇到 401 会调用 `handle401Error()`
- `handle401Error()` 会触发 `useAuthStore.getState().clearAuth()`
- `clearAuth()` 会清 `sessionStorage` 里的 token / pem 缓存，并把 `isAuth` 设为 `false`

但是它没有做“自动重试失败请求”。

这意味着，如果一次 Git 操作链路中途因为 token 失效而出现 401，当前实现会：

- 清空缓存
- 抛错结束本次操作
- 需要用户再次触发发布

严格来说，这并不算完整的“无感续期”，只是“下一次重新发起操作时可重新取 token”。

还有一个细节：`clearAuth()` 没有把 Zustand 内存中的 `privateKey` 置空，所以如果用户没刷新页面，理论上下一次仍然可以重新签 JWT；如果用户刷新了页面，而又没有开启 PEM 缓存，那就必须重新导入 `.pem`。

如果面试官追问“Git Commit 操作很长，中途过期怎么办”，你可以诚实回答：

当前项目没有事务级自动重试机制；它假设单次 GitHub API 链路足够短，通常不会跨越 1 小时 token 生命周期。如果真要更稳，应该把整个 GitHub 写链路包成“401 后刷新 token 并重试一次”的幂等包装器，或者直接把签发与提交移到服务端。

---

### 4. 多个编辑操作写仓库时，如果远程仓库有了新的 commit，前端如何处理冲突？是否实现了类似 `git pull --rebase`？

当前项目没有实现类似 `git pull --rebase` 的自动冲突解决。

它的实现逻辑是标准的“读取当前 HEAD -> 基于该 HEAD 生成新 commit -> 尝试快进更新 ref”：

1. `getRef()` 先读取当前分支 HEAD SHA。
2. 用这个 SHA 作为 parent，创建新的 tree 和 commit。
3. `updateRef(..., force = false)` 尝试把分支指向新 commit。

这里的关键点是 `force = false`。
这表示它只接受快进更新，不会强推覆盖别人的提交。

假设有两个并发操作 A 和 B：

- A 和 B 都先读到了同一个旧 HEAD
- A 先成功提交并更新分支
- B 再去 `PATCH git/refs/heads/main`

因为 B 的 commit parent 仍然指向旧 HEAD，它就不是当前分支 tip 的 descendant，GitHub 会拒绝这次更新。当前前端会把这个错误抛出来，用户看到失败 toast。

这套机制的优点是：

- 不会静默覆盖远程新提交
- 不需要做危险的 `force push`

缺点也很直接：

- 没有自动 refetch + rebuild + retry
- 没有冲突提示 UI
- 没有“你和远端都改了哪些文件”的可视化

所以答案应该是：

当前前端的冲突处理策略是“依赖 GitHub 的 non-fast-forward 保护，在 `updateRef` 阶段失败”，并没有实现真正的 `pull --rebase` 或三方合并逻辑。

如果要继续升级，一般有两个方向：

- 简单版：捕获 non-fast-forward 后重新拉最新 HEAD，重新生成索引与 tree，再自动重试一次。
- 复杂版：把 index / category / article file 分别做三方 diff，提供可视化冲突解决。

对这个项目而言，前者更现实，后者明显超出个人博客 CMS 的复杂度预算。

---

### 5. `marked + shiki + katex` 都很重，实时预览如何保证不卡顿？是否做了防抖 / 节流 / Web Worker？

这里也要先纠正一个前提：当前项目并不是“边输入边实时双栏预览”。

它的写作态和预览态是分开的：

- 编辑器在 `src/app/write/components/editor.tsx`
- 预览开关由 `src/app/write/stores/preview-store.ts` 控制
- 用户点击“预览”后，会切到 `WritePreview`
- 编辑器和预览不会同时活跃在一个 split-pane 里

所以这个项目绕开卡顿问题的第一招，不是高阶性能优化，而是交互设计上的“不要在每次键盘输入时都跑 Markdown 渲染”。

当前实现里，打字过程主要只是：

- `textarea` 的 `onChange`
- `updateForm({ md: e.target.value })`
- Zustand 更新本地状态

不会在每个按键上立刻触发 `marked + shiki + katex`。

真正渲染 Markdown 的地方是：

- 文章详情页 `BlogPreview`
- 写作预览页 `WritePreview`
- `useMarkdownRender(markdown)`

`useMarkdownRender()` 的行为是：

- `useEffect` 监听 `markdown`
- 异步调用 `renderMarkdown()`
- 支持 `cancelled` 标记，避免过时结果覆盖新结果

它没有做这些事：

- 没有防抖
- 没有节流
- 没有 Web Worker
- 没有 `requestIdleCallback`
- 没有 `useDeferredValue`
- 没有 `startTransition`

它做过的优化主要有两个：

- `shiki` 和 `katex` 是按需动态导入的，不会首屏就打进所有页面
- 模块导入后有缓存，不会每次渲染都重新加载

所以最准确的回答是：

当前项目不是靠复杂的渲染调度来解决“实时预览性能”，而是靠“预览与编辑分离”的交互设计，从根上避免在高频输入时执行重渲染。

如果后续真要做成实时双栏预览，那么当前实现还不够，比较靠谱的演进顺序应该是：

1. 对 Markdown 文本做防抖或 `useDeferredValue`
2. 把 `marked + katex + shiki` 移进 Web Worker
3. 对大文档做增量渲染或分块高亮

---

### 6. Shiki 是服务端高亮还是客户端高亮？如何优化首屏体积？为什么不换成 `highlight.js` 或 `prism.js`？

当前项目是客户端高亮，不是服务端高亮。

判断依据很直接：

- `renderMarkdown()` 虽然定义在 `src/lib/markdown-renderer.ts`
- 但真正调用它的是 `useMarkdownRender()` 这个 client hook
- `useMarkdownRender()` 在 `useEffect` 中运行

所以高亮发生在浏览器，而不是 Next.js 服务端或构建期。

当前项目对首屏体积的主要优化是“延迟到真正需要渲染 Markdown 时再加载 Shiki”：

- `loadShiki()` 里用 `await import('shiki')`
- 第一次渲染文章 / 预览时才动态加载
- 加载后缓存在模块变量里

这个策略的好处是：

- 首页、配置页、列表页都不用为 Shiki 买单
- 只有博客阅读和预览链路会加载它

但它仍然有几个代价：

- 第一次打开预览或文章页时会有明显的首次高亮成本
- 高亮仍在主线程执行
- 没有裁剪语言包与主题包

为什么没有改成 `highlight.js` 或 `prism.js`？

如果从项目取舍看，Shiki 的优势是：

- 语法高亮效果更接近 VS Code
- token 粒度更准确
- 主题视觉一致性更强

缺点是：

- 包更重
- 启动更慢
- 客户端运行时代价更高

所以当前项目的取舍其实是“渲染质量优先于极致轻量”。

如果是面向更大规模公共流量的博客，比较理想的优化路线不是简单换库，而是：

- 服务端 / 构建期完成 Shiki 高亮
- 客户端只渲染结果 HTML

这样既保留高亮质量，也不会把成本压到读者设备上。

---

### 7. “本地图片发布替换”具体怎么做？粘贴本地图片后是 base64 存稿吗？最终如何落仓库？

当前项目的本地图片处理做法很值得讲，因为它不是最偷懒的 base64 草稿方案。

用户粘贴图片时，`WriteEditor.handlePaste()` 会：

1. 从剪贴板拿到图片 `File`
2. 调用 `write-store.addFiles()`
3. 为每个文件计算 SHA-256 前 16 位哈希
4. 生成 `URL.createObjectURL(file)` 作为本地预览地址
5. 在 Markdown 里插入 `![](local-image:<id>)`

所以草稿阶段并不是把图片内容 base64 写进 Markdown。
草稿里只是一个轻量占位符：`local-image:<id>`。

预览阶段，`useWriteData()` 会把：

- `![](local-image:<id>)`

替换成：

- `![](<object-url>)`

也就是浏览器临时对象 URL，方便本地预览。

真正发布时，`pushBlog()` 才会做上传：

1. 遍历所有本地图片
2. 为每张图生成稳定文件名 `hash + ext`
3. 用 `fileToBase64NoPrefix()` 把图片转 base64
4. 调用 `createBlob()` 上传 Git blob
5. 把 blob 写到 `public/blogs/<slug>/<hash>.<ext>`
6. 把 Markdown 里的 `local-image:<id>` 替换成 `/blogs/<slug>/<hash>.<ext>`

最终图片的存储形式是：

- 仓库普通文件
- 路径在 `public/blogs/<slug>/`
- 通过 Git blob 方式写入

它没有使用：

- Git LFS
- 外部图床
- 直接 base64 落 Markdown

封面图也是同一思路，只不过额外把最终 URL 写入文章 `config.json` 的 `cover` 字段。

这个设计的优点：

- 草稿轻，不会把 Markdown 撑爆
- 图片与文章目录同生命周期，迁移简单
- 哈希命名可以天然去重与缓存友好

缺点：

- 仓库体积会持续增大
- 删除文章时要递归清理目录文件
- 频繁改图会制造大量 git object

---

### 8. 目录抽取是基于 AST 还是正则？嵌套层级如何维护？如何平滑滚动与更新 hash？

当前项目是基于 AST token，而不是正则。

`src/lib/markdown-renderer.ts` 里：

- 先调用 `marked.lexer(markdown)` 得到 token 列表
- 再递归遍历 token
- 抽取 `type === 'heading' && depth <= 3` 的节点

这比正则更稳，因为：

- 不会误把代码块里的 `# title` 当成标题
- 能处理 blockquote、list 等嵌套 token
- 标题文本已经过 marked 语义解析，拿到的是更干净的 text

当前目录数据结构是一个扁平数组，不是真树：

```ts
type TocItem = {
  id: string
  text: string
  level: number
}
```

层级关系靠 `level` 字段表达，渲染时通过：

- `paddingLeft: (level - 1) * 8`

做视觉缩进。

所以准确地说，它维护的是“层级信息”，不是“嵌套树形结构”。

平滑滚动实现也很轻：

- 全局 `html { scroll-behavior: smooth; }`
- 文章标题节点有 `scroll-margin-top: 100px`
- 目录项是普通 `<a href="#id">`

用户点击目录项后，浏览器原生完成：

- 滚动
- 更新 URL hash

当前项目没有自己写 `scrollIntoView({ behavior: 'smooth' })`，也没有自己手动 `history.replaceState()`。

滚动时的“当前章节高亮”则由 `BlogToc` 里的 `IntersectionObserver` 负责：

- 监听各个 heading 是否进入视口
- 维护 `activeIds`
- 高亮当前最靠前的 active heading

需要注意的是：

- 点击目录时 URL hash 会更新，因为用了原生锚点链接
- 但用户纯手动滚动时，当前实现只更新高亮，不会实时改写 hash

如果面试官追问“为什么不用树形 TOC”，你可以回答：

当前博客目录 UI 只需要展示三级以内的缩进列表，扁平数组更简单；只有在需要折叠、局部展开、树形导航联动时，才有必要构建真正的嵌套树。

---

### 9. CSS Variables 动态主题切换是怎么作用到所有组件的？会不会有重绘问题？

这个项目的主题切换并不是把每个组件的颜色当 props 逐层传下去，而是用 CSS Variables 当全局主题总线。

初始化来源有两个：

- `src/config/site-content.json` 提供默认主题值
- `src/app/layout.tsx` 在根 `<html>` 上注入 `--color-brand` 等 CSS 变量

运行时修改则发生在 `src/app/(home)/config-dialog/index.tsx`：

- 配置弹窗编辑 `formData.theme`
- 预览或保存时调用 `updateThemeVariables()`
- 通过 `document.documentElement.style.setProperty('--color-xxx', value)` 改根变量

组件本身大量使用的是基于变量映射出来的样式 token，比如：

- `text-primary`
- `bg-bg`
- `bg-card`
- `bg-brand`

这些 class 最终会读取 CSS 变量，因此主题一改，组件不需要逐个重传 props。

这种方式的好处是：

- 主题变更传播成本低
- 组件几乎不用关心主题状态来源
- 样式与业务状态解耦

至于“是否涉及组件重绘”，答案要分层看：

从 React 角度说，单纯改 CSS 变量不一定触发组件重新渲染，更不会导致整棵组件树 remount。

从浏览器渲染角度说，会有：

- style recalculation
- repaint

但通常不会像“所有组件重新 setState”那样重。

当前项目有一个例外：背景气泡色不是纯 CSS 变量渲染，它还依赖 `siteContent.backgroundColors`。所以在配置预览时，代码还会调用 `regenerateBubbles()`，让背景重新生成一次。

总结成一句话就是：

这个项目主题切换的主要代价是浏览器的样式重算和重绘，不是 React 层面的全面重渲染。

---

### 10. 主题持久化回写仓库写到哪里？读取时从仓库还是 localStorage？冲突时谁优先？

当前项目的主题持久化写入位置非常明确：

- `src/config/site-content.json`
- `src/config/card-styles.json`

对应逻辑在 `src/app/(home)/services/push-site-content.ts`。

保存配置时，它会：

1. 先可选上传 favicon、avatar、背景图、art 图、社交图标
2. 把新的 `siteContent` 序列化成 JSON
3. 把新的 `cardStyles` 序列化成 JSON
4. 通过 Git blob/tree/commit/update ref 写回仓库

所以它不是写某个 `theme.json`，而是把主题纳入整份站点配置文件。

读取时，当前项目并不依赖 `localStorage`。

主题的读取来源是：

- 服务端 / 构建时：`src/app/layout.tsx` 直接 import `site-content.json`
- 客户端运行时：`useConfigStore` 初始化时从同一个 JSON 拷贝

也就是说，项目层面的持久化 source of truth 是仓库里的 JSON，而不是浏览器本地缓存。

当前和主题相关的浏览器本地缓存其实很少：

- PEM / token 用的是 `sessionStorage`
- 图片随机偏移那类与主题无关的东西才用到了 `localStorage`

所以题目里的“localStorage 冲突”在这个项目里基本不存在。

真正存在的不一致窗口是另一个维度：

- 前端点击保存后，仓库已经产生新 commit
- 但 Vercel 还没重建完成
- 当前线上静态资源仍然是旧版本

当前项目对这个问题的处理方式是：

- 先把最新 `siteContent` 写进 Zustand，页面立即呈现新主题
- 同时 push 到仓库
- 等部署完成后，刷新页面，新的构建产物才会永久生效

所以如果问“谁优先”，准确答案是：

- 当前会话内，预览 / 已保存后的即时展示，以内存里的 `config-store` 为准
- 跨会话和部署后的长期真相，以仓库中的 JSON 为准

---

### 11. Zustand 为什么这么分 slice？编辑态和预览态有没有依赖？主题修改算哪个 slice？

严格看当前仓库，相关状态并不只是四个 slice，而是几类 store：

- `useAuthStore`：认证态
- `useWriteStore`：写作编辑态
- `usePreviewStore`：预览开关态
- `useConfigStore`：站点配置态
- `useLayoutEditStore`：首页布局编辑态
- `useSizeStore`：响应式尺寸态

所以面试时不要机械地说“四个 slice”，最好按职责讲。

`编辑态` 和 `预览态` 的关系，当前项目是“弱依赖、强分工”：

- `preview-store` 只管一个布尔值 `isPreview`
- 预览内容本身不放在 `preview-store`
- 预览真正依赖的数据来自 `write-store`
- `WritePreview` 通过 `useWriteData()` 从 `write-store` 组装出 Markdown、标题、日期、图片预览地址

换句话说：

- `preview-store` 负责 UI 模式切换
- `write-store` 负责内容 source of truth

这样设计是合理的，因为“是否正在预览”和“预览内容本身是什么”不是一个维度的问题。

如果用户在预览态修改了主题，这在当前仓库里并不是博客写作预览的一部分。主题配置属于站点配置体系，应当由：

- `config-store`

负责；首页卡片布局变更则由：

- `layout-edit-store` + `config-store`

负责。

判断一个状态应该归哪个 store，最好的标准不是“在哪个页面发生”，而是“谁拥有长期真相”：

- 博客内容长期真相在 `write-store`
- 是否打开预览是真正的临时 UI 状态，放 `preview-store`
- 全站主题和站点配置属于 `config-store`

这正是当前仓库的分层逻辑。

---

### 12. 用 SWR 管理博客索引后，编辑回写仓库怎样更新缓存？直接 `mutate` 还是重请求？GitHub API 延迟怎么办？

当前项目在这件事上其实比较“朴素”，甚至可以说还有改进空间。

博客索引和分类的读取分别是：

- `useBlogIndex()` -> `/blogs/index.json`
- `useCategories()` -> `/blogs/categories.json`

两者都使用了 SWR，但在保存文章、删除文章、更新分类之后，当前代码并没有主动调用：

- `mutate('/blogs/index.json')`
- `mutate('/blogs/categories.json')`

例如：

- `pushBlog()` 负责提交文章和更新 `public/blogs/index.json`
- `saveBlogEdits()` 负责更新 `index.json` 与 `categories.json`

但它们成功之后只是 toast 提示，并没有把 SWR 缓存同步推进到新值。

这意味着当前仓库的真实策略更接近：

```text
提交到 GitHub
-> 等 Vercel 自动部署
-> 用户刷新页面
-> 再重新拉取静态 JSON
```

README 和多个成功提示里都明确写了“请等待页面部署后刷新”，这就是证据。

所以如果面试官问“是 mutate 还是重请求”，对当前项目最诚实的回答是：

- 既没有做乐观 `mutate`
- 也没有在保存后主动 revalidate
- 它依赖“部署完成后手动刷新”的最终一致性

再进一步说，这里的“延迟”主要还不是 GitHub API 本身的延迟，而是：

- 仓库 commit 已经成功
- 但线上站点读取的是部署产物里的静态 JSON
- 在新构建上线之前，前端拉到的还是旧文件

所以真正的瓶颈是部署延迟，不是 GitHub API 读一致性。

如果要优化，推荐的做法是：

1. 本地先乐观更新 SWR 缓存
2. 后台继续提交仓库
3. 保存成功后提示“线上版本等待部署”
4. 部署完成后再做一次静态源 revalidate

但当前仓库确实还没做到这一步。

---

### 13. 如何避免编辑时触发不必要请求？SWR 会不会因为焦点回归或轮询干扰写作？

当前项目在这件事上做得还算克制。

首先，写作页本身不是一个“边写边从服务端拉取很多东西”的页面。
打字过程中核心数据都在 `write-store` 本地状态里，`textarea` 改动不会触发网络请求。

其次，相关 SWR hook 都显式关掉了焦点重验证：

- `useBlogIndex()`：`revalidateOnFocus: false`
- `useCategories()`：`revalidateOnFocus: false`

同时也没有设置轮询：

- 没有 `refreshInterval`
- 没有后台长轮询

所以用户切出窗口再切回来，不会因为 SWR 自动 focus revalidate 把文章列表或分类列表重新拉一遍，从而干扰编辑。

当前可能发生的自动重新请求只有：

- `revalidateOnReconnect: true`

也就是断网后恢复网络时的重验证。

但这个策略对编辑影响很小，因为：

- 写作正文本身不依赖远端数据持续更新
- 分类列表即使重拉也只是一个下拉选项集

再加上当前项目把“编辑态”和“预览态”分开，用户打字时不会同时跑重渲染链路，所以整体请求干扰已经比较少。

总结来说：

- 它避免不必要请求的主要方式不是复杂缓存编排
- 而是尽量把编辑过程做成本地状态操作
- 并显式禁用 SWR 的 focus revalidate

---

### 14. 项目部署在 Vercel。GitHub App 私钥放在哪里？环境变量换行怎么处理？

这一题在当前项目里要先明确回答：GitHub App 私钥不在 Vercel，也不在无服务器函数环境里。

当前仓库的 GitHub App 私钥来自用户本地导入的 `.pem` 文件，随后进入：

- Zustand 内存
- 可选的 `sessionStorage`

也就是说，这个项目压根没有把 PEM 存进：

- Vercel Environment Variables
- Vercel Secrets
- Serverless Function runtime

所以题目里提到的“环境变量换行符问题”，在当前仓库架构下根本不会出现。

当前 Vercel 上真正用到的环境变量，主要是这些公开配置：

- `NEXT_PUBLIC_GITHUB_OWNER`
- `NEXT_PUBLIC_GITHUB_REPO`
- `NEXT_PUBLIC_GITHUB_BRANCH`
- `NEXT_PUBLIC_GITHUB_APP_ID`
- `NEXT_PUBLIC_GITHUB_ENCRYPT_KEY`

注意最后一个也是 `NEXT_PUBLIC_`，说明它并不是后端 secret，只是前端加密缓存用的字符串。

如果面试官追问“那为什么不把 PEM 放服务端”，你可以回答：

当前项目选择了零后端代签架构，代价就是把 GitHub App 私钥暴露给浏览器使用；这降低了部署复杂度，但也降低了安全上限。

如果以后改成服务端签发模式，那时才会涉及：

- PEM 放进 Vercel secret / env
- 读取后 `replace(/\\n/g, '\n')`
- 或者直接 base64 存储后启动时再解码

但这属于“更安全的改造方案”，不是当前仓库事实。

---

### 15. 每次编辑都会产生 Git commit。Commit Message 怎么组织？会影响 Vercel 自动部署吗？一天改 100 次会怎样？

当前项目的 commit message 组织是“按业务动作命名”，比较直白：

- 新建文章：`新增文章: <slug>`
- 更新文章：`更新文章: <slug>`
- 删除文章：`删除文章: <slug>`
- 更新站点配置：`更新站点配置`
- 更新分享列表：`更新分享列表`
- 更新项目列表：`更新项目列表`
- 更新关于页面：`更新关于页面`

这种命名的优点是：

- 容易从 git log 反查业务动作
- 对个人博客足够直观

它不会直接影响 SEO。
SEO 看的是页面内容、元信息、可索引性和部署后的页面状态，不看 commit message 文案。

但它会影响部署频率。

因为这个项目是：

```text
前端 -> GitHub API -> push 到目标仓库分支 -> Vercel 因仓库更新触发部署
```

README 里已经明确提醒：

- 保存成功后要等待部署完成再刷新

这就说明当前 Vercel 自动部署是完全参与这条链路的。

所以如果用户一天改 100 次草稿，理论上就可能产生：

- 100 次 commit
- 100 次部署触发或 100 条部署队列

当前项目没有做这些缓冲策略：

- 没有草稿分支
- 没有批量合并提交
- 没有构建去抖
- 没有 commit squash 队列
- 没有“只在点击正式发布时才 push”

因此它更适合“中低频内容编辑”，不适合“像 Notion 一样每敲几个字就自动保存并实时上线”。

如果面试时要主动指出改进空间，可以提三个方向：

- 引入 draft 模式，只本地存或只存草稿分支
- 把多次编辑聚合成一次发布
- 改成运行时内容源 + ISR，减少每次写仓库都触发全站重建

---

## 第二部分：技术八股文延伸问题

### 1. SSR vs SSG vs ISR：这个项目的博客详情页更适合哪种？用户提交新文章后如何不重建更新静态内容？

先说当前仓库的事实：它现在的博客详情页既不是 SSR，也不是 SSG / ISR，而是 CSR。

证据在 `src/app/blog/[id]/page.tsx`：

- 这是一个 client component
- 页面通过 `useEffect()` 调 `loadBlog(slug)`
- `loadBlog()` 再去 `fetch('/blogs/<slug>/config.json')` 和 `fetch('/blogs/<slug>/index.md')`

所以当前详情页是在浏览器里拉静态文件，然后客户端渲染文章。

如果从“数字花园 / 博客详情页”的产品属性看，更合适的通常是：

- 优先 SSG
- 其次 ISR

原因很简单：

- 内容型页面对 SEO 敏感
- 内容更新频率通常低于交易型系统
- 页面结构相对稳定

如果保留当前“仓库文件 + 部署静态站点”的架构，SSG 很自然：

- push 到仓库
- Vercel rebuild
- 产出新的静态页面或静态资源

这也是当前项目实际走的思路，只不过它没有把文章详情做成真正的 build-time page generation，而是“静态资源 + 客户端 fetch”。

如果想做到“用户通过 GitHub App 提交新文章后，不重新构建也更新静态内容”，要先看清一个关键约束：

当前文章源文件放在当前部署产物的 `public/` 里。

这意味着：

- 新文章 push 到 GitHub 仓库，不会自动进入已经部署好的那个 Vercel 实例文件系统
- 即使你在 Next.js 里调 `revalidatePath()`，它也不能让已经构建好的 `public/blogs/*.md` 凭空变成新内容

所以在当前架构下，“不重建直接更新静态内容”其实做不到。

要实现这件事，必须至少改掉一个前提：

方案一：
把内容源从“当前部署产物里的 `public/` 文件”改成“服务端运行时去 GitHub API / Raw URL / 对象存储读取内容”，然后配合 ISR 或 `revalidateTag`。

方案二：
增加服务端 webhook / route handler，在 GitHub App 写入成功后触发 on-demand revalidation，并且页面数据源必须是服务端运行时可读取的新内容。

所以这题最好的回答不是“ISR 就行”，而是：

ISR 能解决缓存更新问题，但前提是页面的数据源必须是部署后还能变化的运行时内容源；而当前仓库把文章内容放在 `public/` 并打进部署产物，因此实际仍依赖重新部署。

---

### 2. `marked` 解析出 HTML 后用 `dangerouslySetInnerHTML` 渲染，会导致整个组件树重新挂载吗？性能隐患是什么？如何配合 `React.memo`？

先纠正前提：当前项目并没有用 `dangerouslySetInnerHTML` 来渲染 Markdown。

仓库里唯一明确的 `dangerouslySetInnerHTML` 出现在 `src/app/layout.tsx`，那是为了插入一段判断 Windows 的脚本，不是文章渲染链路。

Markdown 渲染链路实际是：

```text
Markdown
-> marked 生成 HTML 字符串
-> html-react-parser 把 HTML 解析成 ReactElement
-> 把 img 替换成 MarkdownImage
-> 把 pre/code 替换成 CodeBlock
-> 渲染到 <div className="prose">{content}</div>
```

这意味着它不是“直接 innerHTML 注入”，而是“先转字符串，再转 React 树”。

当 Markdown 内容变化时，会发生什么？

- `useMarkdownRender()` 重新跑 `renderMarkdown()`
- 得到新的 HTML 和新的 ReactElement
- `content` state 更新
- `.prose` 下面那棵文章子树重新参与 diff

这不会导致整个应用根树重新挂载，但文章内容子树会被整体重建出一套新的元素对象，代码块和图片节点也可能发生 remount。

性能隐患主要有三个：

第一，主线程计算重。
`marked + shiki + katex + html-react-parser` 都在浏览器线程上。

第二，Markdown 内容一变，文章子树基本整段重建。
这对大文档和大量代码块不友好。

第三，当前没有做 HTML sanitize。
如果 Markdown 来源不可信，就有 XSS 风险。
这个项目默认场景是“自己写自己的博客”，所以风险相对可接受，但架构上确实要知道这个问题存在。

如果要谈 `React.memo`，要讲清楚边界：

- `React.memo` 可以避免外围组件因为无关 props 变化而重渲染
- 但只要 `markdown` 变了，文章渲染组件本身还是要重算

因此 `React.memo` 更适合包这些外围部分：

- 侧边栏
- 封面区
- 摘要区
- 目录区

而不是幻想它能避免 Markdown 主体重渲染。

这个场景更有效的优化手段通常是：

- 把 Markdown 预览隔离成单独组件
- 对输入值做 `useDeferredValue`
- 对渲染结果做缓存
- 把高亮与数学公式处理移到 Worker 或服务端

---

### 3. 从 GitHub API 获取的数据是 `any` / `unknown` 时，如何做类型收窄？如果结构不符，应用会崩吗？

当前仓库的做法属于“轻量收窄 + 兜底容错”，不是严格 schema validation。

比较明显的类型收窄例子有：

- `useCategories()` 里用 `Array.isArray()` 判断返回值
- 用 `(item): item is string => typeof item === 'string'` 过滤分类项
- `useBlogIndex()` 里如果 JSON 不是数组，直接返回空数组
- `loadBlog()` 里 `config.json` 解析失败时回退为 `{}`，而不是直接抛错

也就是说，当前项目确实在做一些运行时收窄，但主要是最轻的那种：

- `Array.isArray`
- `typeof`
- `try/catch + 默认值`

它没有引入：

- Zod
- io-ts
- Valibot
- 自定义完整 schema validator

所以如果 GitHub API 返回结构完全不符合预期，当前应用通常有三种结果：

- 某些地方退化成空数组或空对象，不至于直接崩
- 某些地方会走默认值，比如文章配置缺失时标题回退到 slug
- 但如果数组项内部字段严重缺失，比如 `slug`、`date` 都不对，后续页面逻辑仍可能出现错误链接、分组异常甚至运行时问题

为什么当前仓库还能“勉强够用”？

- 因为这些 JSON 文件大多不是外部第三方 API 随机返回的
- 而是这个项目自己写入、自己读取
- 数据生产者和消费者是同一套代码

所以它更多是在做“脏数据容忍”，而不是“强 schema 防御”。

如果以后这个项目要接入外部内容源，或者允许多人通过不同工具写入仓库，最好把：

- `public/blogs/index.json`
- `public/blogs/categories.json`
- 各类 `list.json`

在进入 store 之前都先用 runtime schema 过一遍。

---

### 4. GitHub App 的 Installation Token 和 OAuth Access Token 有什么本质区别？为什么这个场景更适合 GitHub App？

这一题非常适合结合当前项目来讲。

本质区别有三个层面。

第一层是“代表谁”不同。

- OAuth Access Token 代表某个用户
- GitHub App Installation Token 代表某个 app installation

在当前项目里，文章提交、站点配置更新、批量删文，本质上都是“一个内容机器人对仓库执行操作”，而不是“读取某个用户社交身份信息”。所以 installation token 的语义更贴切。

第二层是权限模型不同。

- OAuth 常用的是 scope，通常比较粗，比如 `repo`
- GitHub App 是 repository-scoped + permission-scoped 的细粒度模型

当前项目只需要一个仓库的内容读写，不需要“代表用户访问他所有能访问的仓库”。GitHub App 可以只安装到目标仓库，权限也只开需要的 `Contents` 写权限，这比 OAuth 更小权限。

第三层是生命周期不同。

- OAuth token 往往比较长寿，直到用户撤销
- Installation Token 默认短期有效，当前 GitHub 文档明确写的是 1 小时

这对当前前端直连 GitHub 的架构尤其重要。因为一旦 token 泄漏，短期令牌至少能缩短风险暴露窗口。

为什么这个项目更适合 GitHub App，而不是 OAuth？

因为它的业务目标是：

- 操作固定仓库
- 权限尽量小
- 可以像 bot 一样独立于某个具体用户持续工作

这几条都和 GitHub App 更匹配。

如果换成 OAuth，你会碰到几个问题：

- 权限太粗
- token 更像“某个用户的钥匙”
- 用户离开组织、权限变动时集成更脆弱
- 很难优雅地做到“只授权这个仓库”

所以这题最好用一句话收尾：

当前项目不是在做“用户身份登录”，而是在做“仓库内容机器人写入”，因此 GitHub App 比 OAuth 更符合权限模型和自动化语义。

---

### 5. 实时预览里的大量同步计算会阻塞 UI 吗？如何用 `setTimeout` 或 `requestIdleCallback` 分片？

从 JavaScript 运行机制看，答案是会。

如果你在 `onChange` 里同步执行：

- Markdown 解析
- 代码高亮
- 数学公式渲染
- HTML 转 React 树

这些都跑在主线程，会直接占满 event loop 当前 task，浏览器就没法及时：

- repaint
- 响应输入
- 执行动画帧

于是用户看到的就是输入掉帧、卡顿、光标延迟。

但回到当前仓库，它没有真的这么做。

当前项目规避这个问题的方式不是分片，而是交互上根本不把重渲染放进高频输入链路。编辑时只更新本地 store，真正渲染发生在单独的预览态。

如果未来想把它做成真正的“边输边看”，可以这样回答优化方案：

第一层，低成本方案：

- 用 `setTimeout(0)` 或 `queueMicrotask` 之后的宏任务分阶段处理
- 例如先 parse Markdown，再下一轮任务做 highlight，再下一轮做 React parse

这样做的本质是“给浏览器插空机会”，不是降低总计算量。

第二层，更适合预览的方案：

- 用 `requestIdleCallback` 在空闲时更新低优先级预览

这样可以保证输入响应优先，但空闲时间不稳定，不能保证强实时。

第三层，更现代的 React 方案：

- `useDeferredValue`
- `startTransition`

让输入值优先更新，预览晚一点跟上。

第四层，真正有用的大招：

- 把 `marked + shiki + katex` 放进 Web Worker

因为前面几种方法都只是“切时间片”，Worker 才是“换线程”。

所以如果面试官问“该怎么设计”，你可以说：

当前项目靠交互避开了这个问题；如果升级到实时预览，Worker 才是最终形态，`setTimeout` 和 `requestIdleCallback` 只是过渡优化。

---

### 6. 前端直接调用 `api.github.com` 为什么没跨域问题？如果要做 Vercel 代理，方案是什么？

当前项目前端直接调用 `https://api.github.com`，一般不会遇到浏览器跨域拦截，原因不是“浏览器特殊放行”，而是 GitHub REST API 本身支持 CORS。

GitHub 官方文档明确说明：

- REST API 支持来自任意来源的 AJAX 跨域请求
- `api.github.com` 会返回 `Access-Control-Allow-Origin: *`
- 预检请求也允许 `Authorization`、`Content-Type` 等请求头

所以这个项目才能在浏览器里直接带 `Authorization: Bearer <token>` 去请求 GitHub。

当前仓库没有实现 Vercel 代理层，也没有 `app/api/github/.../route.ts` 之类的中转接口。

如果以后要做 Vercel 代理，通常会有两个目的：

- 把 GitHub App 私钥留在服务端，不再交给浏览器
- 统一处理重试、限流、日志、错误屏蔽

一种比较标准的实现是：

1. 新建 `src/app/api/github/[...path]/route.ts`
2. 前端只请求自己的 `/api/github/...`
3. Route Handler 里从 Vercel env 读取 GitHub App 私钥
4. 服务端生成 JWT、换 Installation Token
5. 再由服务端转发到 `https://api.github.com/...`
6. 把结果回给前端

这样可以把：

- JWT 签发
- token 续期
- 401 重试
- 幂等提交

都收敛到服务端。

对于当前仓库来说，这会显著提高安全性，但也会改变它“纯前端可部署”的核心特色。

---

### 7. GitHub App JWT 的 `iat`、`exp`、`alg` 怎么设？JWT 不加密，私钥签名到底保证了什么？

当前仓库的 JWT 签发逻辑在 `src/lib/github-client.ts` 的 `signAppJwt()`：

- `alg: 'RS256'`
- `iat: now - 60`
- `exp: now + 8 * 60`
- `iss: appId`

这个设置和 GitHub 官方建议基本一致。

为什么这样设？

`iat`
设成过去 60 秒，是为了容忍客户端与 GitHub 服务器之间的时钟偏差。

`exp`
GitHub 官方要求 JWT 的过期时间不能超过未来 10 分钟。当前项目取 8 分钟，是比较稳妥的做法。

`alg`
GitHub App JWT 要求使用 `RS256`。

而 Installation Token 的生命周期则是另一层：

- JWT 只用于 app 身份认证和换 token
- Installation Token 换出来后通常有效 1 小时

JWT 不加密，这一点很多人会混淆。

JWT 默认只是：

- base64url 编码 header
- base64url 编码 payload
- 再加上签名

所以任何拿到 JWT 字符串的人都能读出 payload 里的：

- `iat`
- `exp`
- `iss`

但他不能伪造一个新的合法 JWT，因为没有私钥。

私钥签名保证的是两件事：

1. 证明这个 JWT 确实由持有 GitHub App 私钥的一方签发
2. 保证 header / payload 没被篡改

它不保证“内容保密”，只保证“来源可信、内容未改”。

保密性主要依赖：

- HTTPS 传输
- 私钥不泄漏
- JWT 生命周期很短

这也是为什么当前项目把私钥放浏览器里，本质上仍然是安全短板。

---

### 8. 通过 GitHub API 创建 commit 时，修改一篇文章是生成新 blob 还是修改原有 blob？为什么 Git 把内容和文件名分开存？

答案是：生成新的 blob，不会原地修改旧 blob。

Git 的对象模型是不可变的内容寻址存储。

在当前项目的 `pushBlog()` 里，你能直接看到这条链路：

1. 为图片、`index.md`、`config.json`、`index.json` 分别 `createBlob()`
2. 把这些 blob 组装进 `createTree()`
3. 用 tree SHA 调 `createCommit()`
4. 最后 `updateRef()` 把分支头指向新 commit

这正是 Git 底层的：

```text
blob -> tree -> commit -> ref
```

当你修改一篇文章时，真正发生的是：

- 修改过的文件内容生成新 blob
- 对应目录及其父目录生成新 tree
- 生成一个新 commit
- 分支 ref 指向新 commit

旧 blob 仍然存在于对象库里，因为 Git 对象是不可变的。

为什么 Git 要把“内容”和“文件名 / 路径”分开？

因为 blob 只关心“字节内容”，tree 才关心“目录结构 + 文件名 + mode + 指向哪个 blob”。

这样设计的好处很大：

- 相同内容可以被多个路径复用
- rename 不需要重写同一份内容 blob
- 没改过的文件和子树可以直接复用旧对象
- commit 本质上就是一个目录快照指针，而不是逐文件 patch 列表

对这个项目来说，这种模型特别合适，因为它经常一次提交多个文件：

- 新文章正文
- 新文章配置
- 新文章图片
- 总索引文件

它并不是“更新数据库的一行记录”，而是在构造一个新的仓库快照。

---

## 面试时值得主动指出的 5 个项目局限

如果你想让回答更像“真的看懂代码的人”，而不是背答案的人，建议主动补充这 5 点：

1. 当前认证发生在浏览器里，`.pem` 私钥进入前端，这是明显的安全换便利取舍。

2. 当前博客详情页实际上是 CSR，而不是最适合 SEO 的 SSG / ISR。

3. 写完内容后没有主动 `mutate` SWR，很多页面一致性依赖“等部署完成后刷新”。

4. 冲突处理只做到 non-fast-forward 失败保护，没有自动 rebase / retry。

5. 主题和文章内容很多都写进仓库并触发重建，因此高频编辑时部署成本会放大。

你主动指出这些局限，通常比一味夸项目“很完整”更能体现工程判断力。

---

## 附录：关键源码定位

- GitHub App 认证与缓存
  - `src/lib/auth.ts`
  - `src/lib/github-client.ts`
  - `src/hooks/use-auth.ts`

- 博客写作与发布
  - `src/app/write/stores/write-store.ts`
  - `src/app/write/components/editor.tsx`
  - `src/app/write/hooks/use-publish.ts`
  - `src/app/write/services/push-blog.ts`
  - `src/app/write/services/delete-blog.ts`

- Markdown 渲染
  - `src/lib/markdown-renderer.ts`
  - `src/hooks/use-markdown-render.tsx`
  - `src/components/blog-preview.tsx`
  - `src/components/blog-toc.tsx`

- 站点主题与配置
  - `src/app/(home)/stores/config-store.ts`
  - `src/app/(home)/config-dialog/index.tsx`
  - `src/app/(home)/services/push-site-content.ts`
  - `src/config/site-content.json`
  - `src/styles/theme.css`

- 博客索引与缓存
  - `src/hooks/use-blog-index.ts`
  - `src/hooks/use-categories.ts`
  - `src/lib/blog-index.ts`
  - `src/app/blog/services/save-blog-edits.ts`

---

## 附录：相关官方资料

这些资料不是这个仓库代码的一部分，但用来回答 GitHub App / OAuth / CORS / Git 底层问题很有帮助：

- GitHub Docs: Generating a JSON Web Token (JWT) for a GitHub App
  - https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app

- GitHub Docs: Authenticating as a GitHub App installation
  - https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation

- GitHub Docs: Differences between GitHub Apps and OAuth apps
  - https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps

- GitHub Docs: Using CORS and JSONP to make cross-origin requests
  - https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests

- GitHub Docs: REST API endpoints for Git database
  - https://docs.github.com/en/rest/git
