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
        // Also patch project.config.json to include ai-skill files
        const projectConfigPath = path.resolve(distDir, '..', 'project.config.json')
        if (fs.existsSync(projectConfigPath)) {
          try {
            let raw = fs.readFileSync(projectConfigPath, 'utf-8')
            raw = raw.replace(/^\uFEFF/, '')
            const cfg = JSON.parse(raw)
            if (!cfg.packOptions) cfg.packOptions = {}
            if (!cfg.packOptions.includes) cfg.packOptions.includes = []
            if (!cfg.packOptions.includes.find(i => i.value === 'ai-skill/**')) {
              cfg.packOptions.includes.push({ value: 'ai-skill/**' })
            }
            fs.writeFileSync(projectConfigPath, JSON.stringify(cfg, null, 2), 'utf-8')
            console.log(`[copy-ai-skill] Patched ${projectConfigPath}`)
          } catch (e) {
            console.error(`[copy-ai-skill] Failed to patch project.config.json:`, e)
          }
        }
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
