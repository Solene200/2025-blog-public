import { useEffect } from 'react'
import { useWriteStore } from '../stores/write-store'
import { toast } from 'sonner'

export function useLoadBlog(slug?: string) {
	// 编辑页进入时，需要根据 URL slug 把远端博客内容灌进 write store。
	const { loadBlogForEdit, loading } = useWriteStore()

	useEffect(() => {
		if (slug) {
			// 具体解析 Markdown / config / 图片列表的逻辑在 store action 内部，这里只负责触发。
			loadBlogForEdit(slug).catch(err => {
				console.error('Failed to load blog:', err)
				toast.error('加载博客失败')
			})
		}
	}, [slug, loadBlogForEdit])

	// 页面通常只关心“是否还在加载现有博客”。
	return { loading }
}
