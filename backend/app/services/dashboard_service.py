# backend/app/services/dashboard_service.py

from __future__ import annotations

from datetime import date as Date
import json
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.models.skin_score import SkinScore as SkinScoreModel
from app.schemas.dashboard import RadarChartAxisAverage, RadarChartData

logger = logging.getLogger("uvicorn.error")


class DashboardService:
    # 「問題日」とみなす肌状態の閾値（skin_condition <= 2 を問題日とする）
    PROBLEM_SKIN_CONDITION_THRESHOLD = 2
    # レーダーチャートのキャッシュは保険として長めTTLにしている
    RADAR_CACHE_TTL_SECONDS = 60 * 60 * 12

    @staticmethod
    async def invalidate_radar_cache(user_id: UUID) -> None:
        redis_client = get_redis()
        if redis_client is None:
            return
        # user_id配下のレーダーキャッシュを全消しする（用途限定の保険用）
        pattern = f"radar:{user_id}:*"
        try:
            keys: list[str] = []
            async for key in redis_client.scan_iter(match=pattern):
                keys.append(key)
            if keys:
                await redis_client.delete(*keys)
        except Exception:
            logger.exception("radar_cache_invalidate_failed user_id=%s", str(user_id))

    @staticmethod
    async def invalidate_radar_cache_for_date(
        user_id: UUID,
        target_date: Date,
    ) -> None:
        redis_client = get_redis()
        if redis_client is None:
            return
        # 指定日が含まれる期間のキャッシュだけ消す（radar:{user}:{start}:{end}）
        pattern = f"radar:{user_id}:*"
        try:
            keys: list[str] = []
            async for key in redis_client.scan_iter(match=pattern):
                parts = key.split(":")
                if len(parts) != 4:
                    continue
                _, key_user_id, start_str, end_str = parts
                if key_user_id != str(user_id):
                    continue
                try:
                    start_date = Date.fromisoformat(start_str)
                    end_date = Date.fromisoformat(end_str)
                except ValueError:
                    continue
                if start_date <= target_date <= end_date:
                    keys.append(key)
            if keys:
                await redis_client.delete(*keys)
        except Exception:
            logger.exception(
                "radar_cache_invalidate_failed user_id=%s date=%s",
                str(user_id),
                str(target_date),
            )

    @staticmethod
    async def get_skin_score_or_404(
        db: AsyncSession,
        user_id: UUID,
        target_date: Date,
    ) -> SkinScoreModel:
        stmt = (
            select(SkinScoreModel)
            .where(SkinScoreModel.user_id == user_id)
            .where(SkinScoreModel.date == target_date)
        )
        result = await db.execute(stmt)
        skin_score = result.scalar_one_or_none()

        if skin_score is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Skin score not found for this date.",
            )

        return skin_score

    @staticmethod
    async def get_radar_chart_data(
        db: AsyncSession,
        user_id: UUID,
        start_date: Date,
        end_date: Date,
    ) -> RadarChartData:
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date must be before end_date",
            )

        cache_key = f"radar:{user_id}:{start_date}:{end_date}"
        redis_client = get_redis()
        cached = None
        if redis_client is not None:
            try:
                cached = await redis_client.get(cache_key)
            except Exception:
                logger.exception(
                    "radar_cache_read_failed user_id=%s start=%s end=%s",
                    str(user_id),
                    str(start_date),
                    str(end_date),
                )
        if cached:
            try:
                logger.info(
                    "radar_cache_hit user_id=%s start=%s end=%s",
                    str(user_id),
                    str(start_date),
                    str(end_date),
                )
                return RadarChartData.model_validate_json(cached)
            except Exception:
                pass

        scores = await DashboardService._get_skin_scores_in_range(
            db=db,
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )
        data = DashboardService._build_radar_chart_data_from_scores(scores)
        if redis_client is not None:
            try:
                # 失敗しても本処理を止めない（キャッシュは任意）
                payload = json.dumps(
                    data.model_dump(mode="json"),
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
                await redis_client.setex(
                    cache_key,
                    DashboardService.RADAR_CACHE_TTL_SECONDS,
                    payload,
                )
            except Exception:
                logger.exception(
                    "radar_cache_write_failed user_id=%s start=%s end=%s",
                    str(user_id),
                    str(start_date),
                    str(end_date),
                )
        return data

    @staticmethod
    async def _get_skin_scores_in_range(
        db: AsyncSession,
        user_id: UUID,
        start_date: Date,
        end_date: Date,
    ) -> list[SkinScoreModel]:
        stmt = (
            select(SkinScoreModel)
            .where(SkinScoreModel.user_id == user_id)
            .where(
                and_(
                    SkinScoreModel.date >= start_date,
                    SkinScoreModel.date <= end_date,
                )
            )
            .order_by(SkinScoreModel.date.asc())
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    def _build_radar_chart_data_from_scores(
        scores: list[SkinScoreModel],
    ) -> RadarChartData:
        if not scores:
            return RadarChartData(
                period_average=None,
                problem_days_average=None,
                problem_dates=[],
            )

        axes = [
            "sleep",
            "stress",
            "skincare_effort",
            "menstrual",
            "climate",
            "skin_condition",
        ]

        total_sums: dict[str, float] = {axis: 0.0 for axis in axes}
        total_count = 0

        problem_sums: dict[str, float] = {axis: 0.0 for axis in axes}
        problem_count = 0
        problem_dates: list[Date] = []

        for score in scores:
            details = score.score_details or {}

            day_values: dict[str, float] = {}
            for axis in axes:
                value = details.get(axis)
                if value is None:
                    # 欠損していた場合は「その日を集計対象から外す」
                    break
                day_values[axis] = float(value)
            else:
                for axis in axes:
                    total_sums[axis] += day_values[axis]
                total_count += 1

                if (
                    day_values["skin_condition"]
                    <= DashboardService.PROBLEM_SKIN_CONDITION_THRESHOLD
                ):
                    for axis in axes:
                        problem_sums[axis] += day_values[axis]
                    problem_count += 1
                    problem_dates.append(score.date)

        if total_count == 0:
            return RadarChartData(
                period_average=None,
                problem_days_average=None,
                problem_dates=[],
            )

        period_avg = {axis: total_sums[axis] / total_count for axis in axes}

        if problem_count > 0:
            problem_avg = {axis: problem_sums[axis] / problem_count for axis in axes}
            problem_days_average = RadarChartAxisAverage(**problem_avg)
        else:
            problem_days_average = None

        period_average = RadarChartAxisAverage(**period_avg)

        return RadarChartData(
            period_average=period_average,
            problem_days_average=problem_days_average,
            problem_dates=problem_dates,
        )
