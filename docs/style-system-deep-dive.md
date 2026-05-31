# 样式系统与首页布局深度拆解

这份文档专门分析本项目所有和“样式、主题、首页布局、动画”直接相关的实现，不讲写作器发布链路。

重点覆盖这些问题：

- 主题切换到底怎么做
- 配置弹窗怎么组织
- 颜色怎么选择、怎么回写、为什么能立刻影响样式
- 保存到 GitHub 的链路是什么
- 全局样式如何分层
- 首页卡片为什么能通过弹窗和拖拽改变布局
- `zustand` 里的配置态 / 布局编辑态 / 响应尺寸态是怎么配合的
- `motion` 在这个项目里到底起了什么作用
- 这个项目整体是什么布局方式

## 1. 先给结论

这个项目的样式系统不是“切一套 className 主题包”，也不是 CSS Modules 驱动的组件级隔离体系。它的核心思路是：

1. 用 `site-content.json` 保存主题色、背景色、背景图等配置
2. 在根布局上把主题色注入成一组 CSS Variables
3. 让 Tailwind 语义色、全局 CSS、SVG、局部内联样式都消费这组变量
4. 用 `zustand` 存一份运行时配置，让首页和各页面能即时预览
5. 点击保存时，通过 GitHub API 把配置 JSON 和相关图片一起提交回仓库

所以它本质上是：

`配置文件 -> CSS Variables -> React 组件 / Tailwind 工具类 / SVG -> 运行时预览 -> GitHub 持久化`

## 2. 样式系统整体分层

这个项目的样式来源主要分成五层。

### 2.1 第一层：Tailwind 4 主题 token

文件：

- `src/styles/theme.css`

这里用 `@theme` 定义了一组基础 token：

- `--color-brand`
- `--color-primary`
- `--color-secondary`
- `--color-brand-secondary`
- `--color-bg`
- `--color-border`
- `--color-card`
- `--color-article`
- `--font-averia`
- `--font-sans`

这些 token 的意义不是“马上改页面”，而是给 Tailwind 语义工具类提供颜色来源。也就是说，像下面这些 class：

- `text-primary`
- `bg-bg`
- `bg-card`
- `border-border`
- `bg-brand`

最终都建立在这些变量之上。

### 2.2 第二层：根节点运行时 CSS Variables

文件：

- `src/app/layout.tsx`

`RootLayout` 会从 `src/config/site-content.json` 里取出 `theme`，然后把颜色写到 `<html style={...}>` 上：

- `--color-brand`
- `--color-primary`
- `--color-secondary`
- `--color-brand-secondary`
- `--color-bg`
- `--color-border`
- `--color-card`
- `--color-article`

这一步非常关键。

因为 `theme.css` 里的变量只是默认 token，而真正让整站“带上当前主题值”的，是根节点上的这批 inline CSS variables。

### 2.3 第三层：全局样式文件

项目当前只有三份全局样式文件：

- `src/styles/globals.css`
- `src/styles/theme.css`
- `src/styles/article.css`

职责分别是：

`theme.css`

- 定义设计 token 默认值
- 定义字体 token

`globals.css`

- 引入 Tailwind
- 引入 KaTeX 默认 CSS
- 引入 `theme.css` 和 `article.css`
- 写全局基础样式
- 定义项目通用 utility，例如 `card`、`brand-btn`、`text-linear`

`article.css`

- 专门负责 Markdown 正文 `.prose` 的排版样式
- 包括标题、段落、列表、代码块、图片、表格、blockquote 等

### 2.4 第四层：组件内 Tailwind class + 少量内联样式

大多数组件的样式是这样写的：

- 版式和基础外观用 Tailwind class
- 动态尺寸/位置用 `style={{ left, top, width, height }}`
- 少量依赖变量的颜色直接写 `var(--color-...)`

比如：

- 首页卡片位置用 `left/top/width/height`
- 时钟 SVG 段码直接用 `var(--color-primary)`
- 背景图使用 `style={{ backgroundImage: ... }}`

### 2.5 第五层：SVG 也在吃主题变量

这个项目不少 SVG 并不是写死颜色，而是直接使用 CSS Variables。

例如：

- `src/svgs/music.svg`
- `src/svgs/play.svg`
- `src/svgs/email.svg`

里面会出现：

- `var(--color-brand)`
- `var(--color-brand-secondary)`
- `var(--color-border)`

这意味着主题变了，不仅 div/button 背景会变，SVG 渐变和填充颜色也会一起变。

## 3. 主题切换是怎么实现的

### 3.1 主题配置存在哪里

主题主配置在：

- `src/config/site-content.json`

关键字段：

