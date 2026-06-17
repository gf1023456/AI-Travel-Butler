# 微信小程序完整登录流程实现

## 📋 问题分析

### 当前问题
1. **登录流程不完整**：只获取了 openid，没有获取用户昵称、头像和手机号
2. **后端返回数据不完整**：`/api/userInfo` 接口没有返回手机号
3. **前端显示问题**："我的"页面显示硬编码的默认值

### 正确的微信小程序登录流程

根据微信官方文档，完整的登录流程应该是：

```
1. wx.login() → 获取 code
2. 使用 code 换取 openid + session_key（后端完成）
3. getUserProfile() → 获取头像和昵称（用户授权）
4. getPhoneNumber() → 获取手机号（用户授权）
5. 将所有信息发送到后端保存到数据库
```

## 🔧 已完成的修改

### 前端修改

#### 1. 登录页面优化

**文件**：`src/pages/login/index.vue`

**修改内容**：

✅ **添加详细的登录流程日志**
```javascript
// 步骤1: 获取微信登录code
const loginCode = await new Promise((resolve, reject) => {
  uni.login({
    provider: 'weixin',
    success: (res) => {
      console.log('[Login] ✅ 获取微信code成功')
      resolve(res.code)
    }
  })
})

// 步骤2: 获取用户头像和昵称
const userProfile = await new Promise((resolve) => {
  uni.getUserProfile({
    desc: '用于完善用户资料',
    success: (res) => {
      resolve({
        nickname: res.userInfo.nickName,
        avatar_url: res.userInfo.avatarUrl
      })
    }
  })
})

// 步骤3: 获取手机号（通过按钮授权）
// 在按钮上绑定 open-type="getPhoneNumber"
```

✅ **添加手机号授权按钮**
```vue
<button 
  class="wechat-login-btn" 
  @click="handleWechatLogin"
  open-type="getPhoneNumber"
  @getphonenumber="onGetPhoneNumber"
>
  <text class="btn-icon material-symbols-outlined">chat</text>
  <text>微信一键登录</text>
</button>
```

✅ **添加手机号处理函数**
```javascript
const onGetPhoneNumber = async (e) => {
  if (e.detail.errMsg === 'getPhoneNumber:ok') {
    // 用户同意授权
    phoneNumber.value = e.detail.code
    phoneEncryptedData.value = e.detail.encryptedData
    phoneIv.value = e.detail.iv
  }
}
```

✅ **传递完整用户信息到后端**
```javascript
const loginData = await wechatLogin({
  nickname: userInfo.nickname,
  avatar_url: userInfo.avatar_url,
  phone_code: phoneNumber.value,
  encrypted_data: phoneEncryptedData.value,
  iv: phoneIv.value
})
```

#### 2. "我的"页面优化

**文件**：`src/pages/mine/index.vue`

**修改内容**：

✅ **优化昵称默认值**
```vue
<!-- 修改前 -->
<text class="profile-name">{{ userInfo.nickname || 'Julian Rhodes' }}</text>

<!-- 修改后 -->
<text class="profile-name">{{ userInfo.nickname || '微信用户' }}</text>
```

✅ **保留自定义导航栏**
- 恢复底部5按钮导航栏
- 修改 switchTab 为 reLaunch

#### 3. API 接口优化

**文件**：`src/api/user.js`

✅ **修复 API 路径**
```javascript
// 修改前
const data = await get('/user/info', {})

// 修改后
const data = await get('/userInfo', {})
```

### 后端修改

#### 1. 更新登录请求模型

**文件**：`python_server/routes/user.py`

```python
class LoginRequest(BaseModel):
    code: str  # 微信wx.login返回的code
    user_info: Optional[dict] = None  # 用户信息 {nickname, avatar_url}
    # 手机号相关（可选）
    phone_code: Optional[str] = None  # 手机号授权code
    encrypted_data: Optional[str] = None  # 加密数据
    iv: Optional[str] = None  # 加密算法初始向量
```

#### 2. 更新登录路由

