const { withAndroidManifest } = require('expo/config-plugins')

module.exports = function withWhatsappQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest
    manifest.queries = manifest.queries || [{}]
    const q = manifest.queries[0]
    q.package = q.package || []
    for (const name of ['com.whatsapp', 'com.whatsapp.w4b']) {
      if (!q.package.some((p) => p.$['android:name'] === name)) {
        q.package.push({ $: { 'android:name': name } })
      }
    }
    q.intent = q.intent || []
    const hasScheme = q.intent.some(
      (i) => i.data && i.data.some((d) => d.$['android:scheme'] === 'whatsapp')
    )
    if (!hasScheme) {
      q.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'whatsapp' } }],
      })
    }
    return cfg
  })
}