- `theme`
- `backgroundColors`
- `backgroundImages`
- `currentBackgroundImageId`

其中 `theme` 负责品牌色、文本色、卡片色等；`backgroundColors` 主要给首页泡泡背景使用；`backgroundImages` 负责站点背景图列表。

### 3.2 配置弹窗是怎么组织的

弹窗入口组件：

- `src/app/(home)/config-dialog/index.tsx`

它分成三个 tab：

- `site`：网站设置
- `color`：色彩配置
- `layout`：首页布局

对应内容组件：

- `SiteSettings`
- `ColorConfig`
- `HomeLayout`

弹窗本身不是浏览器原生 `dialog`，而是：

- `DialogModal`
- 内部基于 `createPortal`
- 通过 `AnimatePresence + motion.div` 做进出场动画

### 3.3 弹窗里的配置数据是怎么存的

`ConfigDialog` 打开时，会把全局配置 store 里的值复制到本地状态：

- `formData`
- `cardStylesData`
- `originalData`
- `originalCardStyles`

这里很重要：

- `formData` 是弹窗内部编辑用的临时副本
- `cardStylesData` 也是弹窗内部编辑用的临时副本
- 不是一边改表单，一边直接写远程仓库

所以弹窗本质是一个“本地 staging 区”。

## 4. 颜色是怎么取得的

### 4.1 颜色选择器不是三方现成控件

颜色选择器文件：

- `src/components/color-picker.tsx`
- `src/components/color-picker-panel.tsx`
- `src/lib/color.ts`

这个颜色选择器是项目自己写的。

### 4.2 `ColorPicker` 做什么

`ColorPicker` 本身只是一个触发器：

1. 显示当前颜色的小色块
2. 点击后计算按钮位置
3. 用 portal 把 `ColorPickerPanel` 渲染到 `document.body`
4. 监听外部点击，点击面板外关闭

### 4.3 `ColorPickerPanel` 做什么

`ColorPickerPanel` 才是真正取色的地方。

它内部维护：

- `hueOffset`
- `alphaOffset`
- `saturationOffset`
- `brightOffset`

用户交互分成三块：

1. 大色盘：控制饱和度和明度
2. hue 滑条：控制色相
3. alpha 滑条：控制透明度

### 4.4 颜色值怎么计算

颜色转换工具都在 `src/lib/color.ts`。

这套工具支持：

- `hex -> RGB/RGBA`
- `RGB -> HSL`
- `HSL <-> HSV`
- `HSVA -> hex`

所以当前取色流程是：

1. 初始值以 hex 形式传入
2. `hexToHsva()` 把它转成 HSVA
3. 面板中的拖拽操作实时更新 hue/saturation/value/alpha
4. `hsvaToHex()` 再把当前状态转回 hex
5. 通过 `onChange(hex)` 回传给上层

### 4.5 透明色为什么也能支持

因为 `hsvaToHex()` 在 alpha < 1 时会输出 8 位 hex：

- `#RRGGBBAA`

这就是为什么像：

- `colorCard: '#ffffff66'`
- `colorArticle: '#ffffffcc'`

这种半透明配置能成立。

## 5. 颜色配置弹窗具体怎么配

文件：

- `src/app/(home)/config-dialog/color-config.tsx`

### 5.1 可以配哪些颜色

基础主题色一共 8 个：

- `colorBrand`
- `colorBrandSecondary`
- `colorPrimary`
- `colorSecondary`
- `colorBg`
- `colorBorder`
- `colorCard`
- `colorArticle`

另外还能配置：

- `backgroundColors`

它是一个数组，不是单值。

### 5.2 颜色来源有哪些

当前弹窗支持三种颜色来源：

1. 手动拾色
2. 一键随机配色
3. 套用预设主题

预设主题定义在 `COLOR_PRESETS`：

- 春暖
- 秋实
- 深夜

随机配色则会：

- 随机生成 4 到 8 个背景色
- 随机生成一个 `colorBrand`

### 5.3 背景颜色为什么是数组

因为首页的模糊泡泡背景 `BlurredBubblesBackground` 不是单色背景，而是多圆形、多颜色的模糊运动层。

它会循环使用 `backgroundColors` 数组里的颜色来画泡泡。

## 6. 为什么改完颜色就能实时看到样式变化

这件事要分两层说。

### 6.1 第一层：弹窗内部色块是即时变化的

这一层最直接。

因为 `ColorPicker` 的 `value` 来自 `formData.theme`，而每次 `onChange` 都会立刻更新 `formData`。

所以：

- 颜色按钮本身
- 预设面板中的选择状态
- 背景色列表里的色块

都会立即反映当前值。

