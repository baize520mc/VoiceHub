/**
 * 网易云音乐网关代理（自建 NeteaseCloudMusicApi，服务端持登录态）
 *
 * 前端无需任何网易云登录 Cookie，游客直接播放：
 *   GET /api/music/gateway/nc?id=<songId>&level=exhigh
 * 本代理转发到内网网关 http://<MUSIC_GATEWAY_NC_URL>/song/url/v1?id=...&level=...
 * 并返回官方直链。网关只监听 Docker 内网，不暴露公网。
 *
 * 安全：若配置了 NUXT_PUBLIC_MUSIC_GATEWAY_TOKEN，则校验请求头 x-gateway-token；
 * 未配置时直接放行（适合内网/低风险部署）。
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const gatewayToken = (config.public as any)?.musicGatewayToken || ''
  const { id, level } = getQuery(event)

  // 配置了 token 才校验，防止代理被公网随意调用
  if (gatewayToken && getRequestHeader(event, 'x-gateway-token') !== gatewayToken) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'missing id' })
  }
  const base: string = config.musicGatewayNc || ''
  if (!base) {
    throw createError({ statusCode: 503, statusMessage: 'music gateway not configured' })
  }

  try {
    const params = new URLSearchParams({ id: String(id) })
    if (level) {
      params.set('level', String(level))
    }
    const data: any = await $fetch(`${base}/song/url/v1?${params.toString()}`, {
      timeout: 12000
    })
    // NeteaseCloudMusicApi 响应: { code: 200, data: [{ id, url, br, ... }] }
    if (data?.code === 200 && data?.data?.[0]?.url) {
      let url: string = String(data.data[0].url)
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://')
      }
      return {
        success: true,
        url,
        source: 'gateway-nc',
        br: data.data[0].br || 0
      }
    }
    return { success: false, message: 'nc gateway error' }
  } catch (error: any) {
    return { success: false, message: error?.message || 'nc gateway unavailable' }
  }
})
