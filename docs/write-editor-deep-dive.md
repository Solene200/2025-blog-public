# 写作编辑器深度拆解

这份文档只分析本项目的写作/编辑链路，也就是：

- `/write`
- `/write/[slug]`
- 预览渲染
- Markdown 导入
- GitHub 提交发布

我会把“代码里已经实现的事实”和“基于实现推断出来的问题/改进点”分开写清楚。

## 1. 整体结论

这个项目的写作器不是富文本编辑器，也不是 ProseMirror / TipTap 这一类结构化编辑器。它本质上是：

1. 一个受控 `textarea` 作为 Markdown 原始输入区
2. 一个 Zustand store 维护写作状态
3. 一个预览态复用正式博客渲染组件
4. 一个前端直连 GitHub API 的发布器

核心相关文件：

- `src/app/write/components/editor.tsx`
- `src/app/write/stores/write-store.ts`
- `src/app/write/components/actions.tsx`
- `src/app/write/hooks/use-publish.ts`
- `src/app/write/services/push-blog.ts`
- `src/components/blog-preview.tsx`
- `src/hooks/use-markdown-render.tsx`
- `src/lib/markdown-renderer.ts`

## 2. 编辑器页面是怎么组成的

### 2.1 新建页和编辑页

新建页是 `src/app/write/page.tsx`，编辑已有文章是 `src/app/write/[slug]/page.tsx`。

两者结构基本一致：

- 左边 `WriteEditor`
- 右边 `WriteSidebar`
- 右上角 `WriteActions`
- 如果切到预览态，就不再显示编辑区，而是显示 `WritePreview`

预览开关不靠路由切换，而是靠一个单独的 Zustand store：

- `src/app/write/stores/preview-store.ts`

这个 store 只有一个布尔值 `isPreview`，点击“预览”时把它置为 `true`，点击“关闭预览”时恢复为 `false`。

### 2.2 写作主状态放在哪里

写作器的主状态都在 `src/app/write/stores/write-store.ts`：

- `mode`：`create` 或 `edit`
- `originalSlug`：编辑模式下原始 slug
- `form`：正文和元数据
- `images`：正文图片池
- `cover`：封面图
- `loading`：发布或加载中

`form` 结构见 `src/app/write/types.ts`：

- `slug`
- `title`
- `md`
- `tags`
- `date`
- `summary`
- `hidden`
- `category`

也就是说，这个编辑器并没有把 Markdown 拆成 AST 级别状态，而是直接把全文作为一个字符串 `form.md` 放在 store 里。

## 3. slug 的作用到底是什么

很多人会把 slug 只理解成“文章 URL”，但在这个项目里它的作用更大。

### 3.1 它决定文章存储路径

发布时，`pushBlog()` 会把文章写到：

`public/blogs/${form.slug}`

也就是：

- `public/blogs/<slug>/index.md`
- `public/blogs/<slug>/config.json`
- `public/blogs/<slug>/<hash>.<ext>`（文章图片和封面图）

对应代码在 `src/app/write/services/push-blog.ts`。

### 3.2 它决定文章访问路径

博客详情页路由是 `/blog/[id]`，实际读取的是：

- `/blogs/${slug}/config.json`
- `/blogs/${slug}/index.md`

对应加载逻辑在 `src/lib/load-blog.ts` 和 `src/app/blog/[id]/page.tsx`。

所以 slug 同时决定：

- Git 仓库里的目录名
- 前端读取文章内容时的静态资源路径
- 博客详情页 URL

### 3.3 它是博客索引里的主键

发布时会更新 `public/blogs/index.json`。`prepareBlogsIndex()` 会把现有列表读出来，按 `slug` 做 `Map` 合并，再重新排序。

这意味着：

- 同 slug 会覆盖索引项
- 不同 slug 会新增索引项

对应代码在 `src/lib/blog-index.ts`。

### 3.4 它也参与点赞键

正式文章页和编辑预览页都会把 slug 传给 `LikeButton`。`LikeButton` 又会拼上 `BLOG_SLUG_KEY` 作为点赞接口的键。

对应文件：

- `src/components/blog-sidebar.tsx`
- `src/components/like-button.tsx`

