import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 用对象哈希而不是数组存已读状态，读取某篇文章是否已读是 O(1)。
type ReadArticlesHash = Record<string, boolean>

interface ReadArticlesStore {
	readArticles: ReadArticlesHash
	markAsRead: (slug: string) => void
	isRead: (slug: string) => boolean
	clearAll: () => void
}

export const useReadArticles = create<ReadArticlesStore>()(
	persist(
		(set, get) => ({
			// 这是纯本地偏好数据，不需要走远端接口。
			readArticles: {},
			markAsRead: (slug: string) => {
				set(state => ({
					readArticles: {
						...state.readArticles,
						[slug]: true
					}
				}))
			},
			isRead: (slug: string) => {
				return get().readArticles[slug] === true
			},
			clearAll: () => {
				// 清空后 persist 中间件会同步更新本地存储。
				set({ readArticles: {} })
			}
		}),
		{
			// localStorage 的命名空间，避免和别的状态持久化键冲突。
			name: 'blog-read-articles'
		}
	)
)
