# backend/app/schemas/cycle_log.py
from __future__ import annotations

from datetime import date as Date, datetime as DateTime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class CycleLog(BaseModel):
    """生理周期ログ 1件分（レスポンス用）"""

    # ✅ Pydantic v2 の orm_mode 相当
    model_config = ConfigDict(from_attributes=True)

    cycle_id: UUID = Field(..., description="生理サイクルログID（UUID）")
    user_id: UUID = Field(..., description="ユーザーID（UUID）")
    start_date: Date = Field(..., description="生理開始日")
    end_date: Optional[Date] = Field(
        None,
        description="生理終了日（未入力の場合は null）",
    )
    created_at: DateTime = Field(..., description="作成日時")
    updated_at: DateTime = Field(..., description="更新日時")


class CycleLogCreateRequest(BaseModel):
    """POST /cycles 用：生理開始日登録"""

    start_date: Date = Field(..., description="生理開始日")
    end_date: Optional[Date] = Field(
        None,
        description="生理終了日（任意・基本は未入力）",
    )


class CycleEndRequest(BaseModel):
    """PATCH /cycles/end 用：生理終了日の登録"""

    end_date: Date = Field(..., description="生理終了日")


class CycleLogListResponse(BaseModel):
    """GET /cycles 用：生理周期ログ一覧レスポンス"""

    cycles: List[CycleLog]
    total: int


# PATCH /cycles/{cycle_id} 用：生理周期ログの部分更新
class CycleLogUpdateRequest(BaseModel):
    """PATCH /cycles/{cycle_id} 用：生理周期ログの部分更新"""

    start_date: Optional[Date] = Field(
        None,
        description="生理開始日（変更する場合のみ指定）",
    )
    end_date: Optional[Date] = Field(
        None,
        description="生理終了日（変更する場合のみ指定）",
    )
