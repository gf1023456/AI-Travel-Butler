# 行程一下 AI 旅行管家 — UI 设计规范

> 版本：v1.0  
> 设计原则：Apple Human Interface Guidelines（克制、留白、层次清晰、微交互精致）  
> 主色调：Intelligent Teal `#0F4C5C` / `#14B8A6`

---

## 1. 设计哲学

### 1.1 核心原则

| 原则 | 要求 |
|------|------|
| **克制（Restraint）** | 每屏只保留一个视觉焦点，移除一切无意义的装饰线、多余投影、粗重边框。色彩使用宁缺毋滥。 |
| **留白（Whitespace）** | 元素间距遵循 8pt 网格系统，内容区域四周保留充足呼吸空间，拒绝拥挤堆砌。 |
| **层次清晰（Hierarchy）** | 通过字体权重、字号阶梯、微妙灰度差异建立信息层级，而非靠花哨颜色。 |
| **微交互精致（Delight）** | 所有可交互元素必须有反馈：按压缩放、状态过渡、加载呼吸动效，时长统一 200-300ms，缓动 curve 为 `cubic-bezier(0.4, 0, 0.2, 1)`。 |

### 1.2 整体氛围

- **高级感**：像 Apple Maps + Apple Wallet 的融合——地图干净、控件轻盈、卡片通透。
- **一致性**：任何页面的顶部、按钮、卡片、列表必须遵循同一套视觉语言。
- **品牌色克制使用**：深靛青只出现在主按钮、选中态、品牌 Logo 和关键行动点上，绝不滥用作大面积背景填充。

---

## 2. 产品功能概述

> 本章节面向 UI 设计师，帮助理解「行程一下」的核心功能与用户旅程，确保设计决策与产品目标一致。

### 2.1 产品定位

「行程一下」是一款基于 AI 大模型的智能旅行规划小程序。用户通过语音或文字描述旅行需求（如"周末去杭州，带小孩，预算3000"），AI 在数秒内一键生成包含景点、餐饮、住宿、交通的完整行程方案，并支持在地图上可视化浏览。

**核心差异化**：不是传统的"查攻略"工具，而是"一句话生成专属行程"的 AI 旅行管家。

### 2.2 核心功能模块

| 模块 | 功能描述 | 对应页面 |
|------|----------|----------|
| **智能行程生成** | 用户输入需求 → AI 理解意图 → 生成多维度行程 | 首页 → 行程详情 |
| **灵感探索** | 浏览热门目的地、主题线路、季节推荐 | 灵感探索页 |
| **行程管理** | 查看 AI 生成的行程时间轴，收藏、分享、下载 | 行程详情页、历史记录页 |
| **行程细化** | 对 AI 生成的行程进行微调：替换景点、调整顺序 | 细化调整页 |
| **地图浏览** | 在地图上查看行程地点分布，卫星/标准切换 | 首页（地图页） |
| **历史记录** | 查看过往生成的行程，重新编辑、删除 | 历史记录页 |
| **用户中心** | 微信头像/昵称、用户等级、收藏管理、数据统计 | 我的页 |
| **系统设置** | 通知偏好、隐私协议、关于我们、退出登录 | 设置页 |

### 2.3 用户核心旅程

```
打开小程序 → 首页地图浏览 → 点击"生成攻略" → 输入旅行需求
                                                    ↓
保存/分享行程 ← 查看行程时间轴 ← AI 生成完整方案
       ↑
       └──── 细化调整（可选）
```

**关键触点**：
1. **首页地图**是核心入口，地图控件必须醒目但不过度抢视觉。
2. **"生成专属攻略"按钮**是最高频 CTA，必须在首页常驻且视觉突出。
3. **行程时间轴**是 AI 能力的核心展示，信息层次必须清晰。
4. **细化调整页**需要让用户感知到"AI 已生成基础方案，我可以微调"。

### 2.4 各页面设计优先级

