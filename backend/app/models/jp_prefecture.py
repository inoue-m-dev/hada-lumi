# backend/app/models/jp_prefecture.py
from sqlalchemy import Column, String, Float, DateTime, func
from app.db.base import Base


class JpPrefecture(Base):
    __tablename__ = "jp_prefecture"

    pref_code = Column(String, primary_key=True, index=True)  # 例: "13"
    name_ja = Column(String, unique=True, nullable=False)  # "東京都"
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
