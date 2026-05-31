import useSWR from 'swr'
import { useAuthStore } from '@/hooks/use-auth'
import type { BlogIndexItem } from '@/app/blog/types'

export type { BlogIndexItem } from '@/app/blog/types'

// SWR 负责“何时取”和“如何缓存”，fetcher 只负责把远端 JSON 取回来。
// 这里显式使用 no-store，表示不要依赖浏览器 HTTP 缓存，而是交给 SWR 的内存缓存与重验证机制。
const fetcher = async (url: string) => {
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		// 把 HTTP 状态码挂到错误对象上，方便上层根据 404 / 500 做差异化处理。
		const error: any = new Error('Fetch failed')
		error.status = res.status
		throw error
	}
	const data = await res.json()
	// 兜底保证返回数组，避免 JSON 结构异常时把脏数据继续传给页面。
	return Array.isArray(data) ? data : []
}

export function useBlogIndex() {
	const { isAuth } = useAuthStore()
	// '/blogs/index.json' 就是 SWR 的 cache key。
	// 只要别的组件也用这个 key，它们读到的就是同一份远端资源缓存。
	const { data, error, isLoading } = useSWR<BlogIndexItem[]>('/blogs/index.json', fetcher, {
		// 文章索引不是高频实时数据，因此切回页面时不强制重拉。
		revalidateOnFocus: false,
		// 但如果浏览器经历过断网重连，重新校验一次更合理。
		revalidateOnReconnect: true
	})

	let result = data || []
	if (!isAuth) {
		// 认证态只影响“展示投影”，不改写 SWR 里的原始远端数据。
		result = result.filter(item => !item.hidden)
	}

	return {
		items: result,
		loading: isLoading,
		error
	}
}

export function useLatestBlog() {
	// 这是建立在 useBlogIndex 之上的派生 hook，不会额外发第二次请求。
	const { items, loading, error } = useBlogIndex()

	// 按日期倒序后取第一篇，得到“最新文章”。
	const latestBlog = items.length > 0 ? items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null

	return {
		blog: latestBlog,
		loading,
		error
	}
}
