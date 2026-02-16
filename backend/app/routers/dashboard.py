# backend/app/routers/dashboard.py

from datetime import date as Date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.deps import get_current_user_id, require_profile_complete
from app.schemas.dashboard import RadarChartData, SkinScore as DashboardSkinScore
from app.schemas.ai_result import AIResult, AnalysisRequest
from app.services.ai_service import AIService
from app.services.dashboard_service import DashboardService  # ✅ 追加

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_profile_complete)],
)

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]


@router.get(
    "/skin-score/{target_date}",
    response_model=DashboardSkinScore,
)
async def get_skin_score(
    target_date: Date,
    db: DbSession,
    current_user_id: CurrentUserId,
):
    return await DashboardService.get_skin_score_or_404(
        db=db,
        user_id=current_user_id,
        target_date=target_date,
    )


@router.get(
    "/radar-chart",
    response_model=RadarChartData,
)
async def get_radar_chart(
    db: DbSession,
    current_user_id: CurrentUserId,
    start_date: Annotated[Date, Query(description="集計開始日（YYYY-MM-DD）")],
    end_date: Annotated[Date, Query(description="集計終了日（YYYY-MM-DD）")],
):
    return await DashboardService.get_radar_chart_data(
        db=db,
        user_id=current_user_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.post(
    "/analysis",
    response_model=AIResult,
)
async def run_ai_analysis(
    body: AnalysisRequest,
    db: DbSession,
    current_user_id: CurrentUserId,
    force_refresh: Annotated[
        bool, Query(description="true の場合は既存結果があっても再生成する")
    ] = False,
):
    # 既に同日分のAI結果がDBにあるなら即返す（体感速度改善）
    if not force_refresh:
        cached = await AIService.get_cached_result(
            db=db,
            user_id=current_user_id,
            target_date=body.target_date,
        )
        if cached is not None:
            return cached

    ai_result = await AIService.run_analysis_with_openai(
        db=db,
        user_id=current_user_id,
        request=body,
    )
    return ai_result


@router.post("/analysis/context")
async def get_ai_context(
    body: AnalysisRequest,
    db: DbSession,
    current_user_id: CurrentUserId,
):
    return await AIService.run_analysis_and_build_context_only(
        db=db,
        user_id=current_user_id,
        request=body,
    )
