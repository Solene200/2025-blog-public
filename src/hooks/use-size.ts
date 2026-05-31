git'use client'

import { useEffect } from 'react'
import { create } from 'zustand'

type SizeState = {
	init: boolean
	maxXL: boolean
	maxLG: boolean
	maxMD: boolean
	maxSM: boolean
	maxXS: boolean
	recalc: () => void
}

// 这份 store 保存的是“当前视口落在哪些断点以内”的快照。
// 它不是业务数据，而是跨组件共享的响应式布局状态。
const initState = {
	init: false,
	maxXL: false,
	maxLG: false,
	maxMD: false,
	maxSM: false,
	maxXS: false
}

const computeSize = (): Omit<SizeState, 'recalc'> => {
	// SSR / 模块初始化阶段没有 window，这里先返回一个安全的默认值。
	if (typeof window !== 'undefined') {
		const width = window.innerWidth

		return {
			init: true,
			maxXL: width < 1280,
			maxLG: width < 1024,
			maxMD: width < 768,
			maxSM: width < 640,
			maxXS: width < 360
		}
	}

	return initState
}

export const useSizeStore = create<SizeState>(set => ({
	...initState,
	// 统一把“重新计算断点”的动作收口到 store 内，外部只触发 recalc。
	recalc: () => {
		set(computeSize())
	}
}))

export function useSizeInit() {
	useEffect(() => {
		// 首次挂载时先算一次，之后在 resize 时持续同步。
		const update = () => useSizeStore.getState().recalc()
		update()
		window.addEventListener('resize', update)
		return () => window.removeEventListener('resize', update)
	}, [])
}

// 直接把 store hook 暴露为 useSize，调用方只关心读状态即可。
export const useSize = useSizeStore
