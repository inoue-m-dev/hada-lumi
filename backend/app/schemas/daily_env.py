# backend/app/schemas/daily_env.py
from __future__ import annotations

from datetime import date as Date, datetime as DateTime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class DailyEnv(BaseModel):
    """daily_env テーブル 1レコード分"""

    model_config = ConfigDict(from_attributes=True)

    env_id: UUID = Field(..., description="環境データID（UUID）")
    date: Date = Field(..., description="対象日")
    pref_code: str = Field(
        ...,
        pattern=r"^[0-9]{2}$",
        description="都道府県コード（01〜47）",
    )

    avg_temp_c: Optional[float] = Field(
        None,
        description="平均気温（°C）",
    )
    avg_humidity: Optional[float] = Field(
        None,
        description="平均湿度（%）",
    )
    uv_index: Optional[float] = Field(
        None,
        description="紫外線指数",
    )
    weather_code: Optional[str] = Field(
        None,
        description="天気コード（例: sunny, cloudy, rainy）",
    )
    pollen_level: Optional[int] = Field(
        None,
        description="花粉指数（任意）",
    )
    aqi_index: Optional[int] = Field(
        None,
        description="大気汚染指数（AQI）",
    )
    created_at: DateTime = Field(..., description="作成日時")
    updated_at: DateTime = Field(..., description="更新日時")
