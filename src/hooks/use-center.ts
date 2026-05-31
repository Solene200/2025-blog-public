'use client'

import { useEffect } from 'react'
import { create } from 'zustand'

type CenterState = {
	x: number
	y: number
	centerX: number
	centerY: number
	width: number
	height: number
	setCenter: (x: number, y: number) => void
	recalc: () => void
}

const computeCenter = () => {
	// 服务端环境没有可用视口，返回 0 避免初始化时报错。
	if (typeof window === 'undefined') {
		return { x: 0, y: 0, width: 0, height: 0 }
	}
	const width = window.innerWidth
	const height = window.innerHeight
	return {
		// x / y 是这个项目里卡片布局使用的“视觉锚点”，y 额外上移 24px。
		x: Math.floor(width / 2),
		y: Math.floor(height / 2) - 24,
		// centerX / centerY 则保留真正的视口几何中心。
		centerX: Math.floor(width / 2),
		centerY: Math.floor(height / 2),
		width,
		height
	}
}

export const useCenterStore = create<CenterState>(set => ({
	x: 0,
	y: 0,
	centerX: 0,
	centerY: 0,
	width: 0,
	height: 0,
	setCenter: (x, y) => set({ x, y }),
	recalc: () => {
		// 每次窗口尺寸变化后都重新推导一遍布局参考点。
		const c = computeCenter()
		set({ x: c.x, y: c.y, width: c.width, height: c.height, centerX: c.centerX, centerY: c.centerY })
	}
}))

export function useCenterInit() {
	useEffect(() => {
		// 中心点和 useSize 一样，属于随窗口变化的全局 UI 状态。
		const update = () => useCenterStore.getState().recalc()
		update()
		window.addEventListener('resize', update)
		return () => window.removeEventListener('resize', update)
	}, [])
}
