import { useEffect, useState, type ReactElement, Fragment } from 'react'
import parse, { type HTMLReactParserOptions, Element, type DOMNode } from 'html-react-parser'
import { renderMarkdown, type TocItem } from '@/lib/markdown-renderer'
import { MarkdownImage } from '@/components/markdown-image'
import { CodeBlock } from '@/components/code-block'

type MarkdownRenderResult = {
	content: ReactElement | null
	toc: TocItem[]
	loading: boolean
}

export function useMarkdownRender(markdown: string): MarkdownRenderResult {
	// 这个 hook 把“Markdown 字符串”转换成三份 UI 可直接消费的结果：
	// 1. React 内容树 2. 目录结构 3. 渲染中的 loading 状态
	const [content, setContent] = useState<ReactElement | null>(null)
	const [toc, setToc] = useState<TocItem[]>([])
	const [loading, setLoading] = useState<boolean>(true)

	useEffect(() => {
		// markdown 变化很可能导致上一次异步渲染结果过期，因此用 cancelled 防止回写旧结果。
		let cancelled = false

		async function render() {
			setLoading(true)
			try {
				// renderMarkdown 负责 Markdown -> HTML + toc；
				// 本 hook 再把 HTML 转成 React 节点，并替换特殊节点。
				const { html, toc } = await renderMarkdown(markdown)
				if (!cancelled) {
					// 先把代码块抽出来，替换成占位符，避免 html-react-parser 直接吞掉
					// 我们需要保留原始 pre 结构，再包上一层自定义 CodeBlock 组件。
					const codeBlocks: Array<{ placeholder: string; code: string; preHtml: string }> = []
					let processedHtml = html.replace(/<pre\s+data-code="([^"]*)"([^>]*)>([\s\S]*?)<\/pre>/g, (match, codeAttr, attrs, content) => {
						const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
						// Shiki / HTML 属性里带出来的代码被实体转义过，这里还原成真正的源码字符串。
						const code = codeAttr
							.replace(/&quot;/g, '"')
							.replace(/&#39;/g, "'")
							.replace(/&lt;/g, '<')
							.replace(/&gt;/g, '>')
							.replace(/&amp;/g, '&')
						codeBlocks.push({
							placeholder,
							code,
							preHtml: `${content}`
						})
						return placeholder
					})

					// 解析 HTML 时，把普通 img 换成项目自己的 MarkdownImage，
					// 再把刚才的代码块占位符替换回自定义 CodeBlock。
					const options: HTMLReactParserOptions = {
						replace(domNode: DOMNode) {
							if (domNode instanceof Element && domNode.name === 'img') {
								const { src, alt, title } = domNode.attribs
								return <MarkdownImage src={src} alt={alt} title={title} />
							}
							// 占位符最终会出现在文本节点里，这里把它们拆开再逐个还原。
							if (domNode.type === 'text' && domNode.data && domNode.data.includes('__CODE_BLOCK_')) {
								const text = domNode.data
								const result = text
												.split(/(__CODE_BLOCK_\d+__)/)
												.filter(Boolean);

								return (
									<>
										{result.map((item, index) => {
											if(item.startsWith('__CODE_BLOCK_')){
												const block = codeBlocks.find(b => b.placeholder === item)
												if(block){
													const preElement = parse(block.preHtml) as ReactElement
													return (
														<CodeBlock key={block.placeholder} code={block.code}>{preElement}</CodeBlock>
													)
												}
											}else{
												return item
													? <Fragment key={index}>{item}</Fragment>
													: null
											}
										})}
									</>
								)
							}
						}
					}
					// 最终 content 是可直接渲染的 ReactElement，而不是原始 HTML 字符串。
					const reactContent = parse(processedHtml, options) as ReactElement
					setContent(reactContent)
					setToc(toc)
				}
			} catch (error) {
				console.error('Markdown render error:', error)
				if (!cancelled) {
					setContent(null)
					setToc([])
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		render()

		return () => {
			// markdown 输入一旦变化，旧渲染结果就不应该再落回到最新状态里。
			cancelled = true
		}
	}, [markdown])

	return { content, toc, loading }
}