### 6.2 第二层：整站样式不是“每次取色时自动全站生效”

这一点必须说清。

当前代码里，`ColorConfig` 只是在改弹窗内部的 `formData`，它**不会**在每一次 `onChange` 时自动调用：

- `setSiteContent()`
- `updateThemeVariables()`

真正把颜色应用到整站的动作发生在：

- 点击“预览”
- 点击“保存”

对应 `ConfigDialog` 里的：

- `handlePreview()`
- `handleSave()`

### 6.3 为什么点击预览/保存后页面能立刻变

原因有两条线同时成立。

第一条线，React 配置态更新：

- `setSiteContent(formData)`
- `setCardStyles(cardStylesData)`

这会让依赖 `useConfigStore()` 的组件重新渲染，例如：

- 背景图
- 社交按钮
- 头像/标题等配置项
- 首页卡片尺寸与偏移

第二条线，CSS Variables 被直接改了：

`updateThemeVariables(theme)` 会对 `document.documentElement` 执行：

- `root.style.setProperty('--color-brand', colorBrand)`
- `root.style.setProperty('--color-primary', colorPrimary)`
- 其他主题变量同理

由于整站大量样式都在消费这些变量，所以变量一变，浏览器会立即重新计算依赖它们的样式。

### 6.4 为什么一定要手动 `setProperty`

这是当前实现里很关键的一个设计点。

`src/app/layout.tsx` 是根布局，初始主题值来自服务端导入的 `site-content.json`。但用户在客户端修改主题后，`RootLayout` 并不会重新跑一遍服务器渲染并自动刷新 `<html style={...}>`。

所以项目必须在客户端手动执行：

- `document.documentElement.style.setProperty(...)`

否则：

- store 里的数据已经变了
- 但根节点 CSS Variables 还是旧的
- 依赖变量的样式不会刷新

### 6.5 哪些东西会随着主题变量立即变化

至少包括三类：

第一类，Tailwind 语义色 utility：

- `text-primary`
- `text-secondary`
- `bg-bg`
- `bg-card`
- `bg-brand`
- `border-border`

第二类，全局 CSS 中直接读变量的地方：

- `article.css` 的标题前缀、blockquote、strong 等
- `globals.css` 的 range track、按钮等

第三类，SVG 和局部内联样式：

- SVG 的 `fill/stroke/stop-color`
- 时钟卡的 `var(--color-primary)`
- 某些线性渐变背景

### 6.6 一个细节：背景泡泡为什么还要 `regenerateBubbles`

配置弹窗预览和取消时都会调用：

- `regenerateBubbles()`

这是因为首页泡泡背景不是普通 DOM 背景色，而是 canvas 动画。

文件：

- `src/layout/backgrounds/blurred-bubbles.tsx`

它虽然已经依赖 `colors` prop，但作者仍然额外用 `regenerateKey` 强制重建一轮效果，避免只改配置但背景视觉没有完全刷新。

## 7. 主题预览、取消、保存分别做了什么

### 7.1 点击预览

`handlePreview()` 会：

1. `setSiteContent(formData)`
2. `setCardStyles(cardStylesData)`
3. `regenerateBubbles()`
4. 更新 `document.title`
5. 更新 `<meta name="description">`
6. `updateThemeVariables(formData.theme)`
7. 关闭弹窗

所以“预览”本质上是：

- 把临时配置推到运行时 store 和 DOM
- 但还没有写 GitHub

### 7.2 点击取消

`handleCancel()` 会：

1. 清理本地 preview URL
2. 把 `useConfigStore()` 恢复成弹窗打开时的 `originalData`
3. 恢复 `originalCardStyles`
4. 重新生成泡泡背景
5. 恢复 document title 和 meta description
6. 恢复 CSS Variables

所以取消不是简单关弹窗，而是真正做一次状态回滚。

### 7.3 点击保存

`handleSave()` 会：

1. 调 `pushSiteContent(...)`
2. 远程提交成功后
3. `setSiteContent(formData)`
4. `setCardStyles(cardStylesData)`
5. `updateThemeVariables(formData.theme)`
6. 清理上传缓存
7. 关闭弹窗

也就是说，“保存”才是持久化动作。

### 7.4 一个重要现实

如果你点击的是“预览”而不是“保存”：

- 当前页面会即时变
- 但刷新页面后会回到仓库中的旧配置

因为预览只改了内存态和 DOM，没有改仓库文件。

## 8. 配置保存到 GitHub 的链路是什么

文件：

- `src/app/(home)/services/push-site-content.ts`
- `src/lib/auth.ts`
- `src/lib/github-client.ts`

### 8.1 高层流程

