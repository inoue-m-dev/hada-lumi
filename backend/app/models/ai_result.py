# app/models/ai_result.py
import uuid
from sqlalchemy import (
    Column,
    String,
    Date,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.base import Base


class AIResult(Base):
    __tablename__ = "ai_result"

    ai_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user.user_id", ondelete="CASCADE"),
        nullable=False,
    )

    # 分析対象日
    date = Column(Date, nullable=False)

    # 太字で出す「主原因」
    root_cause = Column(String, nullable=False)

    # アドバイス（NULL 可）
    advice = Column(String, nullable=True)

    # GPT の入出力 JSON（NULL 可）
    analysis_raw = Column(JSONB, nullable=True)

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
            "user_id",
            "date",
            name="uq_ai_result_user_date",
        ),
    )
