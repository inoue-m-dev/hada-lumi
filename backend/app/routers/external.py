# app/routers/external.py
from datetime import date as Date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.deps import get_current_user_id
from app.schemas.daily_env import DailyEnv as DailyEnvSchema
from app.services.weather_service import WeatherService

router = APIRouter(
    prefix="/external",
    tags=["external"],
)

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]

weather_service = WeatherService()


@router.get(
    "/weather",
    response_model=DailyEnvSchema,
)
async def get_weather(
    db: DbSession,
    current_user_id: CurrentUserId,
    date: Annotated[Date | None, Query(description="対象日（YYYY-MM-DD）")] = None,
    pref_code: Annotated[
        str | None, Query(description="都道府県コード（01〜47）")
    ] = None,
):
    """
    Weather API 連携用エンドポイント

    1. daily_env に該当日・都道府県のデータがあれば DB から取得
    2. なければ WeatherAPI を叩いて daily_env に保存してから返す
       （WeatherService 側で実装）
    """
    # date が指定されていなければ「今日」
    target_date = date or Date.today()

    try:
        env = await weather_service.get_or_fetch_daily_env(
            db=db,
            user_id=current_user_id,
            target_date=target_date,
            pref_code=pref_code,
        )
    except ValueError as e:
        # ユーザーが見つからない、または都道府県が設定されていない場合
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError:
        # 暫定レスポンス
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Weather API integration is not implemented yet.",
        )

    if env is None:
        # ありえない想定だけど一応
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weather data not found.",
        )

    # SQLAlchemy モデル → Pydantic v2 スキーマ
    return DailyEnvSchema.model_validate(env)
