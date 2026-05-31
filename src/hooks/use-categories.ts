'use client'

import useSWR from 'swr'

export type CategoriesConfig = {
	categories: string[]
}

const fetcher = async (url: string): Promise<CategoriesConfig> => {
	// 和博客索引一样，这里把浏览器 HTTP 缓存关掉，交给 SWR 处理内存缓存与重验证。
	const res = await fetch(url, { cache: 'no-store' })
	if (!res.ok) {
		// 分类列表属于辅助数据，失败时回退为空数组而不是抛出硬错误。
		return { categories: [] }
	}
	const data = await res.json()
	// 兼容两种结构：
	// 1. ["CSS", "React"]
	// 2. { categories: ["CSS", "React"] }
	if (Array.isArray(data)) {
		return { categories: data.filter((item): item is string => typeof item === 'string') }
	}
	if (Array.isArray((data as any)?.categories)) {
		return { categories: (data as any).categories.filter((item: unknown): item is string => typeof item === 'string') }
	}
	return { categories: [] }
}

export function useCategories() {
	// 这个 key 对应 public/blogs/categories.json，多个组件会共享同一份缓存。
	const { data, error, isLoading } = useSWR<CategoriesConfig>('/blogs/categories.json', fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: true
	})

	return {
		// 对消费方统一暴露规范化结果，避免页面层反复写 data?.categories ?? []。
		categories: data?.categories ?? [],
		loading: isLoading,
		error
	}
}
