import { useMemo } from 'react'
import dayjs from 'dayjs'
import { useWriteStore } from '../stores/write-store'

export function useWriteData() {
	// 这是一个派生数据 hook：
	// 把编辑器原始 store 状态整理成“预览页可直接消费的显示数据”。
	const { form, images } = useWriteStore()

	// 编辑器里的本地图片在 Markdown 中先写成 local-image:id 占位符；
	// 预览时需要替换成 object URL，浏览器才能直接显示。
	const processedMarkdown = useMemo(() => {
		let mdForPreview = form.md
		for (const img of images) {
			if (img.type === 'file') {
				const placeholder = `local-image:${img.id}`
				mdForPreview = mdForPreview.split(`(${placeholder})`).join(`(${img.previewUrl})`)
			}
		}
		return mdForPreview
	}, [form.md, images])

	// 给预览页提供用户友好的兜底标题和格式化日期。
	const title = form.title || 'Untitled'
	const date = dayjs(form.date).format('YYYY年 M月 D日')

	return {
		markdown: processedMarkdown,
		title,
		date
	}
}
