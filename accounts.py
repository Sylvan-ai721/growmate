"""Local accounts and private project snapshots; cookies contain opaque tokens only."""
from contextlib import closing, contextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

COOKIE = "growmate_session"
TTL = 7 * 86400


class AccountStore:
    def __init__(self, path=None):
        self.path = str(path or os.getenv("GROWMATE_ACCOUNT_DB") or Path(__file__).with_name(".growmate-accounts.sqlite3"))
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS logins(token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, stage TEXT NOT NULL, state TEXT NOT NULL, updated REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY, count INTEGER NOT NULL, started REAL NOT NULL);
            """)

    @contextmanager
    def connect(self):
        with closing(sqlite3.connect(self.path, timeout=10)) as db, db:
            db.row_factory = sqlite3.Row
            yield db

    def limit(self, key):
        now = time.time()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM attempts WHERE started < ?", (now - 900,))
            row = db.execute("SELECT count FROM attempts WHERE key=?", (key,)).fetchone()
            if row and row[0] >= 20:
                raise HTTPException(429, "尝试过于频繁，请 15 分钟后再试。")
            db.execute("INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1", (key, now))

    def user(self, token):
        with self.connect() as db:
            row = db.execute("SELECT u.id,u.email,u.name FROM users u JOIN logins l ON l.user_id=u.id WHERE l.token=? AND l.expires>?", (digest(token or ""), time.time())).fetchone()
        return dict(row) if row else None

    def login(self, user_id):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute("DELETE FROM logins WHERE expires<=?", (time.time(),))
            db.execute("INSERT INTO logins VALUES (?,?,?)", (digest(token), user_id, time.time() + TTL))
        return token


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    hashed = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"{salt}:{hashed}"


DUMMY_PASSWORD_HASH = password_hash("not-a-real-password", "00" * 16)
store = AccountStore()
router = APIRouter(prefix="/api")


def check_origin(request):
    origin = request.headers.get("origin")
    allowed = {"http://localhost:3000", "http://127.0.0.1:3000", str(request.base_url).rstrip("/")}
    allowed.update(x.strip() for x in os.getenv("GROWMATE_ALLOWED_ORIGINS", "").split(",") if x.strip())
    if origin and origin not in allowed:
        raise HTTPException(403, "请求来源不允许。")


def require_user(request):
    check_origin(request)
    user = store.user(request.cookies.get(COOKIE))
    if not user:
        raise HTTPException(401, "请先登录账户。")
    return user


def set_cookie(response, token):
    response.set_cookie(COOKIE, token, max_age=TTL, httponly=True, samesite="lax", secure=os.getenv("GROWMATE_SECURE_COOKIE") == "1", path="/")
    response.headers["Cache-Control"] = "no-store"


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="创作者", min_length=1, max_length=40)

    @field_validator("email")
    @classmethod
    def email_address(cls, value):
        import re
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("请输入有效邮箱")
        return value

    @field_validator("name")
    @classmethod
    def nonempty_name(cls, value):
        if not value.strip():
            raise ValueError("昵称不能为空")
        return value.strip()


class ProfileEdit(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class ProjectInput(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    stage: str = Field(pattern=r"^(landing|profile|positioning|topics|script|operate|review)$")
    state: dict

    @field_validator("state")
    @classmethod
    def bounded_state(cls, value):
        if len(json.dumps(value).encode()) > 2_000_000:
            raise ValueError("任务内容过大")
        return value


@router.get("/auth/me")
def me(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"user": store.user(request.cookies.get(COOKIE))}


@router.post("/auth/register", status_code=201)
def register(data: Credentials, request: Request, response: Response):
    check_origin(request)
    store.limit("register:" + (request.client.host if request.client else "unknown"))
    user = {"id": uuid4().hex, "email": data.email, "name": data.name}
    hashed = password_hash(data.password)
    try:
        with store.connect() as db:
            db.execute("INSERT INTO users VALUES (?,?,?,?)", (*user.values(), hashed))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "该邮箱已注册，请登录。") from None
    set_cookie(response, store.login(user["id"]))
    return {"user": user}


@router.post("/auth/login")
def login(data: Credentials, request: Request, response: Response):
    check_origin(request)
    store.limit("login:" + (request.client.host if request.client else "unknown"))
    with store.connect() as db:
        row = db.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
    # Hash unknown users too, so credential checks have comparable cost.
    stored = row["password"] if row else DUMMY_PASSWORD_HASH
    valid = hmac.compare_digest(stored, password_hash(data.password, stored.split(":")[0]))
    if not row or not valid:
        raise HTTPException(401, "邮箱或密码错误。")
    set_cookie(response, store.login(row["id"]))
    return {"user": {key: row[key] for key in ("id", "email", "name")}}


@router.post("/auth/logout")
def logout(request: Request, response: Response):
    check_origin(request)
    with store.connect() as db:
        db.execute("DELETE FROM logins WHERE token=?", (digest(request.cookies.get(COOKIE, "")),))
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.patch("/auth/profile")
def edit_profile(data: ProfileEdit, request: Request):
    user = require_user(request)
    if not data.name.strip():
        raise HTTPException(422, "昵称不能为空。")
    with store.connect() as db:
        db.execute("UPDATE users SET name=? WHERE id=?", (data.name.strip(), user["id"]))
    return {"user": {**user, "name": data.name.strip()}}


@router.get("/projects")
def projects(request: Request, response: Response):
    user = require_user(request)
    response.headers["Cache-Control"] = "no-store"
    with store.connect() as db:
        rows = db.execute("SELECT id,title,stage,updated FROM projects WHERE user_id=? ORDER BY updated DESC", (user["id"],)).fetchall()
    return {"projects": [dict(row) for row in rows]}


@router.post("/projects", status_code=201)
def save_project(data: ProjectInput, request: Request):
    user = require_user(request)
    project_id = uuid4().hex
    with store.connect() as db:
        db.execute("INSERT INTO projects VALUES (?,?,?,?,?,?)", (project_id, user["id"], data.title.strip(), data.stage, json.dumps(data.state, ensure_ascii=False), time.time()))
    return {"id": project_id}


@router.get("/projects/{project_id}")
def project(project_id: str, request: Request, response: Response):
    user = require_user(request)
    response.headers["Cache-Control"] = "no-store"
    with store.connect() as db:
        row = db.execute("SELECT title,stage,state FROM projects WHERE id=? AND user_id=?", (project_id, user["id"])).fetchone()
    if not row:
        raise HTTPException(404, "任务不存在。")
    return {"title": row["title"], "stage": row["stage"], "state": json.loads(row["state"])}


@router.delete("/projects/{project_id}")
def delete_project(project_id: str, request: Request):
    user = require_user(request)
    with store.connect() as db:
        deleted = db.execute("DELETE FROM projects WHERE id=? AND user_id=?", (project_id, user["id"])).rowcount
    if not deleted:
        raise HTTPException(404, "任务不存在。")
    return {"ok": True}
