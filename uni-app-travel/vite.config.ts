import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787', // 后端服务地址（默认8787端口）
        changeOrigin: true,
        secure: false
      }
    }
  }
})