### 3.5 当前 slug 约束存在什么问题

当前实现里，slug 很重要，但校验其实很弱。

代码事实：

- 只要求“非空”，发布时 `pushBlog()` 会检查 `if (!form.slug) throw`
- 编辑模式下不允许改 slug；如果改了，发布时报错
- 没有前端格式校验
- 没有唯一性预检查
- 没有自动规范化，例如转小写、去空格、去非法字符

这会带来几个问题：

1. 编辑模式里，slug 输入框依然可编辑，但真正发布时又禁止修改。这是明显的 UX 不一致。
2. 新建模式下，如果输入了一个已经存在的 slug，本质上会把那篇文章的 `index.md`、`config.json` 和索引项覆盖掉，行为更像“更新”，不是“新增”。
3. slug 如果包含奇怪字符，虽然部分路径会 `encodeURIComponent`，但仓库目录名、图片路径、外链显示、SEO 可读性都会变差。

## 4. 编辑已有文章时，数据怎么回填

编辑模式入口是 `/write/[slug]`。

### 4.1 加载方式

`src/app/write/hooks/use-load-blog.ts` 会在页面加载时调用 `loadBlogForEdit(slug)`。

`loadBlogForEdit()` 做了这些事：

1. 调 `loadBlog(slug)` 拉取当前站点里的静态文章文件
2. 把 `config.json` 和 `index.md` 回填到 store
3. 扫描正文里的 Markdown 图片语法 `![](...)`
4. 把正文里的远程/已发布图片回填到 `images`
5. 把 `config.cover` 回填到 `cover`
6. 把 `mode` 设为 `edit`
7. 把 `originalSlug` 设为原 slug

### 4.2 一个重要现实

编辑页读取的不是 GitHub API 上的“仓库最新内容”，而是当前站点已经能访问到的静态资源：

- `/blogs/<slug>/config.json`
- `/blogs/<slug>/index.md`

这意味着：

- 如果 GitHub 刚刚有新 commit，但部署平台还没完成重新构建
- 编辑页看到的仍然是旧内容

也就是说，“发布成功”和“站点已经能重新读到新内容”不是同一时刻。

## 5. 编辑器本体有哪些功能，分别怎么实现

### 5.1 核心编辑器其实就是一个 `textarea`

`src/app/write/components/editor.tsx` 中真正的编辑区是：

- 一个标题输入框
- 一个 slug 输入框
- 一个 `textarea`

没有工具栏，也没有块级 schema。

### 5.2 文本快捷键

编辑器支持的快捷键实现都在 `handleKeyDown()` 里：

- `Ctrl/Cmd + B`：插入或移除 `**bold**`
- `Ctrl/Cmd + I`：插入或移除 `*italic*`
- `Ctrl/Cmd + K`：插入 `[text](url)`
- `Tab`：插入制表符
- `Shift + Tab`：尝试给当前行反缩进

它用 `document.execCommand('insertText')` 来插入文本，目的不是追求现代 API，而是尽量保住浏览器原生撤销/重做栈。

### 5.3 粘贴图片

`handlePaste()` 会读取剪贴板项：

1. 找出 MIME type 以 `image/` 开头的项
2. 转成 `File`
3. 调 `addFiles()`
4. 为返回的每张图片插入 Markdown 占位符

占位形式是：

- 远程图：`![](https://...)`
- 本地图：`![](local-image:<id>)`

这里的 `local-image:<id>` 不会直接发布到线上，它只是编辑态和预览态里的临时引用。

### 5.4 图片管理区

右侧 `ImagesSection` 提供两种图片进入方式：

- 输入 URL 添加远程图
- 选择/拖拽本地图片文件

这部分做了几件事：

1. 本地图片会先做 SHA-256 哈希，取前 16 位十六进制作为短哈希
2. 同一批和历史池中重复图片会去重
3. 本地图会生成 `URL.createObjectURL(file)` 用于本地预览
4. 每个图片卡片支持拖拽，把对应 Markdown 片段拖回正文

对应实现主要在：

- `src/app/write/stores/write-store.ts`
- `src/app/write/components/sections/images-section.tsx`
- `src/lib/file-utils.ts`

