import { useCallback } from 'react'
import { readFileAsText } from '@/lib/file-utils'
import { toast } from 'sonner'
import { pushBlog } from '../services/push-blog'
import { deleteBlog } from '../services/delete-blog'
import { useWriteStore } from '../stores/write-store'
import { useAuthStore } from '@/hooks/use-auth'

export function usePublish() {
	// 这个 hook 是写作页“动作层”的薄封装：
	// 从编辑器 store 取当前草稿，再把发布 / 删除 / 导入私钥这些动作组合出来。
	const { loading, setLoading, form, cover, images, mode, originalSlug } = useWriteStore()
	const { isAuth, setPrivateKey } = useAuthStore()

	const onChoosePrivateKey = useCallback(
		async (file: File) => {
			// 这里只负责把 PEM 文件读进认证 store，后续真正换 token 在 lib/auth 内完成。
			const pem = await readFileAsText(file)
			setPrivateKey(pem)
		},
		[setPrivateKey]
	)

	const onPublish = useCallback(async () => {
		try {
			// loading 放在 write store 里，这样操作栏、表单等多个区域都能共享同一发布中状态。
			setLoading(true)
			await pushBlog({
				form,
				cover,
				images,
				mode,
				originalSlug
			})

			// service 层负责真正写 GitHub，hook 层只补用户反馈。
			const successMsg = mode === 'edit' ? '更新成功' : '发布成功'
			toast.success(successMsg)
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '操作失败')
		} finally {
			setLoading(false)
		}
	}, [form, cover, images, mode, originalSlug, setLoading])

	const onDelete = useCallback(async () => {
		// 编辑模式优先删 originalSlug，避免用户改动表单后误删错误目标。
		const targetSlug = originalSlug || form.slug
		if (!targetSlug) {
			toast.error('缺少 slug，无法删除')
			return
		}
		try {
			setLoading(true)
			await deleteBlog(targetSlug)
		} catch (err: any) {
			console.error(err)
			toast.error(err?.message || '删除失败')
		} finally {
			setLoading(false)
		}
	}, [form.slug, originalSlug, setLoading])

	return {
		isAuth,
		loading,
		onChoosePrivateKey,
		onPublish,
		onDelete
	}
}
