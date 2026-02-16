# app/schemas/dashboard.py
from __future__ import annotations

from datetime import date as Date, datetime as DateTime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class RadarChartAxisAverage(BaseModel):
    """
    肌環境レーダーチャート1本分の平均値（5軸）+肌状態の平均値
    """

    model_config = ConfigDict(from_attributes=True)

    sleep: float = Field(..., description="睡眠の平均値（1〜5）")
    stress: float = Field(..., description="ストレスの平均値（1〜5）")
    skincare_effort: float = Field(
        ...,
        description="スキンケア頑張り度の平均値（1〜5）",
    )
    menstrual: float = Field(
        ...,
        description="ホルモン（生理周期）の平均値（1〜5）",
    )
    climate: float = Field(
        ...,
        description="環境（気候）の平均値（1〜5）",
    )
    skin_condition: float = Field(
        ...,
        description="肌状態の平均値（1〜5）",
    )


class RadarChartData(BaseModel):
    """
    レーダーチャート用のレスポンス
    - period_average: 期間全体の平均（5軸＋肌状態）
    - problem_days_average: 問題日だけの平均（なければ null）
    - problem_dates: 問題日の日付リスト
    """

    period_average: Optional[RadarChartAxisAverage] = Field(
        None,
        description="期間全体の平均値（5軸+肌状態）",
    )
    problem_days_average: Optional[RadarChartAxisAverage] = Field(
        None,
        description="問題日（肌状態が悪い日）の平均値（5軸+肌状態）",
    )
    problem_dates: List[Date] = Field(
        default_factory=list,
        description="問題日（肌状態が悪い日）の日付リスト",
    )


class SkinScoreDetails(BaseModel):
    """
    1日分の肌スコア詳細（5軸+肌状態）
    ※ レーダーチャートの元になる5軸＋肌状態そのもの
    """

    sleep: int = Field(..., ge=1, le=5)
    stress: int = Field(..., ge=1, le=5)
    skincare_effort: int = Field(..., ge=1, le=5)
    menstrual: int = Field(..., ge=1, le=5)
    climate: int = Field(..., ge=1, le=5)
    skin_condition: int = Field(..., ge=1, le=5)


class SkinScore(BaseModel):
    """
    GET /dashboard/skin-score/{date} 用レスポンス
    """

    model_config = ConfigDict(from_attributes=True)

    score_id: UUID = Field(..., description="スコアID（UUID）")
    user_id: UUID = Field(..., description="ユーザーID（UUID）")
    date: Date = Field(..., description="対象日")
    score: int = Field(
        ...,
        ge=0,
        le=100,
        description="総合肌スコア（0〜100）",
    )
    score_details: SkinScoreDetails = Field(
        ...,
        description="各軸の詳細スコア",
    )
    created_at: DateTime = Field(..., description="作成日時")