### 5.5 封面图

`CoverSection` 支持两种设封面方式：

- 从图片池拖一张图到封面区域
- 直接上传/拖入一个本地图片文件

封面本身也是 `ImageItem`，只是额外保存到 `cover` 字段中。

### 5.6 元信息

`MetaSection` 提供：

- 摘要
- 标签
- 分类
- 日期时间
- 隐藏开关

其中：

- 标签是自定义输入组件 `TagInput`
- 分类是从 `/blogs/categories.json` 读取的，但只在 `siteContent.enableCategories` 为真时显示
- `hidden` 最终会写进 `config.json` 和 `index.json`

注意，`hidden` 并不是“后端鉴权隐藏”，它只是在前端列表页里，当未认证用户访问时从索引中过滤掉。对应逻辑在 `src/hooks/use-blog-index.ts`。

## 6. 预览态是怎么实现的

### 6.1 不是新页面，而是同页切换

点击“预览”时，`WriteActions` 调用 `openPreview()`，把 `preview-store` 里的 `isPreview` 设为 `true`。

然后：

- `/write/page.tsx`
- `/write/[slug]/page.tsx`

都会根据 `isPreview` 决定渲染编辑页还是 `WritePreview`。

### 6.2 预览前会先替换本地图片占位符

`WritePreview` 自己不做替换，它调用 `useWriteData()`。

`useWriteData()` 会把 `form.md` 里的：

`(local-image:<id>)`

替换成：

`(blob:浏览器对象URL)`

这样预览态里的 Markdown 图片就能直接显示本地未上传图片。

### 6.3 预览复用了正式博客展示组件

`WritePreview` 最终渲染的是 `BlogPreview`，不是另写一套预览模板。

这意味着预览态和正式文章页在这些方面几乎一致：

- 标题、日期、标签布局
- Markdown 渲染逻辑
- 右侧摘要卡
- 右侧目录
- 右侧点赞按钮
- 右侧回到顶部按钮

这是优点，因为“所见即所得”比较接近线上效果；但也带来一些副作用，后面会单独说。

## 7. 右边目录抽取是怎么实现的

先说“这是什么功能”。

目录自动抽取的作用不是单纯把标题列出来，而是让一篇长文具备这几个能力：

- 自动生成文章结构导航
- 点击目录项可以跳到对应标题
- 滚动正文时，右侧目录自动高亮当前位置

也就是说，它解决的是“长文可导航性”问题。

### 7.1 目录数据不是从 DOM 反查，而是 Markdown 解析阶段顺手提取

核心逻辑在 `src/lib/markdown-renderer.ts`。

它先做：

1. `marked.lexer(markdown)` 得到 token 列表
2. 递归遍历 token
3. 找出所有 `heading` 类型并且 `depth <= 3`
4. 用 `slugify(text)` 生成锚点 id
5. 生成 `toc: { id, text, level }[]`

所以当前目录只收：

- `h1`
- `h2`
- `h3`

不会收 `h4` 及以下。

### 7.2 标题锚点怎么挂到 HTML 上

同一个 `renderer.heading` 会把标题渲染成：

`<h${depth} id="${id}">...</h${depth}>`

这样目录项的 `href="#id"` 才能跳过去。

### 7.3 目录高亮怎么做

`src/components/blog-toc.tsx` 为每个目录项对应的标题 DOM 节点创建 `IntersectionObserver`。

大致流程：

1. `document.getElementById(item.id)` 找到标题
2. 对每个标题单独创建 observer
3. 标题进入视口时把 id 加进 `activeIds`
4. 标题离开视口时把 id 移出
5. 按 TOC 原始顺序取当前最靠前的一个 id，作为高亮项

### 7.4 当前目录实现的问题

最明显的问题是标题 id 不做去重。

`slugify()` 只是做：

- 转小写
- 去掉特殊字符
- 空格转连字符

但不会给重复标题追加 `-2`、`-3` 这种后缀。

所以如果文章里有两个同名二级标题：

- HTML 会出现重复 id
- `document.getElementById()` 只会拿到第一个
- 后面的标题目录定位和高亮会出问题

