# GrowMate

GrowMate 是面向普通 KOC 的 AI 内容创作与增长 MVP，使用 FastAPI + LangGraph 后端和 Next.js 前端，串联创作画像、账号定位、选题、脚本、发布建议和数据复盘。

## 首次安装须知

- 安装 Git、Python 3.11 和 Node.js 22。当前 Next.js 包要求 Node.js >= 20.9.0；本项目后端现有本地测试环境使用 Python 3.11。
- 需要联网下载依赖，以及自己的 DeepSeek API Key 和可用额度。模型调用可能产生费用。
- 源码不附带密钥、用户账号、数据库或历史创作记录。没有有效密钥，不能完整体验 AI 生成流程。
- 如果仓库为私有，必须先获得访问权限。下载 ZIP 也可以，但后续不能直接使用 `git pull` 更新。
- 以下命令请按步骤执行；如果安装报错，先处理错误，不要直接跳到启动步骤。

先检查已安装的软件：

```text
git --version
node --version
npm --version
```

Windows 另运行 `py -3.11 --version`；macOS/Linux 运行 `python3.11 --version`。后者不可用时，先安装 Python 3.11，或确认自己的 `python3` 是该版本后替换下文命令。

## 下载项目

在希望存放项目的文件夹打开终端，运行：

```bash
git clone https://github.com/Sylvan-ai721/growmate.git
cd growmate
```

下载 ZIP 时，解压后进入包含 `api_app.py`、`requirements.txt` 和 `frontend` 的目录。后文的“项目根目录”均指这个目录，与它在电脑上的具体路径无关。

## Windows 安装与启动

### 1. 安装后端依赖

在项目根目录打开 PowerShell：

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

复制配置文件只需在首次安装时执行；已有 `.env` 时不要覆盖。按照下方“密钥配置”填写并保存后，继续启动后端：

```powershell
.\.venv\Scripts\python.exe -m uvicorn api_app:app --host 127.0.0.1 --port 8000
```

这些命令直接使用虚拟环境中的 Python，不需要执行 `Activate.ps1`，也不需要修改 PowerShell 执行策略。出现 `Application startup complete` 和 `Uvicorn running on http://127.0.0.1:8000` 表示后端已启动。保持此终端运行。

### 2. 安装并启动前端

另外打开一个 PowerShell 窗口，先进入刚下载的项目根目录，再执行：

```powershell
cd frontend
npm ci
npm run dev
```

出现 `Ready` 后，打开终端显示的本地网址，默认是 `http://localhost:3000`。前端和后端两个终端都需要保持运行；停止服务时在对应终端按 `Ctrl+C`。

## macOS / Linux 安装与启动

### 1. 安装并启动后端

在项目根目录运行：

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
```

用文本编辑器打开根目录的 `.env`，按下方说明填写并保存。已有 `.env` 时不要重复复制覆盖。然后运行：

```bash
.venv/bin/python -m uvicorn api_app:app --host 127.0.0.1 --port 8000
```

保持此终端运行。若 Linux 提示缺少 `venv` 或 `ensurepip`，先按操作系统提示安装与 Python 版本对应的 venv 组件。

### 2. 安装并启动前端

另开一个终端，进入同一个项目根目录后运行：

```bash
cd frontend
npm ci
npm run dev
```

出现 `Ready` 后访问 `http://localhost:3000`；若终端显示了其他端口，使用实际网址。

## 密钥配置