**文件**：`python_server/routes/user.py`

```python
@router.post("/login")
async def login(request: LoginRequest):
    result = await wechat_login(
        code=request.code,
        user_info=request.user_info,
        phone_code=request.phone_code,
        encrypted_data=request.encrypted_data,
        iv=request.iv
    )
```

#### 3. 完善登录核心逻辑

**文件**：`python_server/auth/wechat.py`

✅ **添加手机号解密函数**
```python
def decrypt_phone_number(session_key: str, encrypted_data: str, iv: str) -> str:
    """解密微信手机号"""
    phone_info = decrypt_wechat_data(session_key, encrypted_data, iv)
    return phone_info.get('purePhoneNumber') or phone_info.get('phoneNumber')
```

✅ **更新 wechat_login 函数**
```python
async def wechat_login(code: str, user_info: dict = None, 
                      phone_code: str = None, 
                      encrypted_data: str = None, 
                      iv: str = None) -> dict:
    # 获取 openid
    wechat_data = await get_wechat_session(code)
    session_key = wechat_data['session_key']
    
    # 解密手机号
    phone = None
    if phone_code and encrypted_data and iv:
        phone = decrypt_phone_number(session_key, encrypted_data, iv)
    
    # 创建/更新用户（包含手机号）
    user = User(
        nickname=user_info.get('nickname'),
        avatar_url=user_info.get('avatar_url'),
        phone=phone,  # 保存手机号
        ...
    )
    
    return {
        'user_id': user_id,
        'phone': phone,  # 返回手机号
        ...
    }
```

#### 4. 更新用户信息接口

**文件**：`python_server/routes/user.py`

```python
@router.get("/userInfo")
async def get_user_info(authorization: str = Header(None)):
    return {
        "code": 0,
        "data": {
            "id": user.id,
            "nickname": user.nickname,
            "avatar_url": user.avatar_url,
            "phone": user.phone,  # 添加手机号
            "gender": user.gender,
            ...
        }
    }
```

## 📊 数据库模型

数据库模型已包含手机号字段，无需修改：

```python
class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    openid = Column(String(128), unique=True, nullable=False)
    nickname = Column(String(100))
    avatar_url = Column(String(500))
    phone = Column(String(20))  # ✅ 已存在
    gender = Column(SmallInteger, default=0)
    ...
```

## 🚀 测试步骤

### 步骤1：重启后端服务

```bash
cd e:\ai-travel\AI-Travel-Butler\python_server
python app.py
```

查看启动日志，确认配置正确：
```
[WeChat Config] 环境变量 WECHAT_APPID: 已设置
[WeChat Config] 环境变量 WECHAT_SECRET: 已设置
```

### 步骤2：重新编译前端

```bash
cd e:\ai-travel\AI-Travel-Butler\uni-app-travel
npm run dev:mp-weixin
```

### 步骤3：清除微信开发者工具缓存

1. 完全关闭微信开发者工具
2. 重新打开
3. 点击 **工具** → **清除缓存** → **清除全部缓存**
4. 重新导入项目：`dist\dev\mp-weixin`

### 步骤4：测试完整登录流程

1. **打开登录页面**
   - 点击"微信一键登录"按钮

2. **授权用户信息**
   - 弹出授权对话框："用于完善用户资料"
   - 点击"允许"

3. **授权手机号**
   - 弹出手机号授权对话框
   - 点击"允许"

4. **查看控制台日志**
   ```
   [Login] === 开始微信登录流程 ===
   [Login] ✅ 获取微信code成功: 071xxx...
   [Login] 📸 尝试获取用户头像和昵称...
   [Login] ✅ getUserProfile 成功: {nickName: "xxx", avatarUrl: "https://..."}
   [Login] 📱 尝试获取手机号...
   [Login] 🚀 调用后端登录接口...
   [Login] ✅ 后端登录成功: {userId: 1, hasToken: true}
   [Login] 💾 用户信息已保存到本地存储
   [Login] ✅ 配额获取成功
   ```

