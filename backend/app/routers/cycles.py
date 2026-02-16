# backend/app/routers/cycles.py
from typing import Annotated, Optional
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.deps import get_current_user_id, require_profile_complete
from app.models.cycle_log import CycleLog as CycleLogModel
from app.schemas.cycle_log import (
    CycleEndRequest,
    CycleLog,
    CycleLogCreateRequest,
    CycleLogListResponse,
    CycleLogUpdateRequest,
)
from app.services.score_service import ScoreService

router = APIRouter(
    prefix="/cycles",
    tags=["cycles"],
    dependencies=[Depends(require_profile_complete)],
)

# 共通依存
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]


# ============================================================
# Internal: cycle date validation (overlap / ordering)
# ============================================================
async def _validate_cycle_dates(
    db: AsyncSession,
    *,
    user_id: UUID,
    start_date: date,
    end_date: Optional[date],
    exclude_cycle_id: Optional[UUID] = None,
) -> None:
    """
    生理周期ログが、前後の周期と重複・逆転していないかを検証する。
    ルール:
    - end_date が指定されている場合：
    - end_date は start_date 以降の日付でなければならない
    - start_date は、直前の生理周期の end_date より後の日付でなければならない
    （直前の周期に end_date が存在する場合）
    - end_date が指定されている場合：
    - 次の生理周期の start_date より前の日付でなければならない
    - end_date が None（未終了の周期）の場合：
    - その周期は常に「最新の周期」でなければならない
    - 未終了の周期の後に、開始済みの周期が存在してはならない
    """

    # 0) Basic ordering
    if end_date is not None and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="終了日は開始日以降の日付を指定してください。",
        )

    # 1) Previous cycle: the latest cycle with start_date < this start_date
    stmt_prev = (
        select(CycleLogModel)
        .where(CycleLogModel.user_id == user_id)
        .where(CycleLogModel.start_date < start_date)
        .order_by(desc(CycleLogModel.start_date))
        .limit(1)
    )
    if exclude_cycle_id is not None:
        stmt_prev = stmt_prev.where(CycleLogModel.cycle_id != exclude_cycle_id)

    prev = (await db.execute(stmt_prev)).scalar_one_or_none()
    if prev is not None:
        # If previous is still open, data integrity is already broken; block edits
        # that would worsen it
        if prev.end_date is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="未終了の生理周期が存在します（整合性エラー）。先に終了日を入力してください。",
            )
        # Must be strictly after prev.end_date
        if start_date <= prev.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="開始日は前回の生理終了日より後の日付を指定してください。",
            )

    # 2) Next cycle: the earliest cycle with start_date > this start_date
    stmt_next = (
        select(CycleLogModel)
        .where(CycleLogModel.user_id == user_id)
        .where(CycleLogModel.start_date > start_date)
        .order_by(CycleLogModel.start_date.asc())
        .limit(1)
    )
    if exclude_cycle_id is not None:
        stmt_next = stmt_next.where(CycleLogModel.cycle_id != exclude_cycle_id)

    next_cycle = (await db.execute(stmt_next)).scalar_one_or_none()

    # If open cycle, it must be the latest (no next cycle)
    if end_date is None:
        if next_cycle is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "未終了の生理周期は最新のものとして登録してください"
                    "（未来の周期より前に未終了は作れません）。"
                ),
            )
        return

    # If end_date exists, it must be strictly before the next start_date
    if next_cycle is not None and end_date >= next_cycle.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="終了日は次回の生理開始日より前の日付を指定してください。",
        )