1. 获取 GitHub installation token
2. 读取目标分支最新 commit SHA
3. 处理 favicon / avatar / 艺术图 / 背景图 / 社交按钮图上传或删除
4. 生成新的 `src/config/site-content.json`
5. 生成新的 `src/config/card-styles.json`
6. 创建 Git blobs
7. 创建 Git tree
8. 创建 Git commit
9. 更新分支 ref

### 8.2 这次保存会写哪些文件

至少有这两份核心配置文件：

- `src/config/site-content.json`
- `src/config/card-styles.json`

如果有本地图片上传，还会一起写：

- `public/favicon.png`
- `public/images/avatar.png`
- `public/images/art/...`
- `public/images/background/...`
- `public/images/social-buttons/...`

### 8.3 为什么主题能持久化

因为保存时不是只改内存态，而是把 `siteContent` 和 `cardStyles` 序列化成 JSON 后提交回仓库。

下一次部署、下一次刷新、下一次 SSR：

- `src/app/layout.tsx`
- `src/layout/index.tsx`
- `useConfigStore` 初始化

读取到的就是新的配置。

## 9. 整个项目的样式分配方式

### 9.1 它不是 CSS Modules 项目

当前风格更接近：

- Tailwind utility-first
- 少量全局 CSS
- 运行时 CSS Variables
- JSX 内联样式补动态值

### 9.2 全局样式职责怎么分

`globals.css`

- 基础 reset 风格
- html/body 高度、背景、平滑滚动
- 全局 scrollbar 处理
- Sonner toast 样式
- 通用 utility：`card`、`brand-btn`、`text-linear`、`bg-linear`

`article.css`

- 正文章节排版和阅读样式
- `.prose` 范围内的所有细节

`theme.css`

- 设计 token 默认值
- 字体 token

### 9.3 项目最核心的几个视觉 utility

最重要的是这些：

`card`

- 绝对定位
- 毛玻璃背景
- 圆角
- 阴影
- inset 光泽

`brand-btn`

- 品牌色按钮
- 圆角和边框
- 白字

`text-linear`

- 品牌色渐变文字

`bg-linear`

- 品牌色渐变背景

### 9.4 字体系统怎么进来的

文件：

- `src/layout/head.tsx`
- `src/styles/theme.css`

`Head` 会引入：

- `Averia Gruesa Libre`

然后 `theme.css` 里把它映射成：

- `--font-averia`

所以项目里像首页大标题、品牌文字，会通过：

- `font-averia`

形成更强识别度。

### 9.5 favicon 和元信息也属于“样式系统边界”

严格说它们不只是 SEO 资源，也属于站点视觉配置的一部分。

当前项目支持通过配置弹窗改：

- favicon
- avatar
- title
- description

并且预览时会直接更新：

- `document.title`
- `meta[name="description"]`

## 10. 首页每个卡片的布局是怎么设置的

### 10.1 首页不是 grid 自动排版

这是最容易误判的一点。

首页桌面端不是：

- CSS Grid 自动布局
- Masonry
- flex wrap

而是“每张卡片自己算坐标，然后绝对定位到页面上的一个位置”。

### 10.2 布局配置存在哪里

文件：

- `src/config/card-styles.json`

每个卡片都有一条配置，例如：

- `width`
- `height`
- `order`
- `offsetX`
- `offsetY`
- `enabled`

这些配置会被 `useConfigStore()` 读到运行时。

### 10.3 卡片位置怎么计算

首页各卡片并不是统一用一套布局函数，而是每个卡片组件自己写定位公式。

例如：

`HiCard`

- 默认居中

`ArtCard`

- 默认在 `HiCard` 上方

`ClockCard`

- 默认在 `HiCard` 右上

`CalendarCard`

- 默认在时钟下方

`SocialButtons`

- 默认在 `HiCard` 右下

`ArticleCard`

- 默认在 `HiCard` 左下，但位置又参考了 `SocialButtons` 的宽度

也就是说，首页布局不是完全自由的绝对坐标，而是：

- 一套“以中心卡为基准”的相对公式
- 再加可编辑偏移量

### 10.4 中心点是谁算的

文件：

- `src/hooks/use-center.ts`

`useCenterStore` 会根据窗口尺寸计算：

- `centerX`
- `centerY`
- `x`
- `y`
- `width`
- `height`

其中默认定位主要使用：

- `center.x`
- `center.y`

这就是首页卡片围绕视窗中心展开的原因。

## 11. 为什么弹窗里加减数字，首页就会变成那样

### 11.1 宽高变化会影响两个层面

第一层，卡片自身尺寸直接变：

