/**
 * 生成 tabBar 图标脚本
 * 运行方式: node generate-tabbar-icons.js
 */

const fs = require('fs')
const path = require('path')

// 创建简单的 SVG 图标并转换为 PNG
const icons = {
  'explore': {
    // 探索图标（指南针）
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 24 24" fill="none" stroke="#7A7E83" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    activeSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 24 24" fill="none" stroke="#1E40AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`
  },
  'mine': {
    // 我的图标（用户）
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 24 24" fill="none" stroke="#7A7E83" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    activeSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 24 24" fill="none" stroke="#1E40AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
  }
}

const outputDir = path.join(__dirname, 'src/static/tabbar')

// 确保目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// 保存 SVG 文件（微信小程序支持 SVG 格式）
Object.keys(icons).forEach(name => {
  const icon = icons[name]
  
  // 未选中状态
  fs.writeFileSync(path.join(outputDir, `${name}.svg`), icon.svg)
  console.log(`✅ 已生成: ${name}.svg`)
  
  // 选中状态
  fs.writeFileSync(path.join(outputDir, `${name}-active.svg`), icon.activeSvg)
  console.log(`✅ 已生成: ${name}-active.svg`)
})

console.log('\n🎉 所有图标已生成完成！')
console.log(`📁 图标位置: ${outputDir}`)
console.log('\n⚠️  注意: 微信小程序推荐使用PNG格式，如果SVG不生效，请手动替换为PNG图标')
console.log('   建议尺寸: 81x81 像素')
console.log('   可以使用在线工具或设计软件导出PNG')
