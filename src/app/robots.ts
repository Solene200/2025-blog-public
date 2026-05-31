import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
	const baseUrl = process.env.SITE_URL
		? process.env.SITE_URL
		: process.env.VERCEL_URL
			? `https://${process.env.VERCEL_URL}`
			: 'http://localhost:3000'

	return {
		// 如果是通用规则，可以直接写成对象
		// rules: {
		// 	userAgent: '*',
		// 	allow: '/',
		// 	disallow: '/private/'
		// },
		// 自定义爬虫规则时可以使用数组
		rules: [
			{
				userAgent: 'Googlebot',
				allow: '/',
				disallow: '/api/',
				crawlDelay: 10
			},
			{
				userAgent: 'Baiduspider',
				allow: '/',
				disallow: '/api/',
				crawlDelay: 10
			},
			{
				userAgent: 'Bingbot',
				allow: '/',
				disallow: '/api/',
				crawlDelay: 10
			},
			{
				userAgent: 'YandexBot',
				allow: '/',
				disallow: '/api/',
				crawlDelay: 10
			},
			{
				userAgent: 'Sogou spider',
				allow: '/',
				disallow: '/api/',
				crawlDelay: 10
			}
		],
		// app/sitemap.ts 实际暴露的是 /sitemap.xml，而不是 /sitemap
		sitemap: new URL('/sitemap.xml', baseUrl).toString()
	}
}
