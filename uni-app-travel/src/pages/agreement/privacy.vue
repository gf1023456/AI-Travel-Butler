<template>
  <view class="agreement-page">
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="title">隐私政策</text>
      <view class="placeholder"></view>
    </view>
    <scroll-view class="content" scroll-y>
      <view class="section">
        <text class="section-title">引言</text>
        <text class="section-text">
          "行程一下"（以下简称"我们"或"平台"）非常重视用户的隐私保护。本隐私政策旨在向您说明我们如何收集、使用、存储和保护您的个人信息。请您在使用我们的服务前仔细阅读本政策。
        </text>
      </view>

      <view class="section">
        <text class="section-title">一、信息收集</text>
        <text class="section-text">
          1. 我们收集的信息类型：
        </text>
        <text class="section-text">
          • 基本信息：微信昵称、头像、OpenID等微信授权信息
        </text>
        <text class="section-text">
          • 使用信息：您使用本服务时的操作记录、搜索记录、行程规划记录等
        </text>
        <text class="section-text">
          • 设备信息：设备型号、操作系统版本、网络状态等
        </text>
        <text class="section-text">
          2. 信息收集方式：
        </text>
        <text class="section-text">
          • 您主动提供的信息
        </text>
        <text class="section-text">
          • 您使用服务时系统自动收集的信息
        </text>
      </view>

      <view class="section">
        <text class="section-title">二、信息使用</text>
        <text class="section-text">
          我们使用您的信息用于以下目的：
        </text>
        <text class="section-text">
          1. 提供、维护和改进我们的服务
        </text>
        <text class="section-text">
          2. 个性化推荐行程规划和旅游建议
        </text>
        <text class="section-text">
          3. 处理您的反馈和客服请求
        </text>
        <text class="section-text">
          4. 发送服务通知和更新信息
        </text>
        <text class="section-text">
          5. 防止欺诈和滥用行为，保障服务安全
        </text>
      </view>

      <view class="section">
        <text class="section-title">三、信息共享</text>
        <text class="section-text">
          1. 我们不会将您的个人信息出售给任何第三方。
        </text>
        <text class="section-text">
          2. 在以下情况下，我们可能会共享您的信息：
        </text>
        <text class="section-text">
          • 经您明确同意
        </text>
        <text class="section-text">
          • 与我们的服务提供商合作，且仅限于提供服务所必需的范围
        </text>
        <text class="section-text">
          • 根据法律法规要求或政府机关的合法要求
        </text>
        <text class="section-text">
          • 为保护我们的合法权益或用户的人身财产安全
        </text>
      </view>

      <view class="section">
        <text class="section-title">四、信息存储与保护</text>
        <text class="section-text">
          1. 我们采取合理的安全措施保护您的个人信息，防止信息泄露、丢失或被滥用。
        </text>
        <text class="section-text">
          2. 您的个人信息将存储在安全的服务器上，并在实现本政策所述目的所需的期限内保留。
        </text>
        <text class="section-text">
          3. 尽管我们努力保护您的信息安全，但互联网传输无法保证100%安全，请您理解。
        </text>
      </view>

      <view class="section">
        <text class="section-title">五、您的权利</text>
        <text class="section-text">
          您对自己的个人信息享有以下权利：
        </text>
        <text class="section-text">
          1. 访问权：您有权查看我们持有的关于您的个人信息
        </text>
        <text class="section-text">
          2. 更正权：您有权更正不准确的个人信息
        </text>
        <text class="section-text">
          3. 删除权：在符合法律规定的情况下，您有权要求删除您的个人信息
        </text>
        <text class="section-text">
          4. 撤回同意权：您有权随时撤回对我们处理您个人信息的同意
        </text>
      </view>

      <view class="section">
        <text class="section-title">六、Cookie及类似技术</text>
        <text class="section-text">
          我们可能使用Cookie及类似技术来改善您的使用体验、分析服务使用情况。您可以通过浏览器设置管理Cookie偏好。
        </text>
      </view>

      <view class="section">
        <text class="section-title">七、未成年人保护</text>
        <text class="section-text">
          我们的服务主要面向成年人。如果您是未成年人，请在父母或监护人的指导下使用我们的服务。
        </text>
      </view>

      <view class="section">
        <text class="section-title">八、政策更新</text>
        <text class="section-text">
          我们可能会不时更新本隐私政策。更新后的政策将在本服务中公布，重大变更时我们会另行通知您。继续使用我们的服务即表示您接受更新后的政策。
        </text>
      </view>

      <view class="section">
        <text class="section-title">九、联系我们</text>
        <text class="section-text">
          如果您对本隐私政策有任何疑问或建议，或希望行使您的权利，请通过以下方式联系我们：
        </text>
        <text class="section-text">
          邮箱：privacy@xingchen.com
        </text>
      </view>

      <view class="footer">
        <text class="footer-text">最后更新日期：2026年6月8日</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.agreement-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #0a3341 0%, #0F4C5C 40%, #134e5e 70%, #0D9488 100%);
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 48px 24px 16px;
  position: sticky;
  top: 0;
  background: linear-gradient(160deg, #0a3341 0%, #0F4C5C 100%);
  z-index: 10;
}

.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 20px;
  color: rgba(255,255,255,0.8);
}

.title {
  font-size: 18px;
  font-weight: 500;
  color: #ffffff;
  letter-spacing: 0.1em;
}

.placeholder {
  width: 32px;
}

.content {
  flex: 1;
  padding: 24px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 15px;
  font-weight: 500;
  color: #14B8A6;
  margin-bottom: 12px;
  display: block;
  line-height: 1.5;
}

.section-text {
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  line-height: 1.8;
  display: block;
  margin-bottom: 8px;
}

.footer {
  padding: 32px 0;
  text-align: center;
}

.footer-text {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}
</style>
