# backend/app/schemas/skin_score.py
from __future__ import annotations

from datetime import date as Date, datetime as DateTime
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class ScoreDetails(BaseModel):
    """レーダーチャート用の各軸スコア（MVPの6軸）"""

    sleep: int = Field(..., ge=1, le=5, description="睡眠スコア（1-5）")
    stress: int = Field(..., ge=1, le=5, description="ストレススコア（1-5）")
    skincare_effort: int = Field(
        ...,
        ge=1,
        le=5,
        description="スキンケア頑張り度（1-5）",
    )
    menstrual: int = Field(..., ge=1, le=5, description="ホルモンスコア（1-5）")
    climate: int = Field(..., ge=1, le=5, description="気候スコア（1-5）")
    skin_condition: int = Field(..., ge=1, le=5, description="肌状態スコア（1-5）")


class SkinScore(BaseModel):
    """肌スコア本体（DB から返す用）"""

    model_config = ConfigDict(from_attributes=True)

    score_id: UUID = Field(..., description="スコアID")
    user_id: UUID = Field(..., description="ユーザーID")
    date: Date = Field(..., description="対象日")
    score: int = Field(..., ge=0, le=100, description="総合肌スコア（0-100）")
    score_details: ScoreDetails = Field(
        ...,
        description="各軸スコア（sleep/stress/skincare_effort/menstrual/climate/skin_condition）",
    )
    created_at: DateTime = Field(..., description="作成日時")


class SkinScoreList(BaseModel):
    """必要なら /dashboard 系で一覧返却に使う用"""

    scores: List[SkinScore]
    total: int
