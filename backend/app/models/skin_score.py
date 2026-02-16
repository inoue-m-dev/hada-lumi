# app/models/skin_score.py
import uuid

from sqlalchemy import (
    Column,
    Integer,
    Date,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.db.base import Base


class SkinScore(Base):
    __tablename__ = "skin_score"

    score_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user.user_id", ondelete="CASCADE"),
        nullable=False,
    )

    # 対象日（1ユーザー1日1件）
    date = Column(Date, nullable=False)

    # 0〜100くらいの総合スコア
    score = Column(Integer, nullable=False)

    # レーダーチャート用の各軸スコア
    # 例:
    # {
    #   "sleep": 3,
    #   "stress": 2,
    #   "skincare_effort": 4,
    #   "menstrual": 1,
    #   "climate": 3,
    #   "skin_condition": 2
    # }
    score_details = Column(JSONB, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "date",
            name="uq_skin_score_user_date",
        ),
        CheckConstraint(
            "score BETWEEN 0 AND 100",
            name="ck_skin_score_0_100",
        ),
    )
