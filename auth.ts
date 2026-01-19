
/**
 * Authentication Module
 * 处理登录、登出、API模拟及 Session 管理
 */

const AUTH_KEY = 'travel_pro_session';

const getEl = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * 模拟 API 接口层 (预留后端对接)
 */
const api = {
  // 模拟发送验证码
  async sendCode(phone: string) {
    console.log(`[Auth API] Sending code to ${phone}`);
    return new Promise(resolve => setTimeout(resolve, 800));
  },
  // 模拟手机号登录
  async loginWithPhone(phone: string, code: string) {
    console.log(`[Auth API] Logging in with ${phone}`);
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ token: 'mock-token-' + Date.now(), user: { phone, avatar: 'Felix' } });
      }, 1200);
    });
  },
  // 模拟微信轮询
  async checkWechatAuth() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ token: 'wx-token-' + Date.now(), user: { nickname: '微信用户', avatar: 'Wechat' } });
      }, 3000);
    });
  }
};

/**
 * 初始化鉴权系统
 */
export function initAuth() {
  checkAuthStatus();
  bindAuthEvents();
}

/**
 * 检查当前登录状态并控制 UI
 */
export function checkAuthStatus() {
  const session = localStorage.getItem(AUTH_KEY);
  const overlay = getEl('login-overlay');
  const appShell = getEl('main-app');

  if (session) {
    overlay.classList.add('hidden');
    appShell.classList.remove('blur-content');
  } else {
    overlay.classList.remove('hidden');
    appShell.classList.add('blur-content');
  }
}

/**
 * 绑定登录界面的交互事件
 */
function bindAuthEvents() {
  // Tab 切换逻辑
  const tabPhone = getEl('tab-phone');
  const tabWechat = getEl('tab-wechat');
  const panelPhone = getEl('panel-phone');
  const panelWechat = getEl('panel-wechat');

  if (tabPhone && tabWechat) {
    tabPhone.onclick = () => {
      tabPhone.classList.add('active');
      tabWechat.classList.remove('active');
      panelPhone.classList.remove('hidden');
      panelWechat.classList.add('hidden');
    };

    tabWechat.onclick = async () => {
      tabWechat.classList.add('active');
      tabPhone.classList.remove('active');
      panelWechat.classList.remove('hidden');
      panelPhone.classList.add('hidden');
      
      // 触发微信轮询模拟
      const result: any = await api.checkWechatAuth();
      const qrMask = getEl('qr-mask');
      if (qrMask) qrMask.classList.remove('hidden');
      setTimeout(() => loginSuccess(result), 1000);
    };
  }

  // 手机号获取验证码
  const codeBtn = getEl<HTMLButtonElement>('get-code-btn');
  if (codeBtn) {
    codeBtn.onclick = async () => {
      const phoneInput = getEl<HTMLInputElement>('phone-input');
      const phone = phoneInput.value;
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        alert("请输入正确的11位手机号");
        return;
      }
      
      codeBtn.innerText = "发送中...";
      codeBtn.disabled = true;
      await api.sendCode(phone);
      codeBtn.innerText = "已发送";
      // 模拟倒计时可在此扩展
      setTimeout(() => {
         codeBtn.innerText = "获取验证码"; 
         codeBtn.disabled = false;
      }, 5000);
    };
  }

  // 手机号登录提交
  const loginBtn = getEl('phone-login-btn');
  if (loginBtn) {
    loginBtn.onclick = async () => {
      const phone = (getEl('phone-input') as HTMLInputElement).value;
      const code = (getEl('code-input') as HTMLInputElement).value;
      
      if (!phone || !code) {
        alert("请输入手机号和验证码");
        return;
      }
      
      const originalText = loginBtn.innerText;
      loginBtn.innerText = "登录中...";
      
      try {
        const result: any = await api.loginWithPhone(phone, code);
        loginSuccess(result);
      } catch (e) {
        alert("登录失败，请重试");
      } finally {
        loginBtn.innerText = originalText;
      }
    };
  }

  // 登出逻辑
  const logoutBtn = getEl('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      if (confirm("确定要退出登录吗？")) {
        localStorage.removeItem(AUTH_KEY);
        window.location.reload();
      }
    };
  }
}

function loginSuccess(session: any) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  const overlay = getEl('login-overlay');
  
  // 添加淡出动画
  overlay.classList.add('fade-out');
  setTimeout(() => {
    checkAuthStatus(); // 更新状态
    overlay.classList.remove('fade-out'); // 重置动画类以便下次使用
  }, 500);
}