## 8. Markdown 渲染器到底支持什么

预览态和正式文章页用的是同一套渲染链：

`BlogPreview -> useMarkdownRender -> renderMarkdown`

这一段里最关键的三个依赖分别是：

- `marked`：把 Markdown 解析成 token，再渲染成 HTML
- `shiki`：把代码块渲染成带语法高亮的 HTML
- `katex`：把数学公式渲染成可显示的 HTML

如果把它们各自的职责说白一点：

- `marked` 是主渲染器
- `shiki` 是代码块增强器
- `katex` 是数学公式增强器

### 8.1 解析与渲染流程

1. `marked` 先把 Markdown 词法化/语法化
2. 自定义 `renderer` 处理标题、代码块、任务列表等
3. `shiki` 给代码块做高亮
4. `katex` 渲染数学公式
5. 把 HTML 字符串交给 `html-react-parser`
6. 在 parse 阶段把 `<img>` 替换成 `MarkdownImage`
7. 把代码块占位符替换成 `CodeBlock`

### 8.1.1 `marked` 是干什么的，怎么接进来的

`marked` 是整个 Markdown 渲染链的入口。

它负责两件大事：

1. 把原始 Markdown 文本切成 token
2. 把 token 按自定义规则渲染成 HTML

当前项目对 `marked` 做了几类自定义：

- `renderer.heading`：给标题挂 `id`，为目录跳转服务
- `renderer.code`：接住代码块，塞入高亮后的 HTML 和复制用原文
- `renderer.listitem`：对任务列表做自定义渲染
- `marked.use({ extensions: [...] })`：扩展数学公式解析规则

也就是说，`marked` 不只是“默认 Markdown 转 HTML”，而是这个项目里所有后续能力的基础入口。

### 8.1.2 `shiki` 代码高亮是什么，怎么实现的

代码高亮的功能就是：

- 把 Markdown 里的代码块按语言着色
- 提升文章里代码示例的可读性

例如这类代码块：

```md
```ts
const x = 1
```
```

在当前项目里，`shiki` 的接入方式不是“最后整体扫 HTML”，而是在 token 阶段提前处理代码块。

实际流程大概是：

1. `marked.lexer(markdown)` 先拿到 token 列表
2. 遍历所有 `code` token
3. 取出 `token.text` 和 `token.lang`
4. 调 `shiki.codeToHtml(originalCode, { lang, theme: 'one-light' })`
5. 把返回的高亮 HTML 存到 `codeBlockMap`
6. 用形如 `__SHIKI_CODE_0__` 的占位键替换原 token 文本
7. `renderer.code` 再根据这个占位键，从 `codeBlockMap` 里取回高亮结果，输出为：

`<pre data-code="原始代码">高亮后的 HTML</pre>`

这里有两个很关键的实现细节。

第一，为什么还要保留 `data-code`？

因为高亮后的 HTML 已经不是原始纯文本了，复制代码时不能从彩色 HTML 反推原文。于是项目把原始代码转义后挂在 `data-code` 上，再在 React 层交给 `CodeBlock` 组件做“一键复制”。

第二，为什么要先做占位，再交给 `html-react-parser`？

因为后面还要把 HTML 字符串转成 React 节点。如果直接把整段 `<pre>` 当普通节点处理，不方便额外套复制按钮。所以 `useMarkdownRender()` 会先把 `<pre data-code="...">...</pre>` 替换成 `__CODE_BLOCK_n__` 这类文本占位符，等 HTML 解析完后，再把这些占位符替换成：

- 一个真正的高亮代码块节点
- 外层再包上 `CodeBlock`
- 右上角加复制按钮

如果 `shiki` 加载失败，项目也不会整个渲染崩掉，而是退化成普通 `<pre><code>` 的代码块显示。

### 8.1.3 `katex` 数学公式是什么，怎么实现的

数学公式支持的作用是：

- 在文章中直接写数学表达式
- 不需要截图贴公式图

当前项目支持两种写法：

- 行内公式：`$...$`
- 块级公式：`$$...$$`

这里不是 `marked` 天生自带的能力，而是项目自己给 `marked` 注册了两个扩展 tokenizer：

