# 微信AI SKILL 接入实战指南

最近微信AI开放了SKILL能力，你的小程序可以被微信的AI助手直接调用。用户在AI对话框里说一句话，你的小程序就能弹出一张卡片，点一下直接跳出详情页。

这个入口的价值有多大？微信的AI对话框，相当于给你的小程序开了一个「免安装」的流量入口，用户不需要先打开你的小程序，AI直接帮他用了你的服务。

我完整走了一遍接入流程，把每个步骤和踩过的坑记下来。如果你也想接，对着这篇东西来就行。

---

但在动手之前，先说清楚一件事。

微信AI目前还没有全量开放。你需要先在微信公众平台申请接入微信AI能力，审核通过之后，你的小程序才有权限使用SKILL。如果你还没有申请，可以到微信公众平台的「功能」-「微信AI」里提交申请。这不是什么高门槛，但需要一个流程，不是开了小程序就能直接用的。

好，当你已经拿到了接入资格，我们正式开始。

微信AI的SKILL是跑在独立分包里的。什么叫独立分包？就是它不依赖主包，可以独立加载和发布。因为AI调起你的组件时，主包可能根本没加载，所以SKILL必须是一个独立分包。

这是微信的硬性要求，没有商量余地。

所以第一步，打开你的manifest.json，加上独立分包配置

```json
// manifest.json
{
  "subPackages": [{
    "root": "ai-skill/my-skill/",
    "name": "my-skill",
    "independent": true
  }]
}
```

root就是你的SKILL代码放的目录，name是分包名字，independent: true 表示这是独立分包。这步很简单，但你如果漏了independent，后面全部白搭。

---

分包配好之后，第二步是写mcp.json。这是微信AI的元信息配置文件，定义了你的SKILL叫什么名字，组件在哪儿。

```json
// ai-skill/my-skill/mcp.json
{
  "componentPath": "components/my-card/index",
  "components": [{
    "name": "my-card",
    "path": "components/my-card/index"
  }]
}
```

这里有一个极其容易踩的坑，注意看componentPath的值。

**必须写成 components/my-card/index，而不是 components/my-card。**

那个/index后缀不能省。我之前搜遍了微信的官方文档没找到这句，最后在技术社群里翻到一条老帖子才解决。不写/index的话，独立分包加载的时候路径匹配不上，直接白屏，没有任何错误提示。

我说实话，这个坑花了我大半天。希望你不要重复。

---

第三步是写原子组件。

在微信AI里，展示给你的用户的界面叫「原子组件」。它跟普通的小程序页面有几个巨大的区别，你一开始就要知道

第一，它没有纵向滚动。原子组件的渲染引擎是微信自研的glass-easel，它跟小程序的WebView是两套东西。你在原子组件里用不了overflow:auto，也用不了scroll-view。所以展示的内容必须全部在一个屏幕内。

第二，它有宽高比限制。原子组件的最大高度和宽度是1:1。如果手机屏幕宽度是375px，那高度上限就是375px。超过的部分会被裁剪掉，没有滚动。

第三，它只支持三个事件。tap，load，error。没了。没有touch事件，没有longpress，没有input。

所以你的组件必须在这个375x375的方框里展示所有核心信息。

![原子组件容器限制](docs/images/img_atomic_limit.svg)

那该怎么设计？我自己的做法是给信息排优先级

高优先级的永远保留，低优先级的可以裁掉。我的排列顺序是

P0，CTA按钮。也就是用户点击后触发后续行为的东西。这个是用户唯一能操作的入口，必须永远在底部，不能少。

P1，头部信息。标题，标签，关键元数据。

P2，正文内容。根据你的业务来展示最关键的信息。

P3，次要内容。如果空间不够，这一层可以裁掉。

![卡片各区域优先级](docs/images/img_card_layout.svg)

原子组件的写法跟普通小程序组件基本一样，三个文件，WXML布局，WXSS样式，JS逻辑。

但WXSS这里又有一个大坑。

你的主程序可能定义了一套完整的CSS变量来做主题管理，比如

```css
:root {
  --color-primary: #0F4C5C;
  --color-on-surface: #191c1d;
}
```

这些变量在原子组件里全部失效。因为glass-easel渲染器不认识小程序WebView的CSS变量。