- `Card` 组件拿到新的 `width/height`
- `motion.div` 的 `animate` 目标也跟着变

第二层，依赖这张卡的其他卡片位置也可能联动变化：

比如 `SocialButtons` 的默认位置会用到 `hiCard.width`，`ArticleCard` 又会用到 `socialButtons.width`。

所以你在弹窗里改一张卡的宽度，可能不止它自己变，周围卡片的默认定位公式也会被重新计算。

### 11.2 偏移量变化为什么能改变布局

每张卡计算 `x/y` 时都会有这样的逻辑：

- 如果 `offsetX/offsetY !== null`，优先用中心点 + 偏移
- 否则走默认公式

这意味着：

- `offsetX/offsetY = null`：按默认布局
- 给出具体数值：改成自定义相对中心偏移

所以弹窗里输入偏移值，本质上是在覆盖默认位置。

### 11.3 `enabled` 为什么能让卡片消失

首页 `src/app/(home)/page.tsx` 渲染卡片时会判断：

- `cardStyles.xxx?.enabled !== false`

所以禁用某张卡片，本质就是直接让 React 不再渲染它。

### 11.4 `order` 真正起什么作用

这里也要特别说清。

这个项目里，**卡片的 `order` 主要不是用来排版定位的**，而是用来控制：

- 首页卡片出现的先后动画

它会被 `Card` 组件转换成：

- `setTimeout(order * ANIMATION_DELAY * 1000)`

所以对大多数卡片来说：

- `order` 决定出场先后
- `offsetX/offsetY/width/height` 决定布局结果

只有社交按钮列表内部按钮的 `order`，才同时承担按钮内部排序的作用。

## 12. 首页拖拽位置是怎么实现的

文件：

- `src/app/(home)/home-draggable-layer.tsx`
- `src/app/(home)/stores/layout-edit-store.ts`

### 12.1 拖拽不是直接拖 `Card` 本体

进入首页拖拽编辑时，真正出现的是一层覆盖在卡片上方的虚线框：

- 可拖拽
- 右下角可缩放

这层就是 `HomeDraggableLayer`。

它在 `editing = true` 时渲染一个绝对定位的 overlay：

- `cursor-move`
- 虚线边框
- 右下角拖拽手柄

卡片本体仍然在下面，overlay 只是编辑层。

### 12.2 拖拽时改的是什么

拖拽开始时会记录：

- 鼠标起点
- 当时的 `offsetX`
- 当时的 `offsetY`

移动时实时计算：

- `nextOffsetX`
- `nextOffsetY`

然后调用：

- `setOffset(cardKey, nextOffsetX, nextOffsetY)`

而 `setOffset()` 最终会直接改 `useConfigStore().cardStyles`。

### 12.3 缩放时改的是什么

缩放逻辑也一样：

- 记录初始宽高
- 根据鼠标移动量算出新宽高
- 调 `setSize(cardKey, nextWidth, nextHeight)`

这会直接改：

- `cardStyles[key].width`
- `cardStyles[key].height`

### 12.4 为什么拖一下页面就立刻变

因为拖拽过程不是“先存局部变量，最后一次性提交”，而是每次移动都直接写 `config-store`。

所以链路是：

`鼠标移动 -> layout-edit-store.setOffset/setSize -> config-store.cardStyles 更新 -> 各卡片重新计算 x/y/width/height -> motion 补间到新位置`

## 13. `zustand` 里的三类状态是怎么配合的

这里至少有四个 store / 运行时状态要一起看。

### 13.1 `config-store`：运行时配置中心

文件：

- `src/app/(home)/stores/config-store.ts`

职责：

- 保存 `siteContent`
- 保存 `cardStyles`
- 保存配置弹窗开关
- 保存泡泡重生成 key

它是“当前页面应该长成什么样”的主来源。

### 13.2 `layout-edit-store`：布局编辑控制器

文件：

- `src/app/(home)/stores/layout-edit-store.ts`

职责：

- 是否正在编辑首页布局
- 开始编辑时记录 snapshot
- 取消编辑时回滚
- 提供 `setOffset` / `setSize`

它本身不保存最终布局，只负责编辑过程控制。

### 13.3 `useSizeStore`：响应式尺寸态

文件：

- `src/hooks/use-size.ts`

职责：

- 记录 `maxXL / maxLG / maxMD / maxSM / maxXS`
- 记录是否完成客户端初始化 `init`

它控制：

- 是否走移动端布局
- 某些卡片是否隐藏
- 动画延迟是否归零

### 13.4 `useCenterStore`：中心坐标态

文件：

- `src/hooks/use-center.ts`

职责：

- 保存当前窗口中心
- 保存可用于定位的 x/y
- 保存窗口宽高

