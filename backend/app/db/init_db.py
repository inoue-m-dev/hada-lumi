# app/db/init_db.py

from app.db.base import Base
from app.db.database import engine
from app import models  # noqa: F401  # models を import してテーブル定義を Base に登録


# 🔴 ここを async にする
async def init_db() -> None:
    """
    アプリ起動時に一度だけ全テーブルを作成する。
    - engine は AsyncEngine を想定
    - models を import 済みなので Base.metadata に全モデルが登録されている前提
    """
    async with engine.begin() as conn:
        # run_sync 経由で同期版 create_all を実行
        await conn.run_sync(Base.metadata.create_all)
