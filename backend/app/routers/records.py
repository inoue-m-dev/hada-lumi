# app/routers/records.py

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated
from uuid import UUID
import logging
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.deps import get_current_user_id, require_profile_complete
from app.models.daily_record import DailyRecord as DailyRecordModel
from app.models.skin_score import SkinScore as SkinScoreModel
from app.schemas.daily_record import (
    DailyRecord,
    DailyRecordCreateRequest,
    DailyRecordUpdateRequest,
    DailyRecordListResponse,
)
from app.services.score_service import ScoreService
from app.services.weather_service import WeatherService

router = APIRouter(
    prefix="/records",
    tags=["records"],
    dependencies=[Depends(require_profile_complete)],
)

logger = logging.getLogger(__name__)
weather_service = WeatherService()

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]


def _ensure_not_future(target: date, *, field_name: str = "date") -> None:
    """未来日を指定した日次記録が扱えないよう制御"""
    today = datetime.now(ZoneInfo("Asia/Tokyo")).date()
    if target > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} は未来の日付を指定できません。",
        )


def _ensure_date_range_valid(start: date | None, end: date | None) -> None:
    if start is not None:
        _ensure_not_future(start, field_name="start_date")
    if end is not None:
        _ensure_not_future(end, field_name="end_date")
    if start is not None and end is not None and start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date は end_date 以前の日付を指定してください。",
        )


