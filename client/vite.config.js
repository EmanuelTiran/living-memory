import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_')
  const apiProxyTarget = env.API_PROXY_TARGET

  if (command === 'serve' && !apiProxyTarget) {
    throw new Error(
      'API_PROXY_TARGET is required while running the Vite development server.',
    )
  }

  return {
    plugins: [react()],
    server:
      command === 'serve'
        ? {
            proxy: {
              '/api': {
                target: apiProxyTarget,
                changeOrigin: true,
              },
            },
          }
        : undefined,
  }
})