从 [DeepSeek 开放平台](https://platform.deepseek.com/) 获取自己的 API Key，在根目录 `.env` 中填写：

```dotenv
DEEPSEEK_API_KEY=填写你自己的API密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
GROWMATE_SECURE_COOKIE=0
```

`deepseek-flash` 是当前源码默认配置的模型标识，并非对模型可用性的承诺；实际可用型号和权限以服务商账户为准。不要使用产品展示名称替代 API 模型标识。配置修改后需要重启后端。

初次运行无需填写可选的视频平台集成配置，也无需创建前端 `.env.local`。前端会把同源 `/api` 请求代理到 `http://127.0.0.1:8000`；可在需要时通过 `BACKEND_URL` 指定其他后端地址。不要再配置已停用的 `NEXT_PUBLIC_API_BASE_URL`。

不要提交 `.env`、密钥或数据库到 GitHub，也不要将密钥发给他人。注册账号和创作数据保存在使用者自己的电脑上，不会自动同步到项目作者的电脑。

## 启动验证与再次运行

1. 打开 `http://127.0.0.1:8000/docs`，能看到 API 文档说明后端可访问，但不代表模型调用成功。
2. 打开 `http://localhost:3000`，能看到首页说明前端可访问。
3. 完成人格测试并生成画像，才会实际验证密钥、模型权限及模型服务连接；这一步会调用模型。

以后再次启动只需分别运行后端的 uvicorn 命令和前端的 `npm run dev`，无需重复创建虚拟环境或复制配置。更新代码后，如果依赖文件变化，再重新安装相应依赖。

本项目是可运行 MVP，不是自动发布或保证涨粉的商业产品。模拟数据仅供演示，不能作为真实增长证据。长视频脚本生成需要更长时间，等待期间请保持后端运行。

## 常见问题

| 提示或现象 | 检查方法 |
| --- | --- |
| 找不到 Python、Git 或 npm | 确认已安装相应软件，关闭终端后重新打开，再检查版本。 |
| `ModuleNotFoundError` | 在项目根目录使用 `.venv` 内的 Python 安装 `requirements.txt`，不要混用系统 Python。 |
| `Failed to fetch`、接口代理异常或 502 | 确认后端终端没有退出、8000 端口可访问，查看后端报错。远程部署还需检查反向代理。 |
| 8000 端口已被占用 | 先查看已有服务是否能通过 `/docs` 访问；不要反复启动，也不要直接结束不明进程。 |
| 前端改用其他端口 | 使用终端实际显示的网址；若注册登录提示来源不受信任，在后端 `.env` 的 `GROWMATE_ALLOWED_ORIGINS` 加入实际前端来源并重启后端。 |
| 未配置密钥、401、额度或模型错误 | 检查根目录 `.env`、密钥有效性、可用额度和模型标识，修改后重启后端。 |
| `npm ci` 或 pip 安装失败 | 查看具体报错，确认网络、软件版本及代理配置。浏览器可联网不代表终端也能联网；不要关闭证书验证来绕过错误。 |
| `next start` 找不到生产构建 | 本地首次体验用 `npm run dev`。生产运行需在 `frontend` 目录先成功执行 `npm run build`，再执行 `npm run start`。 |

目前未执行全新电脑上的从零安装验证；上述步骤依据当前目录结构和配置编写。前端依赖有锁文件，后端依赖仍使用版本下限而非完整锁定，未来依赖更新可能影响安装结果。

## Validation

```powershell
# Run from the project root.
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd frontend
npm run lint
npm run build
```

Regression tests mock the model and do not make paid inference calls. They cover goals,
question semantics, invalid inputs, duration budgets, JSON repair, manual/mock metrics,
review strategy memory, concurrent session updates and an API round trip.

## Behavior and limits

- Growth goals travel with the profile through generation and review.
- Scripts target 3.5 spoken characters per second, validate a 3-4 character/second range,
  and show estimated speaking duration. Timing is an estimate, not a guaranteed recording duration.
- Long scripts generate chapter by chapter; they take longer than short scripts.
- Real data entry is blank by default. Simulated metrics are explicitly labeled.
- Reviews calculate evidence from supplied metrics and disclose missing retention/timing/history data.
- Strategy memory persists independently of the currently displayed review and retains ten rounds.
- Anonymous sessions persist in `.growmate-sessions.sqlite3`; stale rows are cleaned up on writes
  after seven days. Browser progress persists locally with a seven-day limit.
- Source includes generic provider API configuration, not a guarantee of model availability.

## Server update

Upload the changed backend files and `frontend` source to their corresponding server directories.
Do not overwrite the server `.env` with local credentials. Install backend requirements,
then build the frontend successfully before restarting its process.

```bash
cd /home/ubuntu/ai-agent
.venv/bin/python -m pip install -r requirements.txt
npm run build && pm2 restart growmate-frontend
pm2 restart growmate-backend
pm2 save
```

These commands assume the existing server layout places the frontend package at the project root.
If the server uses a `frontend` subdirectory, run the build in that directory instead.
For long scripts, configure the reverse proxy read timeout to at least 900 seconds;
otherwise the proxy may cut off an otherwise running generation request.

## Accounts and private projects

The local demo now has real email/password registration and login, editable account names,
logout, and private server-side project snapshots (save, list, open, delete with confirmation).
Guests can still use the complete workflow. Browser progress is scoped per account, with a
separate guest cache; signing in does not import or erase a guest's existing work.

Passwords use salted scrypt hashes. Login cookies are HttpOnly, SameSite=Lax and expire after
seven days; only hashed session tokens are stored. Auth attempts are rate limited, mutation
origins are checked, saved projects are owner-filtered, and authenticated workflow sessions
cannot be opened by another account or a guest. Auth responses are not cached.

Accounts and project snapshots persist in `.growmate-accounts.sqlite3` (override with
`GROWMATE_ACCOUNT_DB`). Include this database and the workflow database in private backups;
do not upload them to Git or expose them as static files. Deleting a project is permanent.

For public deployment, enable HTTPS before accepting real passwords. Set
`GROWMATE_SECURE_COOKIE=1`, `GROWMATE_ALLOWED_ORIGINS=https://your-domain.example`, and pass
`X-Forwarded-Proto` from the HTTPS reverse proxy. HTTP is only appropriate for local testing.
Email ownership verification, password reset, third-party OAuth, and cross-device automatic
draft syncing are not implemented. Saved snapshots can be restored across browsers after login.

## UI References

The redesigned workbench uses persistent workflow navigation, list-based topic comparison,
a document-style script view, compact page headings, and real rather than fabricated task data.
References reviewed: [Buffer Create](https://buffer.com/create),
[Later's social calendar](https://later.com/social-media-content-calendar/), and
[Jasper Canvas](https://www.jasper.ai/canvas). These are design references, not integrations;
GrowMate still does not automatically publish to social platforms.
