/**
 * QQ 音乐网关代理（自建 qq-music-api，服务端持登录态）
 *
 * 前端无需任何 QQ 音乐登录 Cookie，游客直接播放：
 *   GET /api/music/gateway/qq?mid=<songmid>&quality=320
 * 本代理转发到内网网关 http://<MUSIC_GATEWAY_QQ_URL>/getMusicPlay?songmid=...&quality=...
 * 并返回官方直链。网关只监听 Docker 内网，不暴露公网。
 *
 * 安全：若配置了 NUXT_PUBLIC_MUSIC_GATEWAY_TOKEN，则校验请求头 x-gateway-token；
 * 未配置时直接放行（适合内网/低风险部署）。
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const gatewayToken = (config.public as any)?.musicGatewayToken || ''
  const { mid, quality } = getQuery(event)

  // 配置了 token 才校验，防止代理被公网随意调用
  if (gatewayToken && getRequestHeader(event, 'x-gateway-token') !== gatewayToken) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  if (!mid) {
    throw createError({ statusCode: 400, statusMessage: 'missing mid' })
  }
  const base: string = config.musicGatewayQq || ''
  if (!base) {
    throw createError({ statusCode: 503, statusMessage: 'music gateway not configured' })
  }

  try {
    const params = new URLSearchParams({ songmid: String(mid) })
    if (quality) {
      params.set('quality', String(quality))
    }
    const data: any = await $fetch(`${base}/getMusicPlay?${params.toString()}`, {
      timeout: 12000
    })
    if (data?.code === 0 && data?.data?.url) {
      let url: string = String(data.data.url)
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://')
      }
      return {
        success: true,
        url,
        source: 'gateway-qq',
        quality: data.data.quality || ''
      }
    }
    return { success: false, message: data?.msg || 'qq gateway error' }
  } catch (error: any) {
    return { success: false, message: error?.message || 'qq gateway unavailable' }
  }
})