| 页面 | 功能定位 | 优先级 | 关键注意点 |
|------|----------|--------|-----------|
| **首页（地图）** | 核心入口 + 地图浏览 + CTA | P0 | 顶栏透明，控件玻璃质感，CTA 突出 |
| **行程详情** | AI 行程展示 + 时间轴 | P0 | 时间轴节点设计清晰，状态区分明显 |
| **登录** | 微信一键登录 | P0 | 流程极简，减少用户流失 |
| **灵感探索** | 内容发现 + 激发灵感 | P1 | 卡片网格布局，图片质量高 |
| **细化调整** | 行程微调 + 人工干预 | P1 | 编辑态与查看态的视觉区分 |
| **历史记录** | 历史行程管理 | P2 | 列表简洁，支持长按操作 |
| **我的** | 用户中心 + 数据沉淀 | P2 | 头像、昵称、等级、收藏统计 |
| **设置** | 系统配置 + 隐私合规 | P2 | iOS 风格列表组，开关状态清晰 |

---

## 3. 色彩系统

### 3.1 品牌色（Brand Colors）

```
Brand Primary:    #0F4C5C  (深靛青，用于主按钮、选中态、关键图标)
Brand Secondary:  #14B8A6  (明青绿，用于渐变终点、hover 状态、强调容器)
Brand Accent:     #F59E0B  (琥珀金，用于点缀、高亮、成就徽章)
Brand Gradient:   linear-gradient(135deg, #0F4C5C 0%, #14B8A6 100%)
```

**使用规则：**
- 品牌渐变 **仅允许** 用于：主 CTA 按钮背景、底部导航选中态 pill、启动页/登录页顶部小面积装饰。
- **禁止** 将品牌渐变作为页面全屏背景、顶部导航栏背景（避免 screenshot 中那种沉闷压迫感）。

### 3.2 中性色（Neutral Colors）

```
Background Primary:   #F5F5F7  (Apple 风格浅灰白，页面全局底色)
Background Secondary: #FFFFFF  (纯白，用于卡片、浮层面板)
Background Tertiary:  #E5E5EA  (分隔、禁用状态背景)

Text Primary:         #1D1D1F  (近乎纯黑，主标题、正文)
Text Secondary:       #6E6E73  (中灰，副标题、说明文字、时间戳)
Text Tertiary:        #A1A1A6  (浅灰，占位符、禁用文字)

Separator:            rgba(0,0,0,0.08)  ( hairline 分隔线，1px )
Overlay:              rgba(0,0,0,0.32)  (模态遮罩，用于 bottom sheet )
```

### 3.3 功能色（Semantic Colors）

```
Success:  #34C759  (Apple Green)
Warning:  #FF9500  (Apple Orange)
Error:    #FF3B30  (Apple Red)
Info:     #007AFF  (Apple Blue，用于链接、次要操作)
```

### 3.4 暗色模式（Dark Mode）

```
Background Primary:   #000000
Background Secondary: #1C1C1E
Background Tertiary:  #2C2C2E
Text Primary:         #FFFFFF
Text Secondary:       #8E8E93
Text Tertiary:        #48484A
Separator:            rgba(255,255,255,0.12)
```

---

## 3. 字体与排版