- `mathBlock`
- `mathInline`

它们分别做的事是：

1. 在原始 Markdown 字符串里匹配 `$...$` 或 `$$...$$`
2. 生成自定义 token
3. 调 `katex.renderToString(content, { displayMode, throwOnError: false })`
4. 输出渲染后的 HTML

为什么要用 `renderToString()`？

因为整条 Markdown 渲染链最终是“先得到 HTML 字符串，再转 React 节点”，所以 KaTeX 在这里最自然的接法就是直接产出 HTML。

如果 `katex` 动态加载失败，或者某个公式渲染报错，项目不会抛出致命错误，而是退回原始定界符文本，也就是把：

- `$...$`
- `$$...$$`

原样显示出来。

### 8.2 当前已经支持的能力

从代码看，当前预览/正式页至少支持：

- 标准 Markdown 标题、段落、列表
- 任务列表
- 链接
- 图片
- 代码块语法高亮
- 代码一键复制
- 数学公式
- 图片点击放大弹窗

相关实现文件：

- `src/lib/markdown-renderer.ts`
- `src/hooks/use-markdown-render.tsx`
- `src/components/code-block.tsx`
- `src/components/markdown-image.tsx`

### 8.2.1 图片放大是什么，怎么实现的

图片放大的作用很直接：

- 正文里的插图默认按版心展示
- 用户点图后可以弹出大图查看细节

实现方式不在 Markdown 解析器里，而是在 React 替换阶段。

`useMarkdownRender()` 把 HTML 喂给 `html-react-parser` 时，遇到 `<img>` 不直接保留原生标签，而是替换成 `MarkdownImage` 组件。

`MarkdownImage` 做了两层事情：

1. 正文里先渲染一个普通图片
2. 点击图片时，把 `display` 设为 `true`
3. 通过 `DialogModal` 弹出一个模态层
4. 在模态层里再渲染一张更大的图片

所以“图片放大”不是 Markdown 本身的能力，而是“解析后把 img 节点组件化”得到的增强效果。

### 8.2.2 本地图片预览替换是什么，怎么实现的

这块要和“发布替换”分开看。

先说预览替换。

本地图片在正文中不会直接写真实线上地址，因为它还没上传到 GitHub。编辑态里插入的是：

`![](local-image:<id>)`

这个占位符的作用是：

- 在编辑器正文里可以稳定引用某张本地图片
- 不依赖它已经有线上 URL

到了预览阶段，`useWriteData()` 会把它替换成浏览器对象 URL：

- `local-image:<id>` -> `blob:...`

这样 `BlogPreview` 渲染 Markdown 时，就能像加载普通图片一样显示这张本地文件。

所以“本地图片预览替换”解决的是：

- 图片还没上传，但预览里要先看到

它不改仓库文件，只是预览态的临时替换。

### 8.3 一个安全和稳定性风险

当前渲染链没有看到显式的 HTML 清洗步骤。

这意味着如果 Markdown 里混入原始 HTML，最终能否安全显示，取决于：

- `marked`
- `html-react-parser`
- React 对危险属性的处理

但从工程角度看，这仍然属于“缺少明确 sanitization 边界”，如果以后把写作权限开放给多人，这一块应该补上。

## 9. 导入 MD 是怎么实现的

### 9.1 实现非常直接

“导入 MD”按钮在 `src/app/write/components/actions.tsx`。

它做的事情只有这些：

1. 打开隐藏的 `<input type="file" accept=".md">`
2. 取第一个文件
3. `await file.text()`
4. `updateForm({ md: text })`
5. toast 提示导入成功

也就是说，导入逻辑只覆盖正文 `form.md`，不会自动处理其他字段。

### 9.2 导入 MD 不会自动做这些事

当前实现不会：

- 自动从文件名生成 slug
- 自动从文件名或一级标题生成 title
- 解析 YAML front matter
- 自动提取标签、日期、摘要
- 自动导入 Markdown 中引用的相对路径图片
- 自动把本地图片变成 `local-image:<id>`

这是一个很重要的结论：当前“导入 MD”只是“把一个文本文件整体塞进正文框”，不是“完整导入一篇 Markdown 文章”。

