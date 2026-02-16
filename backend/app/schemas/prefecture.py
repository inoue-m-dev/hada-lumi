# app/schemas/prefecture.py
from __future__ import annotations

from typing import List
from pydantic import BaseModel, Field, ConfigDict


class Prefecture(BaseModel):
    # Pydantic v2 用の設定（旧 orm_mode / from_attributes 相当）
    model_config = ConfigDict(from_attributes=True)

    pref_code: str = Field(
        ...,
        pattern=r"^[0-9]{2}$",
        description="都道府県コード（01-47）",
    )
    name_ja: str = Field(..., description="都道府県名（日本語）")
    latitude: float = Field(..., description="代表点の緯度")
    longitude: float = Field(..., description="代表点の経度")


class PrefectureListResponse(BaseModel):
    prefectures: List[Prefecture]
    total: int
