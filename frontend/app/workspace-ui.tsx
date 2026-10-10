"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { accountApi, Account } from "../lib/account-api";

export const STAGES = [
  ["profile", "创作画像", "◎"], ["positioning", "账号定位", "◈"],
  ["topics", "灵感选题", "✧"], ["script", "内容脚本", "≡"],
  ["operate", "发布计划", "↗"], ["review", "数据复盘", "◷"],
] as const;

export function AccountGate({ children }: { children: (user: Account | null, change: (user: Account | null) => void) => ReactNode }) {
  const [user, setUser] = useState<Account | null | undefined>(undefined);
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    let active = true;
    accountApi<{ user: Account | null }>("/auth/me").then(data => { if (active) setUser(data.user); })
      .catch(() => { if (active) { setFailure(true); setUser(null); } });
    return () => { active = false; };
  }, []);
  if (user === undefined) return <div className="gm-boot">正在打开创作工作台…</div>;
  return <>{failure && <div className="gm-connection">账户服务暂时不可用，仍可使用访客模式。刷新后重试。</div>}{children(user, setUser)}</>;
}

type Panel = "workspace" | "profile" | "settings" | "help" | "auth" | null;
export function Navigation({ stage, user, onHome, onPanel, onNavigate, completed, notificationsOpen, onNotifications }: {
  stage: string; user: Account | null; onHome: () => void; onPanel: (panel: Panel) => void;
  onNavigate: (stage: string) => void; completed: boolean[]; notificationsOpen: boolean; onNotifications: () => void;
}) {
  const landing = stage === "landing";
  return <>
    <header className="gm-topbar">
      <button className="gm-brand" onClick={onHome}><SparklesIcon className="gm-brand-icon" aria-hidden="true" /> GrowMate</button>
      <div className="gm-top-context">{!landing && "创作空间 / " + (STAGES.find(item => item[0] === stage)?.[1] || "工作台")}</div>
      <nav className="gm-top-actions" aria-label="主导航">
        <button onClick={() => onPanel("workspace")}>我的创作</button>
        <button onClick={() => onPanel("help")}>帮助中心</button>
        <button onClick={() => onPanel("settings")}>偏好设置</button>
        <button aria-label="通知" aria-expanded={notificationsOpen} onClick={onNotifications}>动态<span className="gm-dot" /></button>
        <button className="gm-account-button" onClick={() => onPanel(user ? "profile" : "auth")}>{user ? user.name : "登录 / 注册"}</button>
        <details className="gm-mobile-menu"><summary>更多</summary><div><button onClick={() => onPanel("help")}>帮助中心</button><button onClick={() => onPanel("settings")}>偏好设置</button><button onClick={onNotifications}>创作动态</button></div></details>
      </nav>
      {notificationsOpen && <aside className="gm-notifications" aria-label="通知中心"><h3>当前创作动态</h3>
        {completed.some(Boolean) ? STAGES.filter((_, i) => completed[i]).map(item => <button key={item[0]} onClick={() => { onNavigate(item[0]); onNotifications(); }}>{item[1]}已完成 <span>查看 →</span></button>) : <p>尚无创作记录。完成画像测试后，进度会显示在这里。</p>}
      </aside>}
    </header>
    {!landing && <aside className="gm-sidebar">
      <p className="gm-nav-label">创作工作流</p>
      <nav aria-label="创作流程">{STAGES.map(([key, label, symbol], i) => <button key={key} onClick={() => onNavigate(key)} aria-current={key === stage ? "step" : undefined} className={key === stage ? "active" : ""}>
        <span className="gm-nav-symbol" aria-hidden="true">{symbol}</span>{label}<span className="gm-nav-check">{completed[i] ? "✓" : ""}</span>
      </button>)}</nav>
      <div className="gm-sidebar-bottom"><p>每一轮复盘，都是下一轮的起点。</p><button onClick={() => onPanel("workspace")}>管理已保存的创作 →</button></div>
    </aside>}
  </>;
}