# ============================================================
# 1. 日次記録作成 POST /records
# ============================================================
@router.post(
    "",
    response_model=DailyRecord,
    status_code=status.HTTP_201_CREATED,
)
async def create_record(
    body: DailyRecordCreateRequest,
    db: DbSession,
    current_user_id: CurrentUserId,
):
    """1日1件の肌ログを新規作成する。

    - 同じユーザー & 同じ日付が既にある場合は 409 を返す
    """
    _ensure_not_future(body.date, field_name="date")

    stmt = select(DailyRecordModel).where(
        and_(
            DailyRecordModel.user_id == current_user_id,
            DailyRecordModel.date == body.date,
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Record already exists for this date.",
        )

    # ★ 先に daily_env を用意しておく（失敗しても日次記録の作成は続行）
    try:
        await weather_service.get_or_fetch_daily_env(
            db=db,
            user_id=current_user_id,
            target_date=body.date,
            pref_code=body.env_pref_code,
        )
    except Exception as e:
        logger.warning(
            "daily_env fetch failed on create_record (date=%s, pref=%s): %s",
            body.date,
            body.env_pref_code,
            e,
            exc_info=True,
        )

    record = DailyRecordModel(
        user_id=current_user_id,
        date=body.date,
        skin_condition=body.skin_condition,
        sleep=body.sleep,
        stress=body.stress,
        skincare_effort=body.skincare_effort,
        menstruation_status=body.menstruation_status,
        water_intake=body.water_intake,
        memo=body.memo,
        env_pref_code=body.env_pref_code,
    )

    db.add(record)
    await db.commit()
    await db.refresh(record)

    # ★ 日次記録が作られたタイミングでスコア計算＆保存
    await ScoreService.calculate_and_save_daily_score(
        db=db,
        user_id=current_user_id,
        target_date=record.date,
    )

    return record


# ============================================================
# 2. 日次記録一覧取得 GET /records
# ============================================================
@router.get(
    "",
    response_model=DailyRecordListResponse,
)
async def list_records(
    db: DbSession,
    current_user_id: CurrentUserId,
    start_date: date | None = Query(
        default=None,
        description="開始日（YYYY-MM-DD）",
    ),
    end_date: date | None = Query(
        default=None,
        description="終了日（YYYY-MM-DD）",
    ),
    limit: int = Query(
        default=30,
        ge=1,
        le=100,
        description="取得件数（デフォルト: 30, 最大: 100）",
    ),
):
    """期間を指定して日次記録一覧を取得する。"""
    _ensure_date_range_valid(start_date, end_date)

    stmt = select(DailyRecordModel).where(DailyRecordModel.user_id == current_user_id)

    if start_date is not None:
        stmt = stmt.where(DailyRecordModel.date >= start_date)
    if end_date is not None:
        stmt = stmt.where(DailyRecordModel.date <= end_date)

    stmt = stmt.order_by(DailyRecordModel.date.desc()).limit(limit)

    result = await db.execute(stmt)
    records = result.scalars().all()

    return {
        "records": records,
        "total": len(records),
    }


# ============================================================
# 3. 特定日の記録取得 GET /records/{date}
# ============================================================
@router.get(
    "/{target_date}",
    response_model=DailyRecord,
)
async def get_record_by_date(
    target_date: date,
    db: DbSession,
    current_user_id: CurrentUserId,
):
    """特定日（target_date）の記録を1件取得する。"""
    _ensure_not_future(target_date, field_name="date")

    stmt = select(DailyRecordModel).where(
        and_(
            DailyRecordModel.user_id == current_user_id,
            DailyRecordModel.date == target_date,
        )
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found for this date.",
        )

    return record


# ============================================================
# 4. 日次記録更新 PATCH /records/{date}
# ============================================================
@router.patch(
    "/{target_date}",
    response_model=DailyRecord,
)
async def update_record(
    target_date: date,
    body: DailyRecordUpdateRequest,
    db: DbSession,
    current_user_id: CurrentUserId,
):
    """特定日の記録を部分更新する（送られてきた項目だけ上書き）。
    更新後に skin_score を再計算して保存する。
    """
    _ensure_not_future(target_date, field_name="date")

    stmt = select(DailyRecordModel).where(
        and_(
            DailyRecordModel.user_id == current_user_id,
            DailyRecordModel.date == target_date,
        )
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found for this date.",
        )

    update_data = body.model_dump(exclude_unset=True)
    if "date" in update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date の変更はできません。",
        )
    if (
        "menstruation_status" in update_data
        and update_data["menstruation_status"] is not None
    ):
        if not isinstance(update_data["menstruation_status"], bool):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="menstruation_status は true/false を指定してください。",
            )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )

    # ★ 先に daily_env を用意しておく（失敗しても日次記録の更新は続行）
    pref_code = update_data.get("env_pref_code", record.env_pref_code)
    try:
        await weather_service.get_or_fetch_daily_env(
            db=db,
            user_id=current_user_id,
            target_date=record.date,
            pref_code=pref_code,
        )
    except Exception as e:
        logger.warning(
            "daily_env fetch failed on update_record (date=%s, pref=%s): %s",
            record.date,
            pref_code,
            e,
            exc_info=True,
        )

    for field, value in update_data.items():
        setattr(record, field, value)

    await db.commit()
    await db.refresh(record)

    # ★ 更新後にスコアを再計算して保存（整合性担保）
    await ScoreService.calculate_and_save_daily_score(
        db=db,
        user_id=current_user_id,
        target_date=record.date,
    )

    return record


# ============================================================
# 5. 日次記録削除 DELETE /records/{date}
# ============================================================
@router.delete(
    "/{target_date}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_record(
    target_date: date,
    db: DbSession,
    current_user_id: CurrentUserId,
):
    """特定日の記録を削除する。
    併せて同日の skin_score も削除する（孤児データ防止）。
    """
    _ensure_not_future(target_date, field_name="date")

    stmt = select(DailyRecordModel).where(
        and_(
            DailyRecordModel.user_id == current_user_id,
            DailyRecordModel.date == target_date,
        )
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record not found for this date.",
        )

    # ★ skin_score を先に削除（user_id + date で一意想定）
    await db.execute(
        delete(SkinScoreModel).where(
            and_(
                SkinScoreModel.user_id == current_user_id,
                SkinScoreModel.date == target_date,
            )
        )
    )

    # daily_record 削除
    await db.delete(record)
    await db.commit()
    # 204 No Content なので return 不要
