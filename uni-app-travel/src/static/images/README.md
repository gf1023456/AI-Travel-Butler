# 图标占位符说明

## 需要手动添加的图标文件

请将以下图标文件放置到此目录：

### 必需图标

1. **avatar.png** - 用户头像
   - 尺寸: 70x70px
   - 建议: 圆形或圆角方形
   - 可以在代码中使用默认头像URL替代

2. **marker.png** - 地图标注图标
   - 尺寸: 30x30px
   - 建议: 红色地图标注样式
   - 可以使用emoji 📍 临时替代

### 可选图标（按天数区分颜色）

3. **marker-day1.png** - Day 1 标注（红色 #FF6B6B）
4. **marker-day2.png** - Day 2 标注（青色 #4ECDC4）
5. **marker-day3.png** - Day 3 标注（蓝色 #45B7D1）
6. **marker-day4.png** - Day 4 标注（橙色 #FFA07A）
7. **marker-day5.png** - Day 5 标注（绿色 #98FB98）

## 临时解决方案

### 方案1: 使用在线头像
修改 `src/pages/index/index.vue`:
```vue
<image src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" mode="aspectFill" />
```

### 方案2: 使用emoji标注
修改标注配置，不设置iconPath:
```javascript
{
  id: index,
  latitude: item.lat,
  longitude: item.lng,
  title: item.name,
  // 不设置 iconPath，使用默认标注
  callout: {
    content: `${item.day} - ${item.name}`,
    display: 'BYCLICK'
  }
}
```

### 方案3: 使用base64图标
在代码中使用base64编码的简单图标

## 图标资源推荐网站

1. **IconFont** - https://www.iconfont.cn/
   - 阿里巴巴矢量图标库
   - 免费下载PNG/SVG格式

2. **Iconify** - https://iconify.design/
   - 超过10万个开源图标
   - 支持多种格式导出

3. **Flaticon** - https://www.flaticon.com/
   - 免费矢量图标
   - 需要标注来源

4. **Icons8** - https://icons8.com/
   - 统一风格的图标集
   - 支持多种尺寸

## 快速生成图标

使用在线工具快速生成：
- **Favicon Generator** - 生成多种尺寸图标
- **Canva** - 在线设计工具
- **Figma** - 专业设计工具
