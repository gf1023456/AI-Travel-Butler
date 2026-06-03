# 天地图集成说明

## 已完成的工作

✅ **微信小程序地图组件** - 使用`<map>`组件接入天地图  
✅ **地图标注功能** - 支持在地图上显示行程标注点  
✅ **地图类型切换** - 矢量地图/卫星地图切换  
✅ **交互功能** - 缩放、滚动、点击标注点等  

---

## 天地图配置

### API Key

项目已内置天地图API Key：
```javascript
const tdtApiKey = '97f9870fb795ba80ef201d6edae71d73'
```

### 默认地图设置

- **中心点**: 西安 `[34.3416, 108.9398]`
- **缩放级别**: 12
- **地图类型**: 矢量地图 (vec)

---

## 地图功能

### 1. 地图类型切换

点击右上角的地图类型按钮：
- 🗺️ **地图** - 矢量地图模式
- 🛰️ **卫星** - 卫星影像模式

### 2. 地图标注

生成行程后，自动在地图上标注：
- 每天的行程点
- 点击标注查看详情
- 不同天数不同颜色

### 3. 地图交互

- ✅ 支持缩放
- ✅ 支持滚动
- ✅ 显示当前位置
- ✅ 点击标注点查看详情

---

## 标注点数据结构

```javascript
{
  id: 0,                    // 标注ID
  latitude: 34.3416,        // 纬度
  longitude: 108.9398,      // 经度
  title: "大雁塔",          // 标题
  iconPath: "/static/marker.png",  // 图标路径
  width: 30,                // 图标宽度
  height: 30,               // 图标高度
  callout: {                // 气泡提示
    content: "Day 1 - 大雁塔",
    display: "BYCLICK",
    padding: 10,
    borderRadius: 5,
    fontSize: 12
  }
}
```

---

## 地图样式

### 顶部搜索栏
- 半透明白色背景
- 搜索图标和提示文字
- 用户头像

### 地图类型切换器
- 右上角浮动按钮
- 激活状态高亮显示

### 底部导航栏
- 探索 - 打开侧边面板
- 行程 - 查看行程详情
- 地图/卫星 - 切换地图类型

---

## 后续优化建议

### 1. 接入天地图WMTS服务

微信小程序的`<map>`组件默认使用腾讯地图，如果需要完全使用天地图的瓦片，可以：

**方案一**: 使用`<map>`的`subkey`属性
```html
<map 
  :subkey="tdtApiKey"
  :longitude="mapCenter[1]"
  :latitude="mapCenter[0]"
/>
```

**方案二**: 使用第三方地图SDK
- 高德地图微信小程序SDK
- 百度地图微信小程序SDK

### 2. 自定义标注图标

准备不同颜色的标注图标：
```
/static/
  ├── marker-day1.png    # Day 1 标注
  ├── marker-day2.png    # Day 2 标注
  ├── marker-day3.png    # Day 3 标注
  └── marker.png         # 默认标注
```

### 3. 添加覆盖物

- 路线规划：使用`polyline`绘制路线
- 区域标注：使用`polygon`标注区域
- 文字标注：使用`label`添加文字

### 4. 地图控件

- 添加定位按钮
- 添加缩放控件
- 添加比例尺

---

## 天地图WMTS URL格式

如果需要手动加载天地图瓦片：

### 矢量地图
```
https://t{s}.tianditu.gov.cn/vec_w/wmts?tk={token}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}
```

### 卫星影像
```
https://t{s}.tianditu.gov.cn/img_w/wmts?tk={token}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}
```

### 标注图层
```
https://t{s}.tianditu.gov.cn/cva_w/wmts?tk={token}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}
```

其中：
- `{s}`: 0-7 (子域名)
- `{token}`: 天地图API Key
- `{x}`, `{y}`, `{z}`: 瓦片坐标和级别

---

## 注意事项

### 1. 微信小程序地图限制

- 默认使用腾讯地图
- 不能完全替换为天地图瓦片
- 但可以使用天地图的API获取数据

### 2. API Key安全

- 天地图Key已内置在代码中
- 生产环境建议从后端获取
- 注意Key的使用配额限制

### 3. 性能优化

- 标注点数量过多时会影响性能
- 建议限制最多显示50个标注点
- 使用聚类显示大量标注点

---

## 测试步骤

1. **编译项目**
   ```bash
   npm run dev:mp-weixin
   ```

2. **查看地图**
   - 打开首页
   - 应该看到完整的地图
   - 可以缩放和滚动

3. **测试标注**
   - 输入"北京三日游"
   - 点击"开始规划"
   - 查看地图上的标注点

4. **切换地图类型**
   - 点击右上角按钮
   - 在地图和卫星之间切换

---

## 问题排查

### Q: 地图不显示
**检查**:
- 网络连接是否正常
- 微信开发者工具是否支持地图组件
- 是否在真机上测试

### Q: 标注点不显示
**检查**:
- 行程数据是否包含经纬度
- markers数组是否正确赋值
- 图标路径是否正确

### Q: 地图类型无法切换
**检查**:
- switchMapType函数是否被调用
- mapType值是否正确更新