# ============================================================
# 1. 生理開始日登録（POST /cycles）
# ============================================================
@router.post(
    "",
    response_model=CycleLog,
    status_code=status.HTTP_201_CREATED,
)
async def create_cycle_log(
    body: CycleLogCreateRequest,
    db: DbSession,
    current_user_id: CurrentUserId,
):
    """
    生理開始日の登録 API

    - end_date IS NULL の cycle が既に存在する場合は 400
    """
    # 🔒 既に「閉じていない cycle」が存在するかチェック
    stmt_open = select(CycleLogModel).where(
        CycleLogModel.user_id == current_user_id,
        CycleLogModel.end_date.is_(None),
    )
    result = await db.execute(stmt_open)
    open_cycle = result.scalar_one_or_none()

    if open_cycle is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="前回の生理が終了していません。終了日を先に入力してください。",
        )

    # ✅ start/end が前後のcycleと重ならないか検証
    await _validate_cycle_dates(
        db,
        user_id=current_user_id,
        start_date=body.start_date,
        end_date=body.end_date,
        exclude_cycle_id=None,
    )

    new_cycle = CycleLogModel(
        user_id=current_user_id,
        start_date=body.start_date,
        end_date=body.end_date,
    )

    db.add(new_cycle)
    await db.commit()
    await db.refresh(new_cycle)

    # ✅ cycle 変更 → 影響範囲のスコア再計算（範囲決定はサービス側）
    await ScoreService.recalculate_after_cycle_change(
        db=db,
        user_id=current_user_id,
        cycle_start=new_cycle.start_date,
        cycle_end=new_cycle.end_date,
    )

    return new_cycle


# ============================================================
# 2. 生理周期ログ一覧取得（GET /cycles）
# ============================================================
@router.get(
    "",
    response_model=CycleLogListResponse,
)
async def list_cycles(
    db: DbSession,
    current_user_id: CurrentUserId,
    limit: int = Query(
        12,
        ge=1,
        le=50,
        description="取得件数（デフォルト: 12, 最大: 50）",
    ),
):
    """
    生理周期ログの一覧取得。

    - ユーザーごとの cycle_log を start_date の新しい順に並べて返す
    """
    stmt = (
        select(CycleLogModel)
        .where(CycleLogModel.user_id == current_user_id)
        .order_by(desc(CycleLogModel.start_date))
        .limit(limit)
    )
    result = await db.execute(stmt)
    cycles = result.scalars().all()

    return CycleLogListResponse(
        cycles=cycles,
        total=len(cycles),
    )


# ============================================================
# 3. 生理終了日の登録（PATCH /cycles/end） ※旧仕様を残す（ID不要で安全）
# ============================================================
@router.patch(
    "/end",
    response_model=CycleLog,
)
async def close_current_cycle(
    body: CycleEndRequest,
    db: DbSession,
    current_user_id: CurrentUserId,
):
    # ✅ 開いているサイクル（end_date が NULL）を全部拾う
    # - 「未終了は最大1件」の前提が壊れていたら 409 で止める
    stmt_open = (
        select(CycleLogModel)
        .where(
            CycleLogModel.user_id == current_user_id,
            CycleLogModel.end_date.is_(None),
        )
        .order_by(desc(CycleLogModel.start_date))
    )
    result = await db.execute(stmt_open)
    open_cycles = result.scalars().all()

    # ✅ 未終了がない → 終了できない
    if len(open_cycles) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="終了できる生理周期がありません。",
        )

    # ✅ 未終了が2件以上 → データ整合性エラー（本来ありえない）
    if len(open_cycles) >= 2:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="未終了の生理周期が複数あります（整合性エラー）。管理者に連絡してください。",
        )

    cycle = open_cycles[0]

    # ✅ 終了日が開始日より前は NG
    if body.end_date < cycle.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="終了日は開始日以降の日付を指定してください。",
        )

    # ✅ 前後のcycleと重ならないか検証（通常 next は無いが保険）
    await _validate_cycle_dates(
        db,
        user_id=current_user_id,
        start_date=cycle.start_date,
        end_date=body.end_date,
        exclude_cycle_id=cycle.cycle_id,
    )

    cycle.end_date = body.end_date

    await db.commit()
    await db.refresh(cycle)

    # ✅ cycle 変更 → 影響範囲のスコア再計算（範囲決定はサービス側）
    await ScoreService.recalculate_after_cycle_change(
        db=db,
        user_id=current_user_id,
        cycle_start=cycle.start_date,
        cycle_end=cycle.end_date,
    )

    return cycle