export function AuthForm({ onAuthenticated }: { onAuthenticated: (user: Account) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const data = await accountApi<{ user: Account }>(register ? "/auth/register" : "/auth/login", "POST", {
        email: form.get("email"), password: form.get("password"), name: register ? form.get("name") : "创作者",
      });
      onAuthenticated(data.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "账户服务暂时不可用。"); }
    finally { setBusy(false); }
  }
  return <div className="gm-auth-layout"><div className="gm-auth-story"><p className="gm-kicker">YOUR CREATIVE SPACE</p><h3>让好想法，<br />不止停在想法。</h3><p>登录后，可以将画像、选题、脚本和复盘保存为独立创作任务，随时继续。</p><p className="gm-note">不登录也能体验完整流程。访客进度保存在当前浏览器，账户任务保存在服务端。</p></div>
    <form onSubmit={submit} className="gm-form"><div className="gm-tabs"><button type="button" className={!register ? "active" : ""} onClick={() => { setRegister(false); setError(""); }}>登录</button><button type="button" className={register ? "active" : ""} onClick={() => { setRegister(true); setError(""); }}>注册账户</button></div>
      {register && <label>创作者昵称<input name="name" required maxLength={40} autoComplete="nickname" placeholder="怎么称呼你？" /></label>}
      <label>邮箱<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
      <label>密码<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={register ? "new-password" : "current-password"} placeholder="至少 8 位字符" /></label>
      {error && <p className="gm-error" role="alert">{error}</p>}
      <button disabled={busy} className="gm-primary" type="submit">{busy ? "请稍候…" : register ? "创建账户" : "登录"}</button>
      <p className="gm-note">目前支持邮箱密码登录，暂未接入邮件验证和密码找回。请勿复用重要账户密码。</p>
    </form></div>;
}

export function AccountProfile({ user, onChange, onLogin }: { user: Account | null; onChange: (user: Account | null) => void; onLogin: () => void }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return <div className="gm-empty"><h3>当前为访客模式</h3><p>注册账户后，可以保存并管理你的创作任务。</p><button className="gm-primary" onClick={onLogin}>登录 / 注册</button></div>;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try { const data = await accountApi<{ user: Account }>("/auth/profile", "PATCH", { name: new FormData(event.currentTarget).get("name") }); onChange(data.user); setMessage("资料已保存。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败。"); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await accountApi("/auth/logout", "POST"); onChange(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "退出失败。"); }
    finally { setBusy(false); }
  }
  return <div className="gm-account-layout"><div><span className="gm-avatar">{user.name.slice(0, 1)}</span><h3>{user.name}</h3><p>{user.email}</p><p className="gm-note">邮箱密码账户 · 任务仅本人可访问</p></div><form className="gm-form" onSubmit={save}><label>昵称<input name="name" defaultValue={user.name} minLength={1} maxLength={40} required /></label><label>注册邮箱<input value={user.email} readOnly /></label>{error && <p role="alert" className="gm-error">{error}</p>}{message && <p role="status">{message}</p>}<button className="gm-primary" disabled={busy}>保存资料</button><button type="button" disabled={busy} onClick={logout}>退出登录</button></form></div>;
}

