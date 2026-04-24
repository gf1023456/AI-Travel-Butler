/**
 * 清理编译缓存脚本
 * 使用方法: 
 * 1. 先关闭微信开发者工具
 * 2. 运行: node clean.js
 */

const fs = require('fs')
const path = require('path')

const distPath = path.join(__dirname, 'dist')

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    try {
      fs.rmSync(folderPath, { recursive: true, force: true })
      console.log(`✅ 已删除: ${folderPath}`)
      return true
    } catch (error) {
      console.error(`❌ 删除失败: ${folderPath}`)
      console.error(`错误信息: ${error.message}`)
      return false
    }
  } else {
    console.log(`ℹ️  目录不存在，无需清理: ${folderPath}`)
    return true
  }
}

console.log('🧹 开始清理编译缓存...\n')

if (deleteFolderRecursive(distPath)) {
  console.log('\n✅ 清理完成！')
  console.log('📝 下一步：')
  console.log('   1. 确保微信开发者工具已关闭')
  console.log('   2. 运行编译命令: npm run dev:mp-weixin')
  console.log('   3. 重新打开微信开发者工具，导入 dist/dev/mp-weixin')
} else {
  console.log('\n❌ 清理失败！')
  console.log('⚠️  请确保：')
  console.log('   1. 微信开发者工具已完全关闭')
  console.log('   2. 没有其他进程占用dist目录')
  console.log('   3. 然后重新运行此脚本')
}


