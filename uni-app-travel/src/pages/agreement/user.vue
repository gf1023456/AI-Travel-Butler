<template>
  <view class="agreement-page">
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="title">用户协议</text>
      <view class="placeholder"></view>
    </view>
    <scroll-view class="content" scroll-y>
      <view class="section">
        <text class="section-title">一、服务条款的确认及接受</text>
        <text class="section-text">
          欢迎您使用"行程一下"小程序服务（以下简称"本服务"）。本服务由我们（以下简称"我们"或"平台"）提供。请您在使用本服务前仔细阅读本用户协议（以下简称"本协议"）。当您点击"同意"或实际使用本服务时，即视为您已充分阅读、理解并接受本协议的全部内容。
        </text>
      </view>

      <view class="section">
        <text class="section-title">二、服务内容及使用规则</text>
        <text class="section-text">
          1. 本服务为用户提供智能行程规划、旅行建议、景点推荐等功能。
        </text>
        <text class="section-text">
          2. 用户在使用本服务时，应遵守国家法律法规，不得利用本服务从事违法违规活动。
        </text>
        <text class="section-text">
          3. 用户应保证提供的个人信息真实、准确、完整，并及时更新。
        </text>
        <text class="section-text">
          4. 用户不得恶意注册、虚假注册，不得冒用他人身份信息。
        </text>
      </view>

      <view class="section">
        <text class="section-title">三、账号管理</text>
        <text class="section-text">
          1. 用户在使用本服务前需要注册账号。用户注册成功后，将获得一个账号及相应的密码。
        </text>
        <text class="section-text">
          2. 用户应妥善保管账号和密码，因用户保管不善导致的账号被盗、密码泄露等风险及损失由用户自行承担。
        </text>
        <text class="section-text">
          3. 用户发现账号被他人非法使用或存在安全漏洞时，应立即通知我们。
        </text>
      </view>

      <view class="section">
        <text class="section-title">四、知识产权</text>
        <text class="section-text">
          1. 本服务中的所有内容，包括但不限于文字、图片、音频、视频、软件、程序、页面设计、版面设计等，均受知识产权法律保护。
        </text>
        <text class="section-text">
          2. 未经我们书面许可，用户不得复制、传播、修改、改编、翻译、汇编或以其他方式使用本服务的任何内容。
        </text>
      </view>

      <view class="section">
        <text class="section-title">五、免责声明</text>
        <text class="section-text">
          1. 本服务提供的行程规划建议仅供参考，用户应根据实际情况自行判断和决策。
        </text>
        <text class="section-text">
          2. 因不可抗力、系统故障、网络原因等导致的服务中断或数据丢失，我们不承担责任。
        </text>
        <text class="section-text">
          3. 用户在使用本服务过程中产生的任何直接或间接损失，我们不承担责任，除非该损失由我们的故意或重大过失造成。
        </text>
      </view>

      <view class="section">
        <text class="section-title">六、协议的修改</text>
        <text class="section-text">
          我们有权根据需要修改本协议。修改后的协议将在本服务中公布，用户继续使用本服务即视为接受修改后的协议。
        </text>
      </view>

      <view class="section">
        <text class="section-title">七、法律适用与争议解决</text>
        <text class="section-text">
          1. 本协议的订立、执行和解释及争议的解决均适用中华人民共和国法律。
        </text>
        <text class="section-text">
          2. 因本协议引起的或与本协议有关的任何争议，双方应友好协商解决；协商不成的，任何一方均可向有管辖权的人民法院提起诉讼。
        </text>
      </view>

      <view class="section">
        <text class="section-title">八、其他</text>
        <text class="section-text">
          1. 本协议自用户点击"同意"之日起生效。
        </text>
        <text class="section-text">
          2. 如本协议的任何条款被认定为无效或不可执行，该条款应被视为可分割的，不影响其他条款的效力。
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