### 9.3 导入带 front matter 的 Markdown 会怎样

如果导入的文件开头是这种：

```md
---
title: Hello
date: 2026-01-01
---
```

当前项目不会把它识别成元数据。

它大概率会被当成正文的一部分参与渲染，而不是回填到：

- 标题
- 日期
- 标签
- 摘要

### 9.4 导入带相对路径图片的 Markdown 会怎样

比如导入内容里有：

```md
![](./image.png)
```

当前项目不会去读取同目录下的 `image.png` 文件，也不会自动上传。

结果通常是：

- 预览态里图片大概率无法正常显示
- 发布后线上也不会有这个资源，除非它本来就已经存在于对应 public 路径

## 10. 如果导入的 MD 很大，会发生什么

### 10.1 代码里没有任何文件大小限制

当前代码没有看到：

- 文件大小校验
- `maxSize`
- 超限提示
- 分块读取
- worker 异步解析
- 取消导入

所以严格按代码事实说：

“支持导入多大的 MD 文件”这个项目没有给出明确上限。

### 10.2 当前实现的真实行为

导入大文件时，会经历这些内存和 CPU 开销：

1. `file.text()` 一次性把整个文件读成字符串
2. 把全文放进 Zustand `form.md`
3. 打开预览时，`marked.lexer()` 和 `marked.parser()` 会再走一遍整篇文档
4. 如果代码块很多，还会触发 `shiki` 高亮
5. 完整 HTML 再被 `html-react-parser` 转成 React 节点树

也就是说，大文件不是“只多一点字符串”，而是会在导入、预览、渲染这几步重复占内存和消耗 CPU。

### 10.3 当前项目对大文件的实际承载方式

从实现上看：

- 编辑态输入本身不会实时做 Markdown 解析，因为只是 `textarea`
- 真正重的操作集中在“预览”阶段和“发布前处理”阶段

所以大文件导入后的典型现象会是：

- 导入动作本身变慢
- 打开预览明显卡顿
- 页面可能长时间停留在“渲染中...”
- 浏览器内存占用上升
- 在弱机器或移动端上更容易卡死

### 10.4 它到底支持多大的 MD 文件

如果一定要给结论，只能分成两层：

第一层，代码层面的结论：

- 没有显式上限
- 不是按“固定多少 MB”限制的

第二层，工程层面的结论：

- 当前项目并没有能力保证“大体积 Markdown 可稳定导入并顺畅预览”
- 一旦文档到“数 MB 级别且包含大量代码块/图片引用”，性能风险就会明显上升

所以更准确的说法不是“支持 X MB”，而是：

当前实现未定义可保证的最大导入体积，也没有做大文件保护机制。

## 11. 发布之后，整个博客提交链路是怎样的

这里的“发布”不是写数据库，而是直接往 GitHub 仓库生成一次真实 commit。

核心入口：

- `src/app/write/hooks/use-publish.ts`
- `src/app/write/services/push-blog.ts`

### 11.1 点击发布之后的高层流程

1. 如果还没认证，先导入 `.pem` 私钥
2. 调 `pushBlog()`
3. 获取 GitHub Installation Token
4. 读取当前分支 HEAD
5. 上传本地图片 blob
6. 生成新的 `index.md`
7. 生成新的 `config.json`
8. 重新生成 `public/blogs/index.json`
9. 创建 tree
10. 创建 commit
11. 更新分支 ref
12. 仓库出现新 commit
13. 部署平台监听仓库变化并重新构建
14. 重新部署完成后，站点新内容才真正可见

### 11.2 认证阶段

`getAuthToken()` 的流程是：

1. 先看 `sessionStorage` 里有没有缓存 token
2. 没有的话，用导入的私钥在浏览器里签 GitHub App JWT
3. `GET /repos/{owner}/{repo}/installation`
4. `POST /app/installations/{installationId}/access_tokens`
5. 拿到 installation token

对应文件：

- `src/lib/auth.ts`
- `src/lib/github-client.ts`

### 11.3 本地图片如何发布

`pushBlog()` 会先收集：

- 正文图片里的本地文件
- 本地封面图

然后逐个处理：

