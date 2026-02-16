from contextlib import asynccontextmanager
import os

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.init_db import init_db

# 🔽 ルーターをまとめて import（app/routers/__init__.py で router を公開している前提）
from app.routers import (
    auth,
    calendar,
    cycles,
    dashboard,
    external,
    prefectures,
    records,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI のライフサイクル管理用コンテキスト。

    - アプリ起動時: init_db() を実行して、全テーブルを作成
    - アプリ終了時: 特に何もしない（必要になったらここにクリーンアップ処理を書く）
    """
    # ✅ 起動時に一度だけ DB のテーブル作成を試みる
    await init_db()
    yield
    # 👇 終了時の後片付けをしたい場合はここに書く（今回は不要）


# FastAPI アプリ本体
app = FastAPI(
    lifespan=lifespan,  # 👈 上で定義した lifespan を登録
    title="Hada API",
    version="1.0.0",
)

# --- CORS 設定 ---
# .env の CORS_ORIGINS が "https://example.com,https://example-preview.vercel.app" みたいな想定
origins = os.getenv("CORS_ORIGINS", "").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],  # 空白・空文字を除外
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- ルーター登録 ---
# /auth/verify など
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(records.router)
app.include_router(dashboard.router)
app.include_router(cycles.router)
app.include_router(prefectures.router)
app.include_router(external.router)
app.include_router(calendar.router)


# --- ヘルスチェック ---
@app.get("/health")
@app.head("/health")
async def health(response: Response):
    """
    コンテナの生存確認用エンドポイント。
    - 単純に {"status": "ok"} を返すだけ。
    """
    response.status_code = 200
    return {"status": "ok"}


# --- DB接続チェック（開発用） ---
@app.get("/db-check")
async def db_check(db: AsyncSession = Depends(get_db)):
    """
    DB に接続できているか確認するための簡易エンドポイント。
    - SELECT 1 を実行して結果を返す。
    - 開発・デバッグ専用（本番では消してもよい）。
    """
    result = await db.execute(text("SELECT 1"))
    value = result.scalar()
    return {"db": "ok", "value": value}