首页绝大多数桌面端卡片都依赖它算默认位置。

### 13.5 它们怎么配合

可以把关系理解成：

`config-store`

- 定义“卡片有哪些、尺寸多少、偏移多少、站点主题是什么”

`useCenterStore`

- 提供“这些卡片围绕哪个中心点摆放”

`useSizeStore`

- 决定“当前是不是移动端、要不要隐藏某些卡片、动画策略要不要收敛”

`layout-edit-store`

- 决定“现在是否允许拖拽、这次修改要不要回滚”

## 14. 首页布局编辑态 / 响应尺寸态 / 站点配置态的完整链路

这条链路最好完整串一次。

### 14.1 正常展示态

1. `config-store` 初始化读取 `site-content.json` 和 `card-styles.json`
2. `useCenterInit()` 计算中心点
3. `useSizeInit()` 计算断点状态
4. 首页各卡片读取 store，算出自己的位置和尺寸
5. `Card` 用 `motion.div` 显示出来

### 14.2 弹窗数值编辑态

1. 打开配置弹窗
2. 把 store 当前值复制到 `formData/cardStylesData`
3. 在弹窗里改宽高、偏移、启用状态、主题色
4. 这些值先只存在本地状态里
5. 点击“预览”后，才真正写回 `config-store`

### 14.3 首页拖拽编辑态

1. 在 `HomeLayout` 点“进入主页拖拽布局”
2. 先把 `cardStylesData` 推进 `config-store`
3. `layout-edit-store.startEditing()` 记录 snapshot 并打开编辑态
4. 关闭弹窗，回到首页
5. 拖拽/缩放 overlay，实时修改 `config-store.cardStyles`
6. 顶部提示条的“保存偏移”只结束编辑，不会自动推 GitHub
7. 真正持久化还要回到配置弹窗点“保存”

### 14.4 取消拖拽编辑

`layout-edit-store.cancelEditing()` 会：

1. 读取 snapshot
2. `setCardStyles(snapshot)`
3. 清掉 editing 和 snapshot

所以拖拽编辑的取消不是“重算”，而是“回滚到编辑开始前的 cardStyles 快照”。

## 15. 首页卡片出现顺序动画是怎么做的

### 15.1 统一入口是 `Card` 组件

文件：

- `src/components/card.tsx`

它接收：

- `order`
- `width`
- `height`
- `x`
- `y`

### 15.2 出场顺序怎么控制

`Card` 内部会：

1. 初始 `show = false`
2. 当 `x/y` 可用后
3. `setTimeout(() => setShow(true), order * ANIMATION_DELAY * 1000)`

其中：

- `ANIMATION_DELAY = 0.1`

所以：

- `order = 1` 的卡片先出现
- `order = 8` 的卡片更晚出现

### 15.3 真正的出场动画长什么样

当 `show = true` 时，`Card` 渲染：

- `initial={{ opacity: 0, scale: 0.6, left: x, top: y, width, height }}`
- `animate={{ opacity: 1, scale: 1, left: x, top: y, width, height }}`

所以每张卡的入场是：

- 从缩小和透明状态出现
- 补间到正常大小和透明度

### 15.4 卡片位置变化为什么也会有动画

因为 `motion.div` 的 `animate` 目标里不仅有 opacity/scale，还有：

- `left`
- `top`
- `width`
- `height`

所以当你拖拽、改尺寸、切换配置后：

- 这些值一变
- motion 就会自动补间到新位置和新大小

## 16. 每个页面切换的动画是怎么做的

这一点要非常明确：

**这个项目没有统一的全局路由切场动画系统。**

代码里没有看到：

- `template.tsx`
- 包裹 `children` 的 `AnimatePresence`
- 路由离场动画容器

### 16.1 那为什么页面切过去还是会感觉“有动画”

因为大多数页面自己的主要区块在挂载时都写了：

- `initial`
- `animate`

例如：

- 首页卡片
- About 页头部和正文卡片
- Blog 详情正文
- 各编辑页右上角按钮

所以“页面切换时的动画感”实际上来自：

- 新页面挂载后，页面内部组件各自做入场动画

而不是：

- 上一页退出 + 下一页进入的全局路由过渡

### 16.2 这意味着什么

意味着当前项目的动画模型更接近：

- component mount animation

而不是：

- shared page transition system

## 17. `motion` 在这个项目里到底起什么作用

`motion` 不是只用来“淡入一下”，它承担了几类不同任务。

### 17.1 入场动画

最常见的一类：

- 页面标题淡入
- 卡片 scale in
- 编辑按钮浮现
- 预览按钮出现

常见写法：