### 3.1 字体栈

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', sans-serif;
```

### 3.2 字号阶梯（Type Scale）

| 层级 | 字号 | 字重 | 行高 | 字间距 | 用途 |
|------|------|------|------|--------|------|
| Display | 34px | 700 | 40px | -0.02em | 启动页大标题 |
| Title 1 | 28px | 700 | 34px | -0.02em | 页面大标题 |
| Title 2 | 22px | 600 | 28px | -0.01em | 卡片标题、Section Header |
| Title 3 | 18px | 600 | 24px | -0.01em | 列表主标题、导航栏标题 |
| Body | 16px | 400 | 24px | 0 | 正文、输入框文字 |
| Callout | 15px | 500 | 20px | 0 | 按钮文字、标签 |
| Subhead | 14px | 400 | 20px | 0 | 副标题、描述 |
| Footnote | 12px | 400 | 16px | 0.02em | 时间戳、辅助说明 |
| Caption | 11px | 500 | 13px | 0.03em | 角标、微标签 |

**排版规则：**
- 中文标题避免使用 `font-weight: 300`（过细导致可读性差），最小使用 400。
- 大标题使用负字间距，小标签使用正字间距增加呼吸感。
- 任何文本块不超过 3 种字号，保持层级简洁。

---

## 4. 布局与间距

### 4.1 安全区域（Safe Area）

- 顶部状态栏：动态读取 `statusBarHeight`
- 底部安全区：动态读取 `safeAreaBottom`
- 左右边距：统一 **20px**（小程序 rpx 按屏幕宽度 750 换算）

### 4.2 8pt 网格系统

所有间距必须是 4 的倍数：4, 8, 12, 16, 20, 24, 32, 40, 48。

### 4.3 圆角规范

```
Small:    8px   (小按钮、输入框、标签 chip)
Medium:   12px  (列表项、小卡片)
Large:    16px  (标准卡片、浮层面板)
XLarge:   20px  (大图卡片、modal)
Full:     999px (Pill 按钮、底部导航栏)
```

**规则：**
- 卡片内部图片圆角必须 ≤ 卡片圆角（如卡片 16px，图片 12px）。
- 同一容器内的元素圆角必须统一，禁止混用。

---

## 5. 组件规范

### 5.1 按钮（Buttons）

#### Primary Button（主按钮）
```
Background:   linear-gradient(135deg, #0F4C5C, #14B8A6)
Text Color:   #FFFFFF
Font:         16px / weight 600
Height:       52px
Radius:       999px (Full)
Padding:      0 24px
Shadow:       none  ← 禁止默认阴影，保持扁平高级感
Active State: opacity 0.92 + scale(0.98) 过渡 150ms
Disabled:     opacity 0.4
```

#### Secondary Button（次按钮/幽灵按钮）
```
Background:   transparent
Border:       1.5px solid #0F4C5C
Text Color:   #0F4C5C
Height:       44px
Radius:       999px
Active State: background rgba(15,76,92,0.06) + scale(0.98)
```

#### Glass Button（玻璃质感按钮 / 地图控件专用）
```
Background:   rgba(255,255,255,0.82)
Backdrop:     blur(20px) saturate(180%)
Border:       0.5px solid rgba(255,255,255,0.5)
Shadow:       0 4px 16px rgba(0,0,0,0.06)
Text Color:   #1D1D1F
Active State: background rgba(255,255,255,0.95)
Dark Mode:    background rgba(30,30,30,0.72); border rgba(255,255,255,0.12)
```

**禁止使用：**
- 直角或过小圆角（< 8px）的按钮。
- 浓重投影（如 `0 8px 32px rgba(0,0,0,0.25)`）—— 除非在深色地图上需要分离层级，否则一律轻投影。
- 透明背景 + 白色文字（如登录页旧版按钮导致看不清）。

### 5.2 卡片（Cards）

#### Standard Card
```
Background:   #FFFFFF
Radius:       16px
Padding:      16px
Shadow:       0 1px 4px rgba(0,0,0,0.04)  ← 极淡，几乎不可见
Border:       none
```

#### Elevated Card（需强调层级，如首页 Quick Card）
```
Background:   #FFFFFF
Radius:       20px
Padding:       = 16px
Shadow:       0 4px 24px rgba(0,0,0,0.08)
Border:       0.5px solid rgba(0,0,0,0.04)
```

#### Glass Card（地图浮层、模态面板）
```
Background:   rgba(255,255,255,0.75)
Backdrop:     blur(24px) saturate(180%)
Radius:       24px (top) / 20px (all)
Border:       0.5px solid rgba(255,255,255,0.4)
Shadow:       0 8px 32px rgba(0,0,0,0.12)
```

**规则：**
- 卡片与卡片之间间距 ≥ 16px。
- 卡片内图片必须带圆角，且与卡片边缘保持 ≥ 12px 内边距（或全出血但图片自身圆角）。
- 同屏最多出现 2 张重叠卡片，禁止三层以上堆叠。

### 5.3 导航栏（Navigation Bar）

#### 顶部导航栏（Top Navigation）

**方案 A：沉浸式（用于地图页）**
```
Background:   transparent  ← 直接透出地图
Text Color:   #FFFFFF (带 0.5px 文字阴影 #000000 0 1px 2px，保证任何地图底都能读)
Back Button:  36px 圆形，background rgba(0,0,0,0.35) + blur(8px)，白色箭头图标
```

**方案 B：标准式（用于列表页、设置页）**
```
Background:   #F5F5F7 (与页面底色一致，形成无边框沉浸感)
Text Color:   #1D1D1F
Title:        18px / weight 600 / 居中
Border:       none  ← 禁止底部边框线，用留白分割
```

**禁止使用截图中的大面积渐变顶栏。**

#### 底部导航栏（Bottom Tab Bar）
```
Background:       #FFFFFF (或暗色 #1C1C1E)
Height:           64px + safeAreaBottom
Shape:            全宽横条，顶部圆角 20px
Shadow:           0 -1px 8px rgba(0,0,0,0.04)
Border:           1px solid rgba(0,0,0,0.06) 顶部 hairline
Active Indicator: 品牌渐变 pill，内嵌在 tab 项中，非整个底栏变色
Icon:             24px，未选中 opacity 0.5 / 选中 opacity 1
Label:            11px / weight 500，未选中 #8E8E93 / 选中 #0F4C5C
```

### 5.4 输入框（Inputs）

```
Background:     #F5F5F7
Border:         none (默认) / 2px solid #0F4C5C (focus)
Radius:         12px
Height:         48px
Padding:        0 16px
Font:           16px / weight 400 / #1D1D1F
Placeholder:    #A1A1A6
```

**规则：**
- 禁止下划线样式输入框（过于简陋）。
- Focus 状态使用品牌色边框 + 内部背景微亮（`#FAFAFC`），而非外发光。

### 5.5 图标（Icons）

- **风格**：线性图标（Outline），2px 描边，圆角线帽（round cap & join）。
- **尺寸**：标准 24px，小图标 20px，导航栏 24px，列表左图标 20px。
- **颜色**：默认 `#6E6E73`，选中/激活 `#0F4C5C`，深色背景上统一 `#FFFFFF`。
- **禁止**：填充风格（filled）图标与线性图标混用；禁止多色图标（除品牌 Logo 外）。

---

## 6. 微交互与动效

### 6.1 缓动曲线

```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);   /* 200-300ms，常规过渡 */
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);   /* 300-400ms，页面进入 */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);   /* 150-200ms，页面退出 */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* 按钮按压回弹 */
```

### 6.2 交互规范

| 场景 | 动效 | 时长 |
|------|------|------|
| 按钮按压 | scale(0.96) + opacity 0.9 | 100ms |
| 按钮释放 | scale(1.0) 回弹 | 200ms，spring 曲线 |
| 页面进入（push） | 从右滑入 100% → 0，原页面左移 30% + 暗化 | 350ms，decelerate |
| 页面返回（pop） | 当前页右滑 100% 退出，下页左移恢复 | 250ms，accelerate |
| 卡片展开 | 高度展开 + fade in 内容 | 300ms，default |
| 底部 Sheet 弹出 | translateY(100%) → 0，背景遮罩 fade in | 350ms，decelerate |
| 列表加载 | Skeleton 呼吸动画 opacity 0.4 ↔ 0.8 | 1.5s，infinite |
| 刷新完成 | 顶部 spinner 品牌色旋转一圈后收起 | 400ms |

### 6.3 触觉反馈（Haptic Feedback）

- 按钮点击：`uni.vibrateShort({ type: 'light' })`
- 成功操作：`uni.vibrateShort({ type: 'medium' })`
- 错误/删除：`uni.vibrateLong()`

---

## 7. 各页面设计要点

### 7.1 首页（地图页）

**布局：**
```
┌─────────────────────────────────┐
│ [沉浸式顶栏 - 透明]               │  ← 仅状态栏高度 + 44px 导航区
│ 头像 行程一下 位置·天气          │  ← 白色文字 + 微阴影，左侧头像 32px 圆角
├─────────────────────────────────┤
│                                 │
│          地 图 区 域              │  ← 全屏，无内边距
│                                 │
│    ┌─────┐                      │
│    │地图 │                      │  ← 右侧玻璃控件组，竖排 48px 圆角 pill
│    │─────│                      │
│    │卫星 │                      │
│    └─────┘                      │
│        ◉                        │  ← 定位按钮，独立玻璃圆形
│                                 │
│  ┌──────────────────┐          │
│  │ 行程卡片 (Quick)   │          │  ← 底部左下，Elevated Card，圆角 20px
│  └──────────────────┘          │
│         ┌──────────────┐       │
│         │ ✨ 生成攻略    │       │  ← 底部右侧，Primary Button pill
│         └──────────────┘       │
├─────────────────────────────────┤
│  [底部 Tab Bar]                  │  ← 全宽横条，顶部圆角 20px
└─────────────────────────────────┘
```

**关键规则：**
- 顶栏 **禁止** 使用品牌渐变背景，必须透明透出地图。
- 右侧地图控件使用 **Glass Button** 规范，竖排间距 8px。
- AI Butler 按钮使用 **Primary Button** 规范，位置在地图右下角、Tab Bar 上方 16px。
- Quick Card 使用 **Elevated Card**，内部图片 12px 圆角，文字区严格遵循字号阶梯。
- 底部 Tab Bar 使用 **底部导航栏** 规范，白色底 + 品牌 pill 选中态。

### 7.2 灵感探索页（Explore）

**布局：**
- 标准顶部导航栏（方案 B），标题 "灵感探索" 居中。
- 无搜索框时，首屏直接展示内容，拒绝大段空白。
- 内容卡片网格：2 列，间距 12px，卡片圆角 16px。
- 底部悬浮 Primary Button："生成专属攻略"，全宽减去左右 20px 边距，底部 + safeArea + 16px。

### 7.3 行程详情页（Plan）

**布局：**
- 标准顶部导航栏（方案 B），左侧返回，标题居中。
- 页面主体为时间轴列表：左侧竖线 2px `#E5E5EA`，节点 8px 圆点（当前节点 `#0F4C5C`，已过去 `#A1A1A6`）。
- 每个时间节点卡片：Standard Card，内部包含时间、地点、描述、天气图标。
- 底部悬浮操作栏：分享 + 下载，使用 Glass Button 并排，底部 + safeArea + 12px。

### 7.4 登录页（Login）

**布局：**
```
┌─────────────────────────────────┐
│                                 │
│           ✕ (关闭)               │  ← 右上角 36px 玻璃圆按钮
│                                 │
│           [Logo/插画]            │  ← 页面中心偏上，占屏高 25%
│                                 │
│        行程一下                   │  ← Display 字号，#1D1D1F
│      你的智能旅行伙伴              │  ← Subhead，#6E6E73
│                                 │
│      ┌──────────────────┐       │
│      │  选择微信头像      │       │  ← 128px 圆形占位，border 2px #E5E5EA
│      │      📷           │       │  ← 右下角 36px 品牌色相机按钮
│      └──────────────────┘       │
│                                 │
│      ┌──────────────────┐       │
│      │   输入昵称        │       │  ← Input 规范，居中 placeholder
│      └──────────────────┘       │
│                                 │
│      ┌──────────────────┐       │
│      │  微信一键登录     │       │  ← Primary Button，含微信图标
│      └──────────────────┘       │
│                                 │
│    登录即代表您同意               │  ← Footnote，#A1A1A6
│    《用户协议》·《隐私政策》       │  ← Footnote，#0F4C5C 链接色
│                                 │
└─────────────────────────────────┘
```

**关键规则：**
- 背景色 `#F5F5F7`，**禁止** 使用品牌渐变作为全屏背景。
- 头像占位区未选择时显示灰色默认头像，边框 `#E5E5EA`。
- 微信登录按钮为 Primary Button，内部图标使用深靛青填充的微信图标（非白底绿标，保持品牌一致性）。

### 7.5 我的页（Mine）

**布局：**
- 标准顶部导航栏（方案 B）。
- 个人信息区：大头像 80px 圆角（无边框），昵称 Title 2，等级标签 Caption pill（品牌渐变背景，或琥珀金 `#F59E0B` 用于高亮等级）。
- 功能列表：iOS 风格列表组，每组带 8px 圆角外框（Background Secondary `#FFFFFF`），组内用 hairline 分隔。
- 列表项左图标 20px，右箭头使用 chevron 而非粗箭头。

### 7.6 设置页（Settings）

**布局：**
- 标准顶部导航栏（方案 B）。
- 全部使用 iOS 风格列表组：
  - 组标题：12px / #6E6E73 / 全大写 / 左侧对齐 / 上下 padding 8px 20px。
  - 组容器：白色背景，16px 圆角，左右 margin 20px。
  - 列表项高度 52px，左侧图标 20px + 标题 16px，右侧开关/箭头/值。
- 底部危险操作（退出登录）：红色文字，独立成组，无图标。

---

## 8. 图标规范清单

| 图标名 | 风格 | 尺寸 | 颜色 | 使用场景 |
|--------|------|------|------|----------|
| back | outline | 24px | #FFFFFF(深色底) / #0F4C5C(浅色底) | 返回 |
| location | outline | 20px | #0F4C5C | 位置标记 |
| star | outline | 24px | #0F4C5C | 收藏、AI 标识 |
| bell | outline | 24px | #0F4C5C | 通知 |
| edit | outline | 20px | #0F4C5C | 编辑 |
| close | outline | 24px | #6E6E73 | 关闭、删除 |
| trash | outline | 20px | #FF3B30 | 删除行程 |
| refresh | outline | 20px | #0F4C5C | 刷新 |
| clock | outline | 20px | #6E6E73 | 时间 |
| paperplane | outline | 20px | #0F4C5C | 分享 |
| list | outline | 20px | #0F4C5C | 列表 |
| download | outline | 20px | #0F4C5C | 下载 |
| phone | outline | 20px | #0F4C5C | 手机 |
| lock | outline | 20px | #0F4C5C | 隐私、安全 |
| moon | outline | 20px | #0F4C5C | 深色模式 |
| info | outline | 20px | #6E6E73 | 关于、版本 |
| flag | outline | 20px | #0F4C5C | 协议、推送 |
| image | outline | 20px | #0F4C5C | 缓存、相册 |
| folder | outline | 20px | #0F4C5C | 存储 |
| chat | outline | 20px | #0F4C5C | 客服、反馈 |
| mic | outline | 24px | #0F4C5C | 语音输入 |
| wechat | filled | 20px | #0F4C5C | 微信登录按钮内 |
| map | outline | 24px | #0F4C5C | 地图模式 |
| search | outline | 24px | #0F4C5C | 搜索 |
| chevron-right | outline | 20px | #A1A1A6 | 列表箭头 |
| checkmark | outline | 20px | #0F4C5C | 选中、完成 |

---

## 9. 禁止清单（Don'ts）

1. **禁止** 在浅色页面使用品牌渐变作为大面积背景（如登录页全屏渐变、顶栏渐变）。唯一例外：登录页顶栏下方可有一条极细（1px）品牌渐变装饰线，宽度 60%，居中。
2. **禁止** 使用直角或 2px 以下圆角的按钮和卡片。
3. **禁止** 按钮使用浓重投影（`rgba(0,0,0,0.2)` 以上）。
4. **禁止** 在白色/浅色背景上使用白色文字。
5. **禁止** 同页面混用 filled 和 outline 两种图标风格。
6. **禁止** 导航栏使用底部边框线（1px border），应用留白或背景色差异分割。
7. **禁止** 列表项高度低于 48px，保证触控区域。
8. **禁止** 加载状态使用旋转菊花（spinner）以外的全屏遮罩，优先使用 Skeleton 或局部刷新。
9. **禁止** 暗色模式下直接使用纯白 `#FFFFFF` 作为大面积背景，应使用 `#1C1C1E`。
10. **禁止** 任何元素无交互反馈（hover、active、disabled 必须有三态区分）。

---

## 10. 交付检查表

- [ ] 所有页面顶部导航栏风格统一（透明 or 标准）。
- [ ] 所有按钮符合 Primary / Secondary / Glass 三类规范之一。
- [ ] 所有卡片圆角、阴影、间距一致。
- [ ] 所有图标风格统一（outline，2px 描边）。
- [ ] 所有文字遵循 Type Scale，无随意字号。
- [ ] 暗色模式下所有颜色已反转，无 hardcode 的黑白值。
- [ ] 所有可点击元素有 active/hover 状态。
- [ ] 页面切换动效统一（slide + fade）。
- [ ] 无 console 样式警告，无 uni-icons 残留。
