# backend/app/routers/prefectures.py
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.jp_prefecture import JpPrefecture
from app.schemas.prefecture import Prefecture, PrefectureListResponse

router = APIRouter(
    prefix="/prefectures",
    tags=["prefectures"],
)

# ✅ 依存性は Annotated に一本化
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get(
    "/",
    response_model=PrefectureListResponse,
)
async def get_prefectures(
    db: DbSession,
):
    """
    都道府県一覧を取得する

    Returns:
        PrefectureListResponse: {
            "prefectures": List[Prefecture],
            "total": int
        }
    """
    try:
        stmt = select(JpPrefecture).order_by(JpPrefecture.pref_code)
        result = await db.execute(stmt)
        prefectures = result.scalars().all()

        prefecture_list = [Prefecture.model_validate(pref) for pref in prefectures]

        return PrefectureListResponse(
            prefectures=prefecture_list,
            total=len(prefecture_list),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"都道府県データの取得に失敗しました: {str(e)}",
        )


@router.get("/ping")
async def ping_prefectures():
    return {"message": "prefectures ok"}