1. 计算哈希
2. 生成文件名 `${hash}${ext}`
3. 转成 base64
4. 调 `createBlob()`
5. 把 blob sha 填进 tree item
6. 把 Markdown 里的 `local-image:<id>` 替换成 `/blogs/<slug>/<filename>`

这一步做完后，`form.md` 才变成可以真正落库的线上版 Markdown。

### 11.3.1 本地图片发布替换到底是什么

这里说的“本地图片发布替换”，本质上是在解决一个发布时必须完成的转换：

编辑器里引用的是临时占位符：

`![](local-image:<id>)`

但真正提交到仓库的 `index.md` 里，必须是站点将来能访问到的真实路径：

`![](/blogs/<slug>/<hash>.<ext>)`

所以发布时必须做一次“占位符 -> 正式资源路径”的替换。

### 11.3.2 它为什么不能提前在编辑态就写死正式路径

因为正式路径依赖几个发布时才确定的值：

- 文章最终 slug
- 图片哈希
- 图片扩展名
- 图片是否真的会一并上传

在图片还只是浏览器本地 `File` 时，项目并没有它的线上 URL。

所以当前架构把这个替换分成两步：

1. 编辑/预览阶段：`local-image:<id>` -> `blob:...`
2. 发布阶段：`local-image:<id>` -> `/blogs/<slug>/<hash>.<ext>`

这样同一个占位符就能同时服务：

- 本地预览
- 最终发布

### 11.3.3 发布替换的具体实现细节

`pushBlog()` 在遍历本地图片时，会为每张图计算：

- `hash`
- `ext`
- `filename = ${hash}${ext}`
- `publicPath = /blogs/${form.slug}/${filename}`

然后对 Markdown 文本做字符串替换：

`mdToUpload = mdToUpload.split(\`(${placeholder})\`).join(\`(${publicPath})\`)`

这说明当前实现不是基于 Markdown AST 做节点级替换，而是基于固定占位符文本做纯字符串替换。

这种做法的优点是直接、容易懂。

缺点是：

- 替换规则依赖占位符格式必须严格一致
- 不适合以后扩展成更复杂的资源引用协议

### 11.4 文章正文和配置如何发布

随后会分别创建：

- `public/blogs/<slug>/index.md`
- `public/blogs/<slug>/config.json`

`config.json` 中包含：

- `title`
- `tags`
- `date`
- `summary`
- `cover`
- `hidden`
- `category`

### 11.5 博客索引如何更新

`prepareBlogsIndex()` 会：

1. 从 GitHub 读现有 `public/blogs/index.json`
2. 用 slug 合并或覆盖当前文章项
3. 按日期倒序排序
4. 返回新的 JSON 字符串

然后 `pushBlog()` 再把这个新字符串也做成一个 blob，放进同一个 tree。

### 11.6 最终 Git 对象提交流程

这个项目不是逐文件调用 contents API 提交，而是手动走一遍 Git 对象流：

```text
getRef
-> createBlob (图片)
-> createBlob (index.md)
-> createBlob (config.json)
-> createBlob (index.json)
-> createTree
-> createCommit
-> updateRef
```

对应 GitHub API 封装在 `src/lib/github-client.ts`。

### 11.7 一个很重要的现实

前端提交成功，只代表：

- GitHub 分支更新成功

不代表：

- 当前线上实例已经能立刻访问到新文章

因为站点读取文章内容的方式是去读部署产物里的静态文件，而不是实时读 GitHub 仓库。

所以后面还要等：

- GitHub webhook / 仓库联动
- 部署平台重新构建
- 新版本上线

这个仓库里既有面向 Vercel 的历史文档，也有 OpenNext Cloudflare 配置：

- `open-next.config.ts`
- `wrangler.toml`

不管最终接的是哪一个平台，本质都一样：要等新 commit 触发新的构建发布。

## 12. 当前实现中，编辑器还有哪些隐含问题

### 12.1 新建预览会把点赞打到默认 slug

这是一个比较隐蔽但真实存在的问题。

新建文章页 `/write` 打开预览时，没有传 slug 给 `BlogPreview`，于是 `BlogSidebar` 传给 `LikeButton` 的 `slug` 是 `undefined`。

