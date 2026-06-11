import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'
import fs from 'fs'

function copyAiSkillPlugin() {
  return {
    name: 'copy-ai-skill',
    closeBundle() {
      const srcDir = path.resolve(__dirname, 'ai-skill')
      const isWeChat = process.env.UNI_PLATFORM === 'mp-weixin'
      if (!isWeChat || !fs.existsSync(srcDir)) return

      const distDirs = [
        path.resolve(__dirname, 'dist/dev/mp-weixin/ai-skill'),
        path.resolve(__dirname, 'dist/build/mp-weixin/ai-skill')
      ]

      for (const distDir of distDirs) {
        if (!fs.existsSync(path.dirname(distDir))) continue
        copyRecursive(srcDir, distDir)
        console.log(`[copy-ai-skill] Copied to ${distDir}`)
      }
    }
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

export default defineConfig({
  plugins: [uni(), copyAiSkillPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
