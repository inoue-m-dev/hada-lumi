import uuid
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class DailyRecord(Base):
    __tablename__ = "daily_record"

    record_id = Column(
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

    # 1〜5 の5段階評価
    skin_condition = Column(Integer, nullable=False)
    sleep = Column(Integer, nullable=False)
    stress = Column(Integer, nullable=False)
    skincare_effort = Column(Integer, nullable=False)

    # 生理中フラグ
    menstruation_status = Column(
        Boolean,
        nullable=False,
        server_default="false",
    )

    # 水分摂取量（とりあえず int。単位はアプリ側で統一）
    water_intake = Column(Integer, nullable=True)

    # 255文字までのメモ
    memo = Column(String(255), nullable=True)

    # どの都道府県の環境データと紐づけるか
    env_pref_code = Column(
        String,
        ForeignKey("jp_prefecture.pref_code"),
        nullable=False,
    )

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
        # 同じユーザーが同じ日に複数レコードを持たない
        UniqueConstraint(
            "user_id",
            "date",
            name="uq_daily_record_user_date",
        ),
        # 1〜5 のチェック
        CheckConstraint(
            "skin_condition BETWEEN 1 AND 5",
            name="ck_daily_record_skin_condition_1_5",
        ),
        CheckConstraint(
            "sleep BETWEEN 1 AND 5",
            name="ck_daily_record_sleep_1_5",
        ),
        CheckConstraint(
            "stress BETWEEN 1 AND 5",
            name="ck_daily_record_stress_1_5",
        ),
        CheckConstraint(
            "skincare_effort BETWEEN 1 AND 5",
            name="ck_daily_record_skincare_effort_1_5",
        ),
    )