5. **查看后端日志**
   ```
   [Login] 收到登录请求: code=071...
   [Login] user_info: {'nickname': 'xxx', 'avatar_url': 'https://...'}
   [Login] phone_code: 已提供
   [WeChat] appid=wx..., code=071...
   [Login] 开始解密手机号...
   [Login] ✅ 手机号解密成功: 138****1234
   [Login] 登录成功: user_id=1
   ```

6. **查看"我的"页面**
   - 应该显示微信昵称（不是"微信用户"）
   - 应该显示微信头像
   - 配额信息正常

### 步骤5：验证后端接口

使用 Postman 或 curl 测试：

```bash
# 1. 登录
curl -X POST http://127.0.0.1:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "code": "你的code",
    "user_info": {
      "nickname": "测试用户",
      "avatar_url": "https://example.com/avatar.jpg"
    },
    "phone_code": "手机号code",
    "encrypted_data": "加密数据",
    "iv": "加密向量"
  }'

# 预期响应：
{
  "code": 0,
  "data": {
    "user_id": 1,
    "openid": "xxx",
    "access_token": "xxx",
    "phone": "138****1234"
  },
  "msg": "登录成功"
}

# 2. 获取用户信息
curl http://127.0.0.1:8787/api/userInfo \
  -H "Authorization: Bearer 你的token"

# 预期响应：
{
  "code": 0,
  "data": {
    "id": 1,
    "nickname": "测试用户",
    "avatar_url": "https://example.com/avatar.jpg",
    "phone": "138****1234",
    "gender": 0,
    ...
  },
  "msg": "获取成功"
}
```

## ⚠️ 注意事项

### 1. 手机号授权限制

- 手机号授权**必须在 button 组件上**绑定 `@getphonenumber` 事件
- 用户点击按钮时才会触发授权弹窗
- 每次登录都需要重新授权（微信安全策略）

### 2. 数据解密

- 手机号使用 AES-CBC 解密
- 需要 `session_key`、`encrypted_data`、`iv` 三个参数
- 已安装 `pycryptodome` 库支持解密

### 3. 用户授权

- `getUserProfile` 和 `getPhoneNumber` 都需要用户主动授权
- 用户拒绝授权时，提供降级方案（使用默认值）
- 不强制要求授权，用户可以跳过

### 4. 数据库

- 手机号字段 `phone` 已存在于数据库模型中
- 如果是新数据库，需要运行迁移创建表
- 如果是已有数据库，字段已存在，无需迁移

## 📝 常见问题

### Q1: 手机号授权弹窗不出现？

**A**: 检查：
1. 按钮是否添加了 `open-type="getPhoneNumber"`
2. 是否绑定了 `@getphonenumber` 事件
3. 小程序 AppID 是否已认证（未认证的小程序无法获取手机号）

### Q2: 手机号解密失败？

**A**: 检查：
1. `session_key` 是否正确
2. `encrypted_data` 和 `iv` 是否完整传递
3. `pycryptodome` 库是否已安装：`pip install pycryptodome`

### Q3: 用户信息还是空的？

**A**: 检查：
1. 是否调用了 `getUserProfile`
2. 用户是否点击了"允许"授权
3. 后端是否收到 `user_info` 参数
4. 数据库是否正确保存

### Q4: 底部还有两个导航栏？

**A**: 清除微信开发者工具缓存，重新导入项目。

## 🎯 后续优化建议

1. **手机号显示脱敏**
   - 前端显示：`138****1234`
   - 后端存储：完整手机号

2. **用户资料完善度**
   - 显示资料完整度进度条
   - 引导用户补充信息

3. **授权状态管理**
   - 记录用户授权状态
   - 提供重新授权入口

4. **登录流程优化**
   - 添加加载动画
   - 优化错误提示
   - 支持一键登录+手机号组合

5. **用户体验**
   - 登录成功后显示欢迎语
   - 首次登录引导完善资料

现在请按照测试步骤验证功能！🎉
