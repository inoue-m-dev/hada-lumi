from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import os

# .env の DATABASE_URL を取得（例: postgresql+asyncpg://postgres:postgres@db:5432/hada）
DATABASE_URL = os.getenv("DATABASE_URL")

# 非同期エンジン作成
engine = create_async_engine(
    DATABASE_URL, echo=True, future=True  # SQLログを表示（あとでFalseにしてOK）
)

# 非同期セッション作成 (FastAPI用)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# セッションをFastAPIのDIに渡すための関数
async def get_db():
    async with async_session() as session:
        yield session