- `initial={{ opacity: 0, scale: 0.6 }}`
- `animate={{ opacity: 1, scale: 1 }}`

### 17.2 交互微动效

大量按钮都用了：

- `whileHover={{ scale: 1.05 }}`
- `whileTap={{ scale: 0.95 }}`

这是全项目最常见的交互反馈样式。

### 17.3 位置和尺寸补间

首页卡片和部分浮动组件会把：

- `left`
- `top`
- `width`
- `height`

放进 `animate`，这样拖拽或改配置时位置变化不会硬切。

### 17.4 弹窗和浮层进出场

`AnimatePresence` + `motion.div` 用在：

- `DialogModal`
- 社交按钮二维码弹层
- `Select` 下拉菜单

这类场景下，`AnimatePresence` 的作用是让组件在 React 要卸载它时，还能先跑完 `exit` 动画。

### 17.5 共享高亮块动画

`NavCard` 里用了：

- `layoutId='nav-hover'`

作用是告诉 motion：

- 这个高亮块虽然位置变了，但它本质上是“同一个元素”

于是当 hoveredIndex 变化时，高亮背景就会像一块连续滑动的胶囊，而不是删掉旧块再创建新块。

### 17.6 粒子、小部件动画

例如点赞按钮：

- `AnimatePresence` 负责爱心粒子出场和消失
- `motion.div` 负责位移、缩放、透明度

### 17.7 背景层整体过渡

例如：

- `BlurredBubblesBackground`
- `SnowfallBackground`

它们最外层都用 `motion.div` 做整体淡入。

但内部实现不同：

- 泡泡背景内部是 `canvas + requestAnimationFrame`
- 雪花背景内部是很多个 `motion.div` 无限下落

这说明项目没有“凡动画必用 motion”，而是按场景选：

- UI 过渡：motion
- 大量粒子/流体：canvas 或混合实现

## 18. 整个项目是什么布局方式

可以把整个项目理解成两套布局模式。

### 18.1 首页：绝对定位拼贴布局

首页桌面端的特点是：

- 以中心卡为核心
- 周围卡片环绕分布
- 卡片全部绝对定位
- 卡片尺寸和偏移可配置
- 视觉上像一张拼贴海报

这是项目最有辨识度的布局。

### 18.2 其他页面：普通文档流布局

非首页页面大多数回到：

- `flex`
- `grid`
- `max-width` 容器
- `pt-32 pb-12` 这类纵向节奏

例如：

- Projects 页是响应式 grid
- About 页是居中单栏内容
- Blog 列表页是普通流式分组列表
- Blog 详情页是正文 + 右侧 sidebar

也就是说：

- 首页负责品牌化视觉
- 子页面负责内容可读性

### 18.3 根布局层级怎么叠

`src/layout/index.tsx` 的层级大致是：

1. Toaster
2. 背景图层
3. 模糊泡泡背景
4. `main.relative.z-10`
5. 页面内容
6. 全局浮动 `NavCard`
7. 全局 `MusicCard`
8. 移动端 ScrollTopButton

这说明整个站点不是传统的：

- header / main / footer

视觉中心实际上是：

- 背景层
- 漂浮导航
- 浮层卡片

顺带一提，`Header` 和 `Footer` 组件当前基本是空壳，不承担实际视觉结构。

## 19. 还有哪些和样式有关、容易忽略的点

### 19.1 首页移动端和桌面端是两套行为

首页外层容器在移动端会变成：

- `flex`
- `flex-col`
- `items-center`

不少卡片本身也带：

- `max-sm:static`

这意味着：

- 桌面端：依赖绝对定位
- 移动端：尽量回到普通流式排列

### 19.2 不是所有卡片移动端都显示

例如：

- `ClockCard`
- `CalendarCard`
- `ShareCard`
- `WriteButtons`

很多都在 `!maxSM` 条件下才显示。

所以移动端首页是明显裁剪过的版本，不是桌面端布局硬压缩。

### 19.3 圣诞模式也是样式系统的一部分

`siteContent.enableChristmas` 会影响：

- 雪花背景
- 多个卡片上的节日装饰图

这实际上是一种主题变体开关。

### 19.4 背景图和泡泡背景可以叠加

当前根布局会先画：

- 背景图

再画：

- 模糊泡泡背景

所以不是“二选一”，而是可能形成叠加效果。

### 19.5 Toast 也被纳入了主题语气

`Layout` 里配置了 `Toaster`，并在 `globals.css` 里统一处理：

- 毛玻璃
- 阴影

所以连反馈消息的视觉也和主站保持一致。

## 20. 看懂之后，我认为最值得注意的几个事实

