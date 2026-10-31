const guest = document.getElementById("auth-guest");
const userPanel = document.getElementById("auth-user");
const notice = document.getElementById("auth-notice");
const loading = document.getElementById("auth-loading");
const panels = {
  login: document.getElementById("login-panel"),
  register: document.getElementById("register-panel"),
  resend: document.getElementById("resend-panel"),
};

function showPanel(selected) {
  for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== selected;
  for (const name of ["login", "register"]) {
    document.getElementById(`${name}-tab`).setAttribute("aria-selected", String(name === selected));
  }
  notice.hidden = true;
}

function message(text, error = false) {
  notice.textContent = text;
  notice.className = `auth-notice${error ? " error" : ""}`;
  notice.hidden = false;
}

async function request(path, body) {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) throw new Error("操作过于频繁，请稍后再试。");
    const messages = {
      EMAIL_NOT_VERIFIED: "请先点击验证邮件中的链接，完成邮箱验证。",
      INVALID_EMAIL_OR_PASSWORD: "邮箱或密码不正确。",
      USER_ALREADY_EXISTS: "此邮箱已注册，请登录或重新发送验证邮件。",
      INVALID_PASSWORD: "密码不符合要求，请至少输入 8 个字符。",
    };
    throw new Error(messages[data.code] || "请求失败，请检查填写内容后重试。");
  }
  return data;
}

function setBusy(form, busy) {
  form.querySelector("button[type=submit]").disabled = busy;
}

async function submit(form, action) {
  setBusy(form, true);
  notice.hidden = true;
  try {
    await action(new FormData(form));
  } catch (error) {
    message(error.message || "网络连接失败，请稍后重试。", true);
  } finally {
    setBusy(form, false);
  }
}

function showUser(user) {
  loading.hidden = true;
  guest.hidden = true;
  userPanel.hidden = false;
  document.getElementById("user-email").textContent = user.email;
}

document.getElementById("login-tab").addEventListener("click", () => showPanel("login"));
document.getElementById("register-tab").addEventListener("click", () => showPanel("register"));
document.getElementById("resend-toggle").addEventListener("click", () => showPanel("resend"));
document.getElementById("back-login").addEventListener("click", () => showPanel("login"));

document.getElementById("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  submit(event.currentTarget, async (form) => {
    const data = await request("sign-in/email", {
      email: form.get("email").trim(),
      password: form.get("password"),
    });
    showUser(data.user);
  });
});

document.getElementById("register-form").addEventListener("submit", (event) => {
  event.preventDefault();
  submit(event.currentTarget, async (form) => {
    if (form.get("password") !== form.get("confirm")) {
      throw new Error("两次输入的密码不一致。");
    }
    await request("sign-up/email", {
      name: form.get("name").trim(),
      email: form.get("email").trim(),
      password: form.get("password"),
      callbackURL: "/account.html?verified=1",
    });
    document.querySelector("#resend-form [name=email]").value = form.get("email");
    showPanel("resend");
    message("注册申请已提交。请查收验证邮件，点击邮件中的链接后再登录。");
  });
});

document.getElementById("resend-form").addEventListener("submit", (event) => {
  event.preventDefault();
  submit(event.currentTarget, async (form) => {
    await request("send-verification-email", {
      email: form.get("email").trim(),
      callbackURL: "/account.html?verified=1",
    });
    message("如该邮箱已注册，验证邮件将发送至该邮箱。");
  });
});

document.getElementById("logout").addEventListener("click", async () => {
  try {
    await request("sign-out", {});
    location.assign("./index.html");
  } catch {
    location.reload();
  }
});

fetch("/api/auth/get-session", { credentials: "same-origin" })
  .then((response) => response.ok ? response.json() : null)
  .then((session) => {
    if (session?.user) return showUser(session.user);
    loading.hidden = true;
    guest.hidden = false;
    if (new URLSearchParams(location.search).has("verified")) {
      message("邮箱验证完成，请登录。");
      history.replaceState({}, "", location.pathname);
    }
  })
  .catch(() => {
    loading.hidden = true;
    guest.hidden = false;
    message("暂时无法读取账号状态，请检查服务是否已启动。", true);
  });
