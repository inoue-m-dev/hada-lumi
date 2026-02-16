# app/models/daily_env.py
import uuid
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Date,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class DailyEnv(Base):
    __tablename__ = "daily_env"

    env_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # 1日 × 1都道府県で1レコード
    date = Column(Date, nullable=False)

    pref_code = Column(
        String,
        ForeignKey("jp_prefecture.pref_code"),
        nullable=False,
    )

    avg_temp_c = Column(Float, nullable=True)
    avg_humidity = Column(Float, nullable=True)
    uv_index = Column(Float, nullable=True)

    # 天気の状態
    weather_code = Column(String(50), nullable=True)

    # 今後の拡張用
    pollen_level = Column(Integer, nullable=True)
    aqi_index = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "date",
            "pref_code",
            name="uq_daily_env_date_pref",
        ),
    )