type Project = { id: string; title: string; stage: string; updated: number };
export function Projects({ user, storageKey, stage, onLogin }: { user: Account | null; storageKey: string; stage: string; onLogin: () => void }) {
  const [items, setItems] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("我的内容创作");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    accountApi<{ projects: Project[] }>("/projects").then(data => { if (active) setItems(data.projects); }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [user]);
  if (!user) return <div className="gm-empty"><h3>给创作一个可以回来的地方</h3><p>当前流程已自动保存在这个浏览器。登录后，可在服务端保存任务，并从其他浏览器继续。</p><button className="gm-primary" onClick={onLogin}>登录后保存创作</button></div>;
  async function action(work: () => Promise<void>) { setBusy(true); setError(""); setMessage(""); try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败。"); } finally { setBusy(false); } }
  async function refresh() { const data = await accountApi<{ projects: Project[] }>("/projects"); setItems(data.projects); }
  async function save(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) throw new Error("当前没有可以保存的创作进度。");
      await accountApi("/projects", "POST", { title, stage, state: JSON.parse(raw) }); await refresh(); setMessage("当前创作已保存为新快照。");
    });
  }
  async function open(id: string) {
    await action(async () => {
      const data = await accountApi<{ stage: string; state: Record<string, unknown> }>(`/projects/${id}`);
      // Restoring a snapshot remounts the entire workflow; no partial state mixing.
      localStorage.setItem(storageKey, JSON.stringify({ ...data.state, savedAt: Date.now() }));
      window.location.assign(data.stage === "landing" ? "/" : `/${data.stage}`);
    });
  }
  return <div className="gm-projects"><form onSubmit={save} className="gm-save-form"><label>保存当前创作<input aria-label="创作任务名称" value={title} onChange={event => setTitle(event.target.value)} required maxLength={100} /></label><button className="gm-primary" disabled={busy}>保存为新快照</button></form><p className="gm-note">快照保留保存时的完整进度，后续修改不会覆盖旧版本。打开快照会替换当前浏览器的创作进度。</p>{error && <p className="gm-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="gm-project-list"><div className="gm-list-heading"><h3>已保存的创作</h3><span>{items.length} 个任务</span></div>
      {!items.length && <p className="gm-empty">还没有保存的任务。先开始一次创作，再将它保存到这里。</p>}
      {items.map(item => <div key={item.id} className="gm-project-row"><div><h4>{item.title}</h4><p>{STAGES.find(step => step[0] === item.stage)?.[1] || "首页"} · {new Date(item.updated * 1000).toLocaleString("zh-CN")}</p></div><button disabled={busy} onClick={() => open(item.id)}>打开创作 →</button>{confirmDelete === item.id ? <><button disabled={busy} className="gm-error" onClick={() => action(async () => { await accountApi(`/projects/${item.id}`, "DELETE"); setConfirmDelete(null); await refresh(); })}>确认永久删除</button><button onClick={() => setConfirmDelete(null)}>取消</button></> : <button disabled={busy} onClick={() => setConfirmDelete(item.id)}>删除</button>}</div>)}
    </div></div>;
}

const ARTICLES = [
  ["如何快速体验 Demo", "从首页开始，填写增长目标。画像测试中可以选择“一键体验示例创作者”填入演示答案，再生成画像、选题、脚本和发布计划。复盘可使用模拟数据，但它不代表真实账号表现。"],
  ["如何输入真实数据", "在数据复盘页选择“录入真实内容数据”，填写播放量、点赞、评论、转发和涨粉数。播放量必须大于 0，其余可以是 0。当前没有自动抓取平台后台，也没有完播率数据。"],
  ["如何理解人格报告", "16 道题用于内容创作场景的启发式分类，不是心理学测评。画像、内容目标和视频时长共同作为后续模型的输入，建议可根据实际创作反馈调整。"],
  ["脚本时长如何匹配", "目标时长支持 15–3000 秒。短视频强调开头和快速表达，长视频采用章节结构。台词字数按语速估算，实际录制时还要考虑停顿、画面留白和个人语速。"],
  ["如何继续生成下一轮选题", "先生成内容数据分析，再生成优化建议，最后点击“基于复盘继续下一轮”。系统保留策略记忆用于下一轮选题；生成失败时原有复盘不会被清空。"],
  ["如何保存和恢复创作", "浏览器会自动保存当前进度。登录账户后，在“我的创作”中填写任务名并保存快照。之后可以打开快照恢复完整流程。访客和不同账户的浏览器缓存相互隔离。"],
];
export function HelpArticles({ query, onSearch }: { query: string; onSearch: (value: string) => void }) {
  const results = ARTICLES.filter(item => item.join(" ").includes(query.trim()));
  return <div className="gm-help"><label className="gm-form">搜索使用说明<input aria-label="搜索帮助文档" value={query} onChange={event => onSearch(event.target.value)} placeholder="例如：时长、真实数据、保存" /></label><div className="gm-help-results">{results.map(([title, body]) => <details key={title}><summary>{title}<span>＋</span></summary><p>{body}</p></details>)}{!results.length && <p className="gm-empty">没有找到匹配内容，可以尝试“脚本”或“复盘”。</p>}</div></div>;
}
