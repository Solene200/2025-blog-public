import { create } from 'zustand'
import { clearAllAuthCache, getAuthToken as getToken, hasAuth as checkAuth, getPemFromCache, savePemToCache } from '@/lib/auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'

// 认证 store 负责维护“当前浏览器会话是否已具备 GitHub 写入能力”。
// 它既保存内存态，也在允许时桥接本地缓存。
interface AuthStore {
	// State
	isAuth: boolean
	privateKey: string | null

	// Actions
	setPrivateKey: (key: string) => void
	clearAuth: () => void
	refreshAuthState: () => void
	getAuthToken: () => Promise<string>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
	isAuth: false,
	privateKey: null,

	setPrivateKey: async (key: string) => {
		// 一旦导入私钥，前端即可视为“已认证”，后续换 token 时再走 lib/auth。
		set({ isAuth: true, privateKey: key })
		const { siteContent } = useConfigStore.getState()
		if (siteContent?.isCachePem) {
			// 是否允许把 PEM 缓存在本地由站点配置控制。
			await savePemToCache(key)
		}
	},

	clearAuth: () => {
		// 同时清理本地缓存和内存态，避免 UI 和底层认证状态不一致。
		clearAllAuthCache()
		set({ isAuth: false })
	},

	refreshAuthState: async () => {
		// 这里不直接推导，而是询问 lib/auth 当前真实认证状态。
		set({ isAuth: await checkAuth() })
	},

	getAuthToken: async () => {
		// token 生成逻辑在 lib/auth；hook 这里只做状态同步和对外暴露。
		const token = await getToken()
		get().refreshAuthState()
		return token
	}
}))

// 模块加载时尝试从缓存恢复私钥，这样刷新页面后不必重新手动导入。
getPemFromCache().then((key) => {
	if (key) {
		useAuthStore.setState({ privateKey: key })
	}
})

// 同样在模块加载时校验一次真实认证状态，给消费组件一个尽早可用的初始值。
checkAuth().then((isAuth) => {
	if (isAuth) {
		useAuthStore.setState({ isAuth })
	}
})
