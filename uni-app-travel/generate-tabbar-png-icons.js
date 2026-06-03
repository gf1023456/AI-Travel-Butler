/**
 * 生成 tabBar PNG 图标脚本
 * 使用简单的方式创建 81x81 的 PNG 图标
 * 
 * 依赖: npm install canvas
 * 运行: node generate-tabbar-png-icons.js
 */

const fs = require('fs')
const path = require('path')

// 检查是否安装了 canvas 库
let createCanvas
try {
  const { createCanvas: create } = require('canvas')
  createCanvas = create
} catch (e) {
  console.log('❌ 未找到 canvas 库，正在安装...')
  console.log('请运行: npm install canvas')
  console.log('\n💡 或者使用在线工具生成图标')
  process.exit(1)
}

const outputDir = path.join(__dirname, 'src/static/tabbar')

// 确保目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

/**
 * 绘制探索图标（指南针）
 */
function drawExploreIcon(canvas, ctx, color) {
  const size = 81
  const center = size / 2
  const radius = 30
  
  // 清空画布
  ctx.clearRect(0, 0, size, size)
  
  // 绘制外圆
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.stroke()
  
  // 绘制指针
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(center + 15, center - 15)
  ctx.lineTo(center - 5, center + 10)
  ctx.lineTo(center, center)
  ctx.closePath()
  ctx.fill()
  
  ctx.beginPath()
  ctx.moveTo(center - 15, center + 15)
  ctx.lineTo(center + 5, center - 10)
  ctx.lineTo(center, center)
  ctx.closePath()
  ctx.fill()
}

/**
 * 绘制我的图标（用户）
 */
function drawMineIcon(canvas, ctx, color) {
  const size = 81
  const center = size / 2
  
  // 清空画布
  ctx.clearRect(0, 0, size, size)
  
  // 绘制头部
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(center, 28, 12, 0, Math.PI * 2)
  ctx.stroke()
  
  // 绘制身体
  ctx.beginPath()
  ctx.arc(center, 62, 20, Math.PI, 0)
  ctx.stroke()
}

// 生成图标
const icons = [
  { name: 'explore', draw: drawExploreIcon },
  { name: 'explore-active', draw: drawExploreIcon },
  { name: 'mine', draw: drawMineIcon },
  { name: 'mine-active', draw: drawMineIcon }
]

const colors = {
  'explore': '#7A7E83',
  'explore-active': '#1E40AF',
  'mine': '#7A7E83',
  'mine-active': '#1E40AF'
}

console.log('🎨 开始生成 PNG 图标...\n')

icons.forEach(icon => {
  const canvas = createCanvas(81, 81)
  const ctx = canvas.getContext('2d')
  
  // 绘制图标
  icon.draw(canvas, ctx, colors[icon.name])
  
  // 保存为 PNG
  const buffer = canvas.toBuffer('image/png')
  const filePath = path.join(outputDir, `${icon.name}.png`)
  fs.writeFileSync(filePath, buffer)
  
  console.log(`✅ 已生成: ${icon.name}.png`)
})

console.log('\n🎉 所有 PNG 图标已生成完成！')
console.log(`📁 图标位置: ${outputDir}`)
console.log('\n✨ 现在可以重新编译项目了')