所以你的原子组件WXSS里，必须把色值硬编码。举个例子

```css
/* ❌ 这样不行 */
.card { background: var(--color-surface-container-lowest); }

/* ✅ 必须这样 */
.card { background: #ffffff; }
```

这个问题目前没有优雅的解法。我的建议是，在项目里单独维护一份原子组件的主题色值文档，跟主程序的主题同步更新。很笨，但管用。

---

第四步是写SKILL的注册入口。微信AI要求每个SKILL必须有一个index.js作为入口，里面调用createSkill来注册

```javascript
// ai-skill/my-skill/index.js
const { createSkill } = require('./lib/skill-sdk')

createSkill({
  name: '我的SKILL',
  description: '一句话描述你的SKILL是干什么的',
  components: [
    {
      id: 'my-card',
      version: '1.0.0'
    }
  ]
})
```

createSkill是微信AI提供的SDK方法，用来把你的SKILL注册到微信AI的系统里。name和description会用在AI的SKILL市场上，让用户知道你的SKILL能做什么。

---

第五步是处理原子组件和详情页之间的数据传递。

原子组件在AI对话框里渲染。当用户点击组件上的按钮，你需要打开小程序的详情页来展示完整内容。这时候数据怎么传过去？

微信AI提供了openDetailPage方法，用来打开小程序内的半屏页面

```javascript
// 原子组件的JS
Component({
  methods: {
    onTapViewDetail() {
      wx.setStorageSync('my_skill_data', this.data.fullData)
      wx.navigateTo({
        url: '/pages/detail/index'
      })
    }
  }
})
```

但这里有一个关键问题，原子组件的运行环境在AI对话框里，它跟小程序页面不在同一个页面栈。所以wx.navigateTo的URL必须指向你主包或者分包里的真实页面路径。

数据传递的话，用wx.setStorageSync是可行的。原子组件和小程序共享同一个本地存储空间。存入之后，详情页用wx.getStorageSync就能读到。

不过我建议加一个兜底读取链，防止数据被覆盖。详情页读取数据时，按这个优先级来

先从全局状态读，如果空了就从历史列表读，再空了从localStorage读。这样即使数据被新请求覆盖了，用户从历史记录里打开旧方案也能看到内容。

![数据流向](docs/images/img_data_flow.svg)

---

第六步是构建和测试。

微信AI的SKILL需要被打包到小程序的分包里。以uni-app为例，构建命令和平常一样

```
npm run build:mp-weixin
```

构建完成后，打开微信开发者工具，导入dist/build/mp-weixin目录。开发者工具里会有一个「AI」相关的调试面板，可以用来测试你的原子组件渲染效果。

![完整接入流程](docs/images/img_flow_complete.svg)

---

总结一下，接入微信AI需要做的事按照顺序就是

第一，manifest.json配置独立分包，加上independent: true。

第二，mcp.json配组件路径，记得带/index后缀。

第三，写原子组件，记住三个限制，无滚动，1:1比例，三事件。

第四，CSS色值要硬编码，CSS变量传不进去。

第五，SKILL注册入口调createSkill。

第六，原子组件到详情页的数据用localStorage桥接，做好兜底。

第七，构建后用开发者工具测试。

微信AI的SKILL能力虽然还在beta，但架构设计得还不错。独立分包保证了SKILL和主程序可以独立迭代，原子组件的限制虽然让你不能想做什么就做什么，但也保证了用户体验的一致性和安全性。

最后补充一句。本文基于 uni-app Vue 3 和 2026年中的微信AI SDK 版本编写。微信AI仍在快速迭代，具体的API签名和配置字段可能会更新，建议以微信官方文档为最终依据。

另外说一个我对这件事的判断，AI-native的小程序交互方式，会是接下来两三年一个很大的变量。用户不再是「搜索小程序、打开、使用」，而是「跟AI说一句话，AI帮你调服务」。这个转变的意义，可能比我们想象的要大。

以上，既然看到这里了，如果觉得不错，随手点个赞，在看，转发三连吧，如果想第一时间收到推送，也可以给我个星标⭐～

谢谢你看我的文章，我们，下次再见。

> / 作者：史塔克AI
> / 投稿或爆料，请联系公众号: 史塔克AI
