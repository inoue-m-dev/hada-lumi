# app/schemas/error.py
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    error: str = Field(..., description="エラー内容（例: Bad Request）")
    detail: Optional[str] = Field(
        None,
        description="エラーの詳細説明",
    )

    model_config = {"from_attributes": True}
