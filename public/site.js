fetch("/api/auth/get-session", { credentials: "same-origin" })
  .then((response) => response.ok ? response.json() : null)
  .then((session) => {
    if (!session?.user) return;
    const link = document.getElementById("account-link");
    if (link) {
      link.textContent = "我的账号";
      link.setAttribute("aria-label", `${session.user.email} 的账号`);
    }
  })
  .catch(() => {});
