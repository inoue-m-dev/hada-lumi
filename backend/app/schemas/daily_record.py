# backend/app/schemas/daily_record.py
from __future__ import annotations

from datetime import date as Date, datetime as DateTime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class DailyRecord(BaseModel):
    """
    DB から返す日次記録（レスポンス用）
    """

    model_config = ConfigDict(from_attributes=True)

    record_id: UUID = Field(..., description="レコードID（UUID）")
    user_id: UUID = Field(..., description="ユーザーID（UUID）")
    date: Date = Field(..., description="記録日")
    skin_condition: int = Field(..., ge=1, le=5, description="肌状態（1-5）")
    sleep: int = Field(..., ge=1, le=5, description="睡眠状態（1-5）")
    stress: int = Field(..., ge=1, le=5, description="ストレス（1-5）")
    skincare_effort: int = Field(
        ...,
        ge=1,
        le=5,
        description="スキンケア頑張り度（1-5）",
    )
    menstruation_status: bool = Field(
        None,
        description="生理中かどうか（true = 生理中）",
    )
    water_intake: Optional[int] = Field(
        None,
        description="水分摂取量",
    )
    memo: Optional[str] = Field(
        None,
        max_length=255,
        description="メモ（最大255文字）",
    )
    env_pref_code: str = Field(
        ...,
        pattern=r"^[0-9]{2}$",
        description="気象データ紐付け都道府県コード",
    )
    created_at: DateTime = Field(..., description="作成日時")
    updated_at: DateTime = Field(..., description="更新日時")


class DailyRecordCreateRequest(BaseModel):
    """
    POST /records 用（新規作成）
    """

    date: Date = Field(..., description="記録日（YYYY-MM-DD）")
    skin_condition: int = Field(..., ge=1, le=5, description="肌状態（1-5）")
    sleep: int = Field(..., ge=1, le=5, description="睡眠状態（1-5）")
    stress: int = Field(..., ge=1, le=5, description="ストレス（1-5）")
    skincare_effort: int = Field(
        ...,
        ge=1,
        le=5,
        description="スキンケア頑張り度（1-5）",
    )
    menstruation_status: bool = Field(
        None,
        description="生理中かどうか（true = 生理中）",
    )
    water_intake: Optional[int] = Field(
        None,
        description="水分摂取量",
    )
    memo: Optional[str] = Field(
        None,
        max_length=255,
        description="メモ（最大255文字）",
    )
    env_pref_code: str = Field(
        ...,
        pattern=r"^[0-9]{2}$",
        description="気象データ紐付け都道府県コード",
    )


class DailyRecordUpdateRequest(BaseModel):
    """
    PATCH /records/{date} 用：部分更新
    """

    skin_condition: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="肌状態（1-5）",
    )
    sleep: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="睡眠状態（1-5）",
    )
    stress: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="ストレス（1-5）",
    )
    skincare_effort: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="スキンケア頑張り度（1-5）",
    )
    menstruation_status: Optional[bool] = Field(
        None,
        description="生理中かどうか（true = 生理中）",
    )
    water_intake: Optional[int] = Field(
        None,
        description="水分摂取量",
    )
    memo: Optional[str] = Field(
        None,
        max_length=255,
        description="メモ（最大255文字）",
    )
    env_pref_code: Optional[str] = Field(
        None,
        pattern=r"^[0-9]{2}$",
        description="気象データ紐付け都道府県コード",
    )


class DailyRecordListResponse(BaseModel):
    """
    GET /records 用：一覧レスポンス
    YAML: { records: DailyRecord[], total: number }
    """

    records: list[DailyRecord] = Field(
        ...,
        description="日次記録の配列",
    )
    total: int = Field(
        ...,
        description="総件数",
    )
