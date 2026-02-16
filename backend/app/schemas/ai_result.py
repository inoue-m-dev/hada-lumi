# backend/app/schemas/ai_result.py
from __future__ import annotations

from datetime import date as Date, datetime as DateTime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class AnalysisRequest(BaseModel):
    """POST /dashboard/analysis 用"""

    target_date: Date = Field(..., description="分析対象日")
    problem_dates: Optional[List[Date]] = Field(
        None,
        description="問題日（肌状態が悪い日）の日付リスト（任意）",
    )


class AIResult(BaseModel):
    """AI 原因分析結果"""

    model_config = ConfigDict(from_attributes=True)

    ai_id: UUID = Field(..., description="AI分析結果ID（UUID）")
    user_id: UUID = Field(..., description="ユーザーID（UUID）")
    date: Date = Field(..., description="分析対象日")
    root_cause: str = Field(..., description="カード上部の太字メッセージ")
    advice: Optional[str] = Field(
        None,
        description="詳細説明・アドバイス（複数行・NULL可）",
    )
    analysis_raw: Optional[Dict[str, Any]] = Field(
        None,
        description="GPT入出力の生ログ（任意）",
    )
    created_at: DateTime = Field(..., description="作成日時")
    updated_at: DateTime = Field(..., description="更新日時")