# ============================================================
# 4. 生理周期ログの更新（PATCH /cycles/{cycle_id}） ※管理表の編集用
# ============================================================
@router.patch(
    "/{cycle_id}",
    response_model=CycleLog,
)
async def update_cycle(
    cycle_id: UUID = Path(..., description="更新対象のcycle_id"),
    body: CycleLogUpdateRequest = ...,
    db: DbSession = ...,
    current_user_id: CurrentUserId = ...,
):
    """
    生理周期ログの更新 API（管理表の編集用）

    - start_date / end_date を部分更新できる
    - end_date を None に戻す（終了取り消し）は現状想定しない
      ※必要になったら CycleLogUpdateRequest の仕様と整合性チェックを拡張する
    """
    stmt = select(CycleLogModel).where(
        CycleLogModel.cycle_id == cycle_id,
        CycleLogModel.user_id == current_user_id,
    )
    result = await db.execute(stmt)
    cycle = result.scalar_one_or_none()

    if cycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定の生理周期が見つかりません。",
        )

    old_start = cycle.start_date
    old_end = cycle.end_date

    # 更新（指定があるものだけ）
    if body.start_date is not None:
        cycle.start_date = body.start_date
    if body.end_date is not None:
        cycle.end_date = body.end_date

    # バリデーション：終了日は開始日以降
    if cycle.end_date is not None and cycle.end_date < cycle.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="終了日は開始日以降の日付を指定してください。",
        )

    # ✅ 前後のcycleと重ならないか検証
    await _validate_cycle_dates(
        db,
        user_id=current_user_id,
        start_date=cycle.start_date,
        end_date=cycle.end_date,
        exclude_cycle_id=cycle_id,
    )

    await db.commit()
    await db.refresh(cycle)

    # ✅ 旧・新それぞれの影響範囲を再計算（start/end の編集は過去の予測に影響）
    await ScoreService.recalculate_after_cycle_change(
        db=db,
        user_id=current_user_id,
        cycle_start=old_start,
        cycle_end=old_end,
    )
    await ScoreService.recalculate_after_cycle_change(
        db=db,
        user_id=current_user_id,
        cycle_start=cycle.start_date,
        cycle_end=cycle.end_date,
    )

    return cycle


# ============================================================
# 5. 生理周期ログの削除（DELETE /cycles/{cycle_id}） ※将来用（UIでは出さない前提）
# ============================================================
@router.delete(
    "/{cycle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_cycle(
    cycle_id: UUID = Path(..., description="削除対象のcycle_id"),
    db: DbSession = ...,
    current_user_id: CurrentUserId = ...,
):
    """
    生理周期ログの削除 API

    - 物理削除（必要なら論理削除へ変更）
    - UIからは基本触らせない想定（将来の保守/運用用）
    """
    stmt = select(CycleLogModel).where(
        CycleLogModel.cycle_id == cycle_id,
        CycleLogModel.user_id == current_user_id,
    )
    result = await db.execute(stmt)
    cycle = result.scalar_one_or_none()

    if cycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定の生理周期が見つかりません。",
        )

    old_start = cycle.start_date
    old_end = cycle.end_date

    await db.execute(
        delete(CycleLogModel).where(
            CycleLogModel.cycle_id == cycle_id,
            CycleLogModel.user_id == current_user_id,
        )
    )
    await db.commit()

    # ✅ 削除によりホルモン系スコアが変わり得るため、影響範囲を再計算
    await ScoreService.recalculate_after_cycle_change(
        db=db,
        user_id=current_user_id,
        cycle_start=old_start,
        cycle_end=old_end,
    )

    return None
