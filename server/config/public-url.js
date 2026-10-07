export function resolvePublicAppUrl(environment = {}) {
  const renderDomain = environment.RENDER_EXTERNAL_URL
    || (environment.RENDER_EXTERNAL_HOSTNAME ? `https://${environment.RENDER_EXTERNAL_HOSTNAME}` : null)
  const railwayDomain = environment.RAILWAY_PUBLIC_DOMAIN ? `https://${environment.RAILWAY_PUBLIC_DOMAIN}` : null
  const vercelDomain = environment.VERCEL_URL ? `https://${environment.VERCEL_URL}` : null
  return environment.PUBLIC_APP_URL || renderDomain || railwayDomain || vercelDomain || undefined
}