### 20.1 当前主题预览不是“边拖边全站实时联动”

真实情况是：

- 弹窗内部表单是实时的
- 整站主题应用在“预览/保存”时才发生

如果想实现真正的边选边预览，可以在 `formData.theme` 变化时直接调用 `updateThemeVariables()`，但当前代码没有这样做。

### 20.2 首页 `order` 命名有误导性

对于卡片来说，它更像：

- animationOrder

而不是：

- layoutOrder

### 20.3 首页布局系统很灵活，但耦合也比较强

因为很多卡片的位置计算依赖别的卡片宽高，所以它不是一套完全独立的布局引擎，而是一张人工编排的相对坐标网。

优点：

- 视觉结果很有设计感

缺点：

- 新增卡片、换布局逻辑时要手动维护关系

### 20.4 全站没有真正的路由离场动画

如果以后要做“页面切换更顺”，需要额外引入：

- route-level `AnimatePresence`
- `template.tsx`
- 或共享 layout transition 容器

## 21. 如果继续做，我认为最值得优化的点

### 21.1 把主题预览做成真正的实时联动

现在的主题预览是：

- 弹窗内颜色立即变化
- 整站主题要等点击“预览”或“保存”才应用

如果目标是更像设计器，可以把：

- `updateThemeVariables(formData.theme)`

放进受控的 `useEffect`，让颜色变化时即时推送到根节点变量；关闭弹窗时再统一回滚。

这样能减少一次“点预览才知道结果”的往返。

### 21.2 把主题变量映射抽成单一来源

现在有两处地方在维护同一套主题变量：

- `src/app/layout.tsx`
- `src/app/(home)/config-dialog/index.tsx`

它们都知道：

- `colorBrand -> --color-brand`
- `colorPrimary -> --color-primary`
- 其他字段同理

这类映射更适合抽成：

- 常量表
- 公共 `applyThemeVariables(theme)` 函数

否则以后新增主题字段时，很容易一处加了，另一处漏了。

### 21.3 把首页布局从“人工关系网”再抽象一层

当前首页桌面端布局的优点是有设计感，但很多卡片位置依赖：

- 中心卡尺寸
- 其他卡宽高
- 手写公式
- `offsetX / offsetY`

这让系统很灵活，但新增卡片时维护成本会越来越高。

一个更稳的方向是：

- 保留当前自由布局能力
- 另外抽一层“布局模板”或“布局 schema”
- 让各卡片声明自己相对谁定位、默认间距是多少

这样就不会把所有关系都散落在每个卡片组件里。

### 21.4 补上真正的路由级过渡

现在大部分“切页动画感”来自新页面挂载后的入场动画，不是完整的页面切场。

如果以后想把整站体验做得更顺，可以补：

- route-level `AnimatePresence`
- `template.tsx`
- 或统一的 page transition wrapper

这样能做到：

- 旧页淡出
- 新页淡入
- 某些共享元素平滑过渡

### 21.5 把主题 token 从“颜色”扩到“完整视觉 token”

当前主题系统已经很好地覆盖了颜色，但还有不少视觉属性还是写死的，例如：

- 阴影强度
- 圆角半径
- 毛玻璃 blur
- 卡片透明度策略

如果后续希望主题差异更明显，可以把这些也纳入 token。

这样“换主题”就不只是换颜色，而是连视觉质感一起切换。

### 21.6 把“预览”和“保存”状态再分得更清楚

当前体系里有三层状态：

- 弹窗局部编辑态
- `config-store` 运行时展示态
- GitHub 仓库持久化态

这已经能工作，但用户感知上还是容易混淆：

- “保存偏移”只保存本次拖拽结果到运行时
- “预览”会应用到整站，但不会写远程
- “保存”才真正提交仓库

如果后面继续打磨，可以在 UI 上进一步显式标记：

- 当前只是本地草稿
- 当前只是运行时预览
- 当前已经提交远程

这样会更不容易误操作。

## 22. 最后一句总判断

这个项目的样式系统本质上是：

- 语义色 token
- 根节点 CSS Variables
- Tailwind 工具类
- 少量全局 CSS
- 首页绝对定位拼贴布局
- `zustand` 运行时配置
- `motion` 做 UI 层过渡和补间

它不是那种强约束的 design system，也不是严格分层的企业后台主题引擎。

它更像一个为“高辨识度个人博客”量身定制的视觉运行时：

- 首页追求可编排、可拖拽、可主题化
- 子页面追求可读、轻量、统一
- 保存时直接把视觉配置写回 GitHub 仓库

如果把目标定义成“个人站点可视化换肤 + 首页卡片编排”，这套实现是成立的，而且很有作者风格。
