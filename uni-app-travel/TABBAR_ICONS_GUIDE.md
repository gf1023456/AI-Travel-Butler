# tabBar 图标说明

## 📋 当前状态

✅ 已配置为**纯文字模式**，无需图标即可正常运行

图标文件位置：`src/static/tabbar/`

## 🎨 如何添加图标（可选）

### 方案一：使用在线工具生成（推荐）

1. 访问 [IconFont](https://www.iconfont.cn/) 或 [Flaticon](https://www.flaticon.com/)
2. 搜索并下载以下图标：
   - 探索：指南针/探索相关图标
   - 我的：用户/个人资料图标
3. 导出为 PNG 格式，尺寸 **81x81 像素**
4. 保存到 `src/static/tabbar/` 目录，命名为：
   - `explore.png` （未选中）
   - `explore-active.png` （选中，蓝色）
   - `mine.png` （未选中）
   - `mine-active.png` （选中，蓝色）

### 方案二：使用设计软件

使用 Figma、Sketch、Photoshop 等工具创建：
- 尺寸：81x81 像素
- 格式：PNG（透明背景）
- 颜色：
  - 未选中：`#7A7E83`（灰色）
  - 选中：`#1E40AF`（蓝色）

### 方案三：使用脚本生成（需要安装 canvas）

```bash
# 安装依赖
npm install canvas

# 运行脚本
node generate-tabbar-png-icons.js
```

## 📝 图标规范

| 属性 | 值 |
|------|-----|
| 尺寸 | 81x81 像素 |
| 格式 | PNG |
| 背景 | 透明 |
| 未选中颜色 | #7A7E83 |
| 选中颜色 | #1E40AF |

## 🔧 启用图标

当你准备好图标文件后，修改 `src/pages.json` 中的 tabBar 配置：

```json
{
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",
        "iconPath": "static/tabbar/explore.png",
        "selectedIconPath": "static/tabbar/explore-active.png",
        "text": "探索"
      },
      {
        "pagePath": "pages/mine/index",
        "iconPath": "static/tabbar/mine.png",
        "selectedIconPath": "static/tabbar/mine-active.png",
        "text": "我的"
      }
    ]
  }
}
```

## ✅ 验证

重新编译项目后，在微信开发者工具中查看底部导航栏是否正常显示。
