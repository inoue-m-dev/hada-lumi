# backend/app/models/user.py
import uuid

from sqlalchemy import (
    Column,
    String,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    func,
    Integer,
    text,  # ★ 追加
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class User(Base):
    __tablename__ = "user"

    user_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    firebase_uid = Column(
        String,
        unique=True,
        nullable=False,
    )
    email = Column(
        String,
        nullable=True,
    )
    # 今回は google 固定想定
    auth_provider = Column(
        String,
        nullable=False,
    )

    skin_type = Column(
        String,
        nullable=True,
    )
    cycle_length_days = Column(
        Integer,
        nullable=True,
    )
    last_menstruation_start = Column(
        Date,
        nullable=True,
    )
    # DBレベルでは NOT NULL + default true にしておく
    is_menstruation_user = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    # ★ 初回登録では未設定ありえるので NULL 可にする
    pref_code = Column(
        String,
        ForeignKey("jp_prefecture.pref_code"),
        nullable=True,
    )
    pref_name = Column(
        String,
        nullable=True,
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
