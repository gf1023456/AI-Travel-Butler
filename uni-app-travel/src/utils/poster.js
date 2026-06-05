/**
 * PosterGenerator - 旅行海报生成器
 * 将行程数据绘制为 Canvas 图片，支持景点图片作为 Header 背景
 */
export default class PosterGenerator {
  constructor(options) {
    this.canvasId = options.canvasId || 'shareCanvas'
    this.instance = options.instance
    this.W = 750
    this.H = 1200
    this.P = 32
    this.C = {
      surface: '#F8F9FA',
      primary: '#0F4C5C',
      onSurface: '#191C1D',
      onSurfaceVariant: '#454652',
      outline: '#767683',
      white: '#FFFFFF'
    }
  }

  /** 绘制圆角矩形路径 */
  _drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  /** 文本自动换行 */
  _wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    let line = ''
    let currentLine = 0
    for (let i = 0; i < text.length; i++) {
      const testLine = line + text[i]
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, y)
        line = text[i]
        y += lineHeight
        currentLine++
        if (currentLine >= maxLines) return
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, x, y)
  }

  /** 异步下载图片 */
  _downloadImage(url) {
    return new Promise((resolve, reject) => {
      uni.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) resolve(res.tempFilePath)
          else reject(new Error('下载失败'))
        },
        fail: reject
      })
    })
  }

  /**
   * 生成海报
   * @param {Object} data - { itinerarySummary, days, dayPlanItinerary }
   * @returns {Promise<string>} 图片临时路径
   */
  async generate(data) {
    const { itinerarySummary, days, dayPlanItinerary } = data

    // 尝试下载景点图片作为 Header 背景
    let bgPath = null
    const firstItem = dayPlanItinerary.find(
      item => item.image && !item.image.includes('placeholder')
    )
    if (firstItem?.image) {
      try { bgPath = await this._downloadImage(firstItem.image) }
      catch (e) { console.log('背景图下载失败，使用渐变') }
    }

    // 执行绘制并导出图片
    return this._draw({ itinerarySummary, days, dayPlanItinerary, bgPath })
  }

  /** 核心绘制逻辑 */
  _draw(data) {
    const { itinerarySummary, days, dayPlanItinerary, bgPath } = data
    const ctx = uni.createCanvasContext(this.canvasId, this.instance)
    const { W, H, P, C } = this
    let y = 0

    // ========== 1. 背景 ==========
    ctx.setFillStyle(C.surface)
    ctx.fillRect(0, 0, W, H)

    // ========== 2. 顶部 Header ==========
    const headerH = 420

    // 背景图（景点图优先，失败则用默认 bgm.png）
    if (bgPath) {
      ctx.drawImage(bgPath, 0, 0, W, headerH)
    } else {
      ctx.drawImage('/static/images/bgm.png', 0, 0, W, headerH)
    }

    // 磨砂玻璃条带（覆盖文字区域，模拟毛玻璃质感）
    const glassH = 180
    const glassY = headerH - glassH  // 文字区域起始位置

    // 条带顶部柔和过渡（60px）
    const glassTopGrd = ctx.createLinearGradient(0, glassY - 60, 0, glassY)
    glassTopGrd.addColorStop(0, 'rgba(255,255,255,0)')
    glassTopGrd.addColorStop(1, 'rgba(255,255,255,0.32)')
    ctx.setFillStyle(glassTopGrd)
    ctx.fillRect(0, glassY - 60, W, 60)

    // 条带主体（半透明白色，模拟毛玻璃）
    ctx.setFillStyle('rgba(255,255,255,0.32)')
    ctx.fillRect(0, glassY, W, glassH)

    // 暗色渐变（覆盖条带底部，确保白色文字可读）
    const maskGrd = ctx.createLinearGradient(0, headerH, 0, glassY)
    maskGrd.addColorStop(0, 'rgba(10,20,40,0.55)')
    maskGrd.addColorStop(0.5, 'rgba(10,20,40,0.18)')
    maskGrd.addColorStop(1, 'rgba(10,20,40,0)')
    ctx.setFillStyle(maskGrd)
    ctx.fillRect(0, glassY, W, glassH)

    // CURATED ITINERARY 标签 pill
    const tagW = 176
    const tagH = 28
    const tagX = P
    const tagY = headerH - 168
    ctx.setFillStyle('rgba(255,255,255,0.18)')
    this._drawRoundedRect(ctx, tagX, tagY, tagW, tagH, tagH / 2)
    ctx.fill()
    ctx.setFillStyle(C.white)
    ctx.setFontSize(11)
    ctx.textAlign = 'center'
    ctx.fillText('精心策划的行程', tagX + tagW / 2, tagY + 19)

    // 标题解析
    let mainTitle = itinerarySummary || '智能行程'
    let subTitle = ''
    const commaIdx = mainTitle.indexOf('，')
    if (commaIdx > 0 && commaIdx < 12) {
      subTitle = mainTitle.substring(commaIdx + 1).trim()
      mainTitle = mainTitle.substring(0, commaIdx).trim()
    } else if (mainTitle.includes('：') || mainTitle.includes(':')) {
      const parts = mainTitle.split(/[：:]/)
      mainTitle = parts[0].trim()
      subTitle = parts[1]?.trim() || ''
    } else if (mainTitle.length > 10) {
      subTitle = mainTitle.substring(10, 40)
      mainTitle = mainTitle.substring(0, 10)
    }

    // 大标题
    ctx.setFillStyle(C.white)
    const titleBaseY = tagY + 60
    let cursorX = P

    if (mainTitle.includes('与') && mainTitle.length <= 10) {
      const idx = mainTitle.indexOf('与')
      const part1 = mainTitle.substring(0, idx)
      const part2 = mainTitle.substring(idx + 1)

      ctx.setFontSize(46)
      ctx.textAlign = 'left'
      ctx.fillText(part1, cursorX, titleBaseY)
      cursorX += ctx.measureText(part1).width + 6

      ctx.setFontSize(20)
      ctx.fillText('与', cursorX, titleBaseY - 12)
      cursorX += ctx.measureText('与').width + 6

      ctx.setFontSize(46)
      ctx.fillText(part2, cursorX, titleBaseY)
    } else {
      ctx.setFontSize(38)
      ctx.textAlign = 'left'
      ctx.fillText(mainTitle.substring(0, 10), P, titleBaseY)
    }

    // 副标题
    if (subTitle) {
      ctx.setFontSize(18)
      ctx.setFillStyle('rgba(255,255,255,0.85)')
      ctx.fillText(`| ${subTitle.substring(0, 18)}`, P, titleBaseY + 38)
    }

    // 天数
    ctx.setFontSize(15)
    ctx.setFillStyle('rgba(255,255,255,0.7)')
    const totalDays = days.length || 1
    const nights = Math.max(1, totalDays - 1)
    ctx.fillText(`${totalDays} DAYS & ${nights} NIGHTS`, P, titleBaseY + 70)

    // ========== 3. 行程引言 ==========
    y = headerH + 24
    if (subTitle && subTitle.length > 18) {
      ctx.setFillStyle(C.onSurfaceVariant)
      ctx.setFontSize(17)
      ctx.textAlign = 'left'
      const intro = subTitle.substring(18, 64)
      this._wrapText(ctx, intro, P, y, W - P * 2, 28, 2)
      y += 56
    }

    // ========== 4. 景点卡片（跨天选取）==========
    const daysMap = {}
    dayPlanItinerary.forEach(item => {
      const key = String(item.day || 1)
      if (!daysMap[key]) daysMap[key] = []
      daysMap[key].push(item)
    })

    const sortedDays = Object.keys(daysMap).sort()
    const allItems = []

    // 从不同的天中取第一个景点
    sortedDays.forEach((day, dayIdx) => {
      if (allItems.length < 3 && daysMap[day].length > 0) {
        allItems.push({ ...daysMap[day][0], seq: dayIdx + 1 })
      }
    })
    // 不足3个时补充
    if (allItems.length < 3) {
      sortedDays.forEach(day => {
        daysMap[day].forEach((item, idx) => {
          if (allItems.length < 3 && idx > 0) {
            allItems.push({ ...item, seq: allItems.length + 1 })
          }
        })
      })
    }

    const cardH = 96
    const cardGap = 14

    allItems.forEach((item) => {
      // 白色卡片背景 + 1px 内边框
      ctx.setFillStyle(C.white)
      this._drawRoundedRect(ctx, P, y, W - P * 2, cardH, 16)
      ctx.fill()
      ctx.setStrokeStyle('rgba(255,255,255,0.6)')
      ctx.setLineWidth(1)
      this._drawRoundedRect(ctx, P + 0.5, y + 0.5, W - P * 2 - 1, cardH - 1, 15)
      ctx.stroke()

      // 左侧编号圆（48px直径）
      const circleR = 24
      const circleX = P + 40
      const circleY = y + cardH / 2
      ctx.setFillStyle('#F0F1FF')
      ctx.beginPath()
      ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2)
      ctx.fill()

      // 编号文字
      ctx.setFillStyle(C.primary)
      ctx.setFontSize(17)
      ctx.textAlign = 'center'
      const seqStr = String(item.seq).padStart(2, '0')
      ctx.fillText(seqStr, circleX, circleY + 6)

      // 标题
      ctx.setFillStyle(C.onSurface)
      ctx.setFontSize(20)
      ctx.textAlign = 'left'
      const name = (item.name || '景点').substring(0, 14)
      ctx.fillText(name, P + 84, y + 40)

      // 描述
      if (item.description) {
        ctx.setFillStyle(C.onSurfaceVariant)
        ctx.setFontSize(15)
        const desc = item.description.substring(0, 24)
        ctx.fillText(desc, P + 84, y + 66)
      }

      y += cardH + cardGap
    })

    // 更多提示
    const remain = dayPlanItinerary.length - allItems.length
    if (remain > 0) {
      y += 4
      ctx.setFillStyle(C.outline)
      ctx.setFontSize(15)
      ctx.textAlign = 'center'
      ctx.fillText(`... 还有 ${remain} 个精彩景点 ...`, W / 2, y + 14)
      y += 30
    }

    // ========== 5. 功能亮点 ==========
    y += 10
    ctx.setStrokeStyle('#F0F0F0')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(P, y)
    ctx.lineTo(W - P, y)
    ctx.stroke()
    y += 18

    const features = [
      { icon: 'AI', label: '智能规划' },
      { icon: '路', label: '路线优化' },
      { icon: '文', label: '人文洞察' }
    ]

    const featW = (W - P * 2) / 3
    features.forEach((feat, idx) => {
      const cx = P + featW * idx + featW / 2

      // 图标圆圈（浅蓝背景）
      ctx.setFillStyle('#F0F1FF')
      ctx.beginPath()
      ctx.arc(cx, y + 22, 22, 0, Math.PI * 2)
      ctx.fill()

      // 图标文字（深蓝）
      ctx.setFillStyle(C.primary)
      ctx.setFontSize(14)
      ctx.textAlign = 'center'
      ctx.fillText(feat.icon, cx, y + 27)

      // 标签
      ctx.setFillStyle(C.onSurfaceVariant)
      ctx.setFontSize(13)
      ctx.fillText(feat.label, cx, y + 60)
    })
    y += 76

    // 下分隔线（软分隔符 #F0F0F0）
    ctx.setStrokeStyle('#F0F0F0')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(P, y)
    ctx.lineTo(W - P, y)
    ctx.stroke()

    // ========== 6. 底部品牌区域 ==========
    y += 20

    // 品牌 Logo 方块（深蓝色圆角）
    const logoSize = 40
    ctx.setFillStyle(C.primary)
    this._drawRoundedRect(ctx, P, y, logoSize, logoSize, 12)
    ctx.fill()
    ctx.setFillStyle(C.white)
    ctx.setFontSize(20)
    ctx.textAlign = 'center'
    ctx.fillText('🧭', P + logoSize / 2, y + 28)

    // 品牌名 "行程一下"
    ctx.setFillStyle(C.primary)
    ctx.setFontSize(28)
    ctx.textAlign = 'left'
    ctx.fillText('行程一下', P + logoSize + 12, y + 28)

    // 品牌口号
    ctx.setFillStyle(C.outline)
    ctx.setFontSize(13)
    ctx.fillText('让灵感即刻启程', P + logoSize + 12, y + 50)

    // 二维码区域（右侧）
    const qrSize = 76
    const qrX = W - P - qrSize
    const qrY = y - 4

    // 二维码白底+圆角边框
    ctx.setFillStyle(C.white)
    this._drawRoundedRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 12)
    ctx.fill()
    ctx.setStrokeStyle('#E1E3E4')
    ctx.setLineWidth(1)
    this._drawRoundedRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 12)
    ctx.stroke()

    // 绘制二维码
    ctx.drawImage('/static/images/erwei.png', qrX, qrY, qrSize, qrSize)

    // 扫码文字（二维码左侧，右对齐）
    const textX = qrX - 14
    ctx.setFillStyle(C.outline)
    ctx.setFontSize(12)
    ctx.textAlign = 'right'
    ctx.fillText('扫码开启', textX, y + 22)
    ctx.fillText('灵感之旅', textX, y + 40)

    // ========== 7. 免责声明 ==========
    ctx.setFillStyle(C.outline)
    ctx.setFontSize(11)
    ctx.textAlign = 'center'
    ctx.fillText('本行程仅供参考，出行前请核实相关信息', W / 2, H - 28)

    // ========== 8. 底部安全区 ==========
    ctx.setFillStyle(C.surface)
    ctx.fillRect(0, H - 16, W, 16)

    // 导出为 Promise
    return new Promise((resolve, reject) => {
      ctx.draw(false, () => {
        setTimeout(() => {
          uni.canvasToTempFilePath({
            canvasId: this.canvasId,
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => reject(err)
          }, this.instance)
        }, 600)
      })
    })
  }
}