而 `LikeButton` 的默认值是：

`slug = 'yysuni'`

所以新建预览态如果点了右侧点赞按钮，可能会把赞打到默认键上，而不是“预览草稿”。

这说明预览页虽然复用了正式页组件，但并没有把“预览态副作用”隔离干净。

### 12.2 编辑模式允许改 slug，但发布时又禁止

这是明显的交互不一致。

更合理的做法有两个：

1. 编辑模式直接禁用 slug 输入框
2. 真正支持 rename：迁移目录、更新索引、清理旧目录

### 12.3 没有 slug 重复检测

当前新建文章并不会提前提示“slug 已存在”，而是直接按同一路径写新文件。

这会让“新建”悄悄变成“覆盖”。

### 12.4 导入 MD 不解析 front matter

这是 Markdown 导入最明显的功能缺口之一。

对于来自 Obsidian、Hugo、Jekyll、VitePress、Astro 等工具链的 Markdown，front matter 很常见。当前实现会把这些元数据当正文处理。

### 12.5 导入 MD 不处理附件

相对路径图片、同目录资源、甚至引用的本地文件都不会跟着导入。

这意味着它更像“导入纯文本正文”，而不是“导入一篇完整文章资产包”。

### 12.6 目录不处理重复标题

重复标题会导致：

- 锚点冲突
- 定位跳转错误
- 高亮状态不稳定

### 12.7 渲染性能没有保护

当前没有：

- 大文件阈值提示
- 预览前性能预警
- Web Worker
- 渲染节流/防抖
- 分块渲染

### 12.8 发布链路缺少更强的冲突与重试策略

当前发布逻辑依赖：

- 先读 HEAD
- 基于旧 HEAD 创建 commit
- `updateRef(force = false)` 快进更新

如果别人先推了新的 commit，当前提交会失败。

而且对 401/冲突的恢复能力也不够强：

- 401 会清认证状态，但不会自动重试整个发布事务
- 并发更新时没有自动 rebase 或重试

### 12.9 安全边界偏弱

当前认证是：

- 浏览器持有 GitHub App 私钥内容
- 浏览器本地签 JWT
- 浏览器直接拿 installation token 写 GitHub

这更适合个人站点，不适合多用户后台。

## 13. 我认为最值得先改的地方

如果按投入产出比排序，我建议优先改下面这些。

### 13.1 第一优先级：修正确性问题

1. 编辑模式禁用 slug，或者补齐 rename 能力
2. 新建前检查 slug 是否已存在
3. 预览态隐藏点赞按钮，避免默认 slug 被误点赞
4. 目录锚点做去重

### 13.2 第二优先级：补齐导入能力

1. 支持解析 front matter
2. 尝试从一级标题或文件名自动填 title / slug
3. 检测并导入相对路径图片
4. 导入后自动扫描正文图片并加入图片池

### 13.3 第三优先级：给大文件加保护

1. 导入前做大小提示
2. 预览前做文档复杂度预警
3. Markdown 渲染放到 Web Worker
4. 代码高亮做懒处理或按需处理

### 13.4 第四优先级：提升发布可靠性

1. 401 后自动刷新 token 并重试一次
2. `updateRef` 失败时提示用户先刷新远程版本
3. 给发布结果补上“已提交到 GitHub，等待部署完成”的状态提示
4. 如果改成服务端代理，可把认证和提交链路迁到服务端

## 14. 最后给一句总判断

这个项目的写作器思路很明确：尽量用最少的编辑器基础设施，把“Markdown 文本 -> 预览 -> GitHub commit -> 重新部署”这条链路打通。

它的优点是结构直白、易懂、个人项目成本低。

它的缺点也同样明确：

- 编辑能力偏轻
- 导入能力偏弱
- 大文件无保护
- 预览复用正式页导致副作用泄露
- 发布链路缺少更强的健壮性

如果把它定位成“个人博客站长自用工具”，这套设计是能工作的。

如果想把它继续做成“更像 CMS 的稳定写作后台”，最该补的是：

- slug 与导入校验
- 预览/目录正确性
- 大文件处理
- 发布可靠性
- 认证安全边界
