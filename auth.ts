
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
 * 核心逻辑：有 Session -> 隐藏遮罩；无 Session -> 显示遮罩
 */
export function checkAuthStatus() {
  const session = localStorage.getItem(AUTH_KEY);
  const overlay = getEl('login-overlay');
  const appShell = getEl('main-app');
  
  if (!overlay) return;

  if (session) {
    // Logged In
    overlay.classList.add('hidden'); 
    overlay.style.display = 'none';
    
    overlay.classList.remove('fade-out');
    if (appShell) appShell.classList.remove('blur-content');
  } else {
    // Not Logged In
    overlay.classList.remove('hidden');
    // CRITICAL FIX: Force flex to ensure centering works. 
    // Setting to '' might revert to 'block' if CSS hasn't loaded or specificity issues occur.
    overlay.style.display = 'flex';
    
    overlay.classList.remove('fade-out');
    if (appShell) appShell.classList.add('blur-content');
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
  const qrMask = getEl('qr-mask');

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
      
      // Reset QR state
      if (qrMask) {
         qrMask.classList.remove('hidden');
         qrMask.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#007AFF"></i><span style="color:#333; margin-top:8px;">等待扫描...</span>';
      }

      // 触发微信轮询模拟
      try {
        const result: any = await api.checkWechatAuth();
        // Success state
        if (qrMask) {
           qrMask.innerHTML = '<i class="fas fa-check-circle" style="color:#34C759; font-size:40px;"></i><span style="color:#34C759; margin-top:8px;">登录成功</span>';
        }
        setTimeout(() => loginSuccess(result), 800);
      } catch (e) {
        if (qrMask) qrMask.classList.add('hidden');
      }
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
  const loginBtn = getEl<HTMLButtonElement>('phone-login-btn');
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
      loginBtn.disabled = true;
      
      try {
        const result: any = await api.loginWithPhone(phone, code);
        loginSuccess(result);
      } catch (e) {
        alert("登录失败，请重试");
        loginBtn.disabled = false;
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
        // Clean refresh
        window.location.reload();
      }
    };
  }
}

function loginSuccess(session: any) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  const overlay = getEl('login-overlay');
  
  // 1. Add fade-out for visual transition
  overlay.classList.add('fade-out');
  
  // 2. Wait for transition, then force hidden state
  setTimeout(() => {
    checkAuthStatus(); // This will trigger style.display = 'none'
  }, 500);
}
