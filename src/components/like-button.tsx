import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'motion/react'
import { Heart } from 'lucide-react'
import clsx from 'clsx'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { BLOG_SLUG_KEY } from '@/consts'

type LikeButtonProps = {
	slug?: string
	className?: string
	delay?: number
}

const ENDPOINT = 'https://blog-liker.yysuni1001.workers.dev/api/like'

export default function LikeButton({ slug = 'yysuni', delay, className }: LikeButtonProps) {
	slug = BLOG_SLUG_KEY + slug
	// 下面这几个 useState 都是纯本地 UI 状态：动画、显隐、粒子效果。
	// 它们不适合放进 SWR，因为它们不是远端资源。
	const [liked, setLiked] = useState(false)
	const [show, setShow] = useState(false)
	const [justLiked, setJustLiked] = useState(false)
	const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([])

	useEffect(() => {
		// 延迟出现按钮，给首页初始动画留一点节奏。
		setTimeout(() => {
			setShow(true)
		}, delay || 1000)
	}, [])

	useEffect(() => {
		// “刚点赞完”的强调动画只持续一小段时间，之后自动复位。
		if (justLiked) {
			const timer = setTimeout(() => setJustLiked(false), 600)
			return () => clearTimeout(timer)
		}
	}, [justLiked])

	// fetcher 只关心“怎么读取点赞数”。
	// 真正的缓存、去重、重验证仍然由 SWR 接管。
	const fetcher = useCallback(async (url: string): Promise<number | null> => {
		const res = await fetch(url, { method: 'GET', cache: 'no-store' })
		if (!res.ok) return null
		const data = await res.json().catch(() => ({}))
		return typeof data?.count === 'number' ? data.count : null
	}, [])

	// 当 key 为 null 时，SWR 会跳过请求。
	// 这里的 key 由 slug 唯一决定，因此不同文章会命中不同的点赞数缓存槽位。
	const { data: fetchedCount, mutate } = useSWR(slug ? `${ENDPOINT}?slug=${encodeURIComponent(slug)}` : null, fetcher, {
		revalidateOnFocus: false,
		// 10 秒内重复读取同一个点赞接口时，尽量复用结果而不是反复打远端。
		dedupingInterval: 1000 * 10
	})

	const handleLike = useCallback(async () => {
		if (!slug) return
		// 先更新本地 UI，让按钮反馈即时；网络请求随后进行。
		setLiked(true)
		setJustLiked(true)

		// Create particle effects
		const newParticles = Array.from({ length: 6 }, (_, i) => ({
			id: Date.now() + i,
			x: Math.random() * 60 - 30,
			y: Math.random() * 60 - 30
		}))
		setParticles(newParticles)

		// Clear particles after animation
		setTimeout(() => setParticles([]), 1000)

		try {
			const url = `${ENDPOINT}?slug=${encodeURIComponent(slug)}`
			const res = await fetch(url, { method: 'POST' })
			const data = await res.json().catch(() => ({}))
			if (data.reason == 'rate_limited') toast('谢谢啦😘，今天已经不能再点赞啦💕')
			const value = typeof data?.count === 'number' ? data.count : (fetchedCount ?? 0) + 1
			// 这里没有重新 GET 一次，而是直接把 SWR 缓存改成最新值。
			// 好处是数字会立刻更新；代价是要由我们自己保证这个 value 足够可信。
			await mutate(value, { revalidate: false })
		} catch {
			// ignore
		}
	}, [slug, fetchedCount, mutate])

	// 统一把“可显示的点赞数”整理成 count，渲染层不直接碰 fetchedCount 的多种可能值。
	const count = typeof fetchedCount === 'number' ? fetchedCount : null

	if (show)
		return (
			<motion.button
				initial={{ opacity: 0, scale: 0.6 }}
				animate={{ opacity: 1, scale: 1 }}
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
				aria-label='Like this post'
				onClick={handleLike}
				className={clsx('card heartbeat-container relative overflow-visible rounded-full p-3', className)}>
				<AnimatePresence>
					{particles.map(particle => (
						<motion.div
							key={particle.id}
							className='pointer-events-none absolute inset-0 flex items-center justify-center'
							initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
							animate={{
								opacity: [1, 1, 0],
								scale: [0, 1.2, 0.8],
								x: particle.x,
								y: particle.y
							}}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.8, ease: 'easeOut' }}>
							<Heart className='fill-rose-400 text-rose-400' size={12} />
						</motion.div>
					))}
				</AnimatePresence>

				{typeof count === 'number' && (
					<motion.span
						initial={{ scale: 0.4 }}
						animate={{ scale: 1 }}
						className={cn(
							'absolute -top-2 left-9 min-w-6 rounded-full px-1.5 py-1 text-center text-xs text-white tabular-nums',
							liked ? 'bg-rose-400' : 'bg-gray-300'
						)}>
						{count}
					</motion.span>
				)}
				<motion.div animate={justLiked ? { scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] } : {}} transition={{ duration: 0.6, ease: 'easeOut' }}>
					<Heart className={clsx('heartbeat', liked ? 'fill-rose-400 text-rose-400' : 'fill-rose-200 text-rose-200')} size={28} />
				</motion.div>
			</motion.button>
		)
}
