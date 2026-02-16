# app/models/cycle_log.py
import uuid

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class CycleLog(Base):
    __tablename__ = "cycle_log"

    cycle_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user.user_id", ondelete="CASCADE"),
        nullable=False,
    )

    # 生理開始日・終了日
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)

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
            "start_date",
            name="uq_cycle_log_user_start_date",
        ),
    )
