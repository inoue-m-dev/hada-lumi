# app/services/score_service.py
from __future__ import annotations

from datetime import date as Date, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dashboard_service import DashboardService
from app.models.daily_record import DailyRecord as DailyRecordModel
from app.models.daily_env import DailyEnv as DailyEnvModel
from app.models.cycle_log import CycleLog as CycleLogModel
from app.models.user import User as UserModel
from app.models.skin_score import SkinScore as SkinScoreModel


class ScoreService:
    """
    日次記録(DailyRecord)から肌スコア(SkinScore)を計算して保存するサービスクラス。

    - ベースは「睡眠 / ストレス / スキンケア / 肌状態」
    - ホルモン（生理周期）＆気候も反映
    """

    # ============================================================
    # cycle変更時の再計算レンジ（A案）
    # ============================================================
    RECALC_DAYS_BEFORE = 60
    RECALC_DAYS_AFTER = 60

    # 再計算のコミットを小分けにして失敗しにくくする
    RECALC_CHUNK_DAYS = 7

    # 終了日変更は影響範囲が狭いので小さめのバッファ
    RECALC_END_ONLY_BEFORE = 3
    RECALC_END_ONLY_AFTER = 10
    DEFAULT_MENSTRUATION_DAYS = 5

    @staticmethod
    async def _calc_recalc_range(
        db: AsyncSession,
        user_id: UUID,
        cycle_start: Date,
        cycle_end: Optional[Date],
    ) -> tuple[Date, Date]:
        """
        cycle_log の start/end が変わったときに、再計算する日付範囲を返す。

        考え方（MVP）:
        - start_date の変更は「ホルモン予測の起点」が動くので影響が広い。
          → 前のcycle境界（直前cycleの end_date or start_date）まで遡って再計算する。
        - end_date の変更は「月経期(=2)の範囲」が変わるだけで、予測起点(start_date)は変わらない。
          → start〜end 付近に限定して再計算する（軽量化）。
        """
        # 直前のcycle（start_date が cycle_start より前の最新）
        stmt_prev = (
            select(CycleLogModel)
            .where(CycleLogModel.user_id == user_id)
            .where(CycleLogModel.start_date < cycle_start)
            .order_by(CycleLogModel.start_date.desc())
            .limit(1)
        )
        r_prev = await db.execute(stmt_prev)
        prev_cycle: Optional[CycleLogModel] = r_prev.scalar_one_or_none()

        prev_anchor = None
        if prev_cycle is not None:
            prev_anchor = prev_cycle.end_date or prev_cycle.start_date

        today = Date.today()

        # range_end は「対象cycleのend or today」から後ろへ
        base_end = cycle_end or today
        # end-only の場合は小さめにして負荷を抑える（endが確定しているときに効く）
        if cycle_end is not None:
            range_end = base_end + timedelta(days=ScoreService.RECALC_END_ONLY_AFTER)
        else:
            range_end = base_end + timedelta(days=ScoreService.RECALC_DAYS_AFTER)

        # range_start は start変更の影響に備えて「前のcycle境界」へ
        # prevが取れないときは従来どおり広め
        if prev_anchor is not None:
            # 直前cycleの終端（または開始）付近から少し前を含める
            range_start = prev_anchor - timedelta(days=ScoreService.RECALC_DAYS_BEFORE)
        else:
            range_start = cycle_start - timedelta(days=ScoreService.RECALC_DAYS_BEFORE)

        # ただし end_date 変更だけを想定する場合は、start付近に寄せたほうが軽い。
        # ※呼び出し側が「old/new」を両方呼ぶので、start変更時は結果的に広めが2回走ってもOK。
        if cycle_end is not None:
            range_start = min(
                range_start,
                cycle_start - timedelta(days=ScoreService.RECALC_END_ONLY_BEFORE),
            )

        return range_start, range_end

    @staticmethod
    async def recalculate_after_cycle_change(
        db: AsyncSession,
        user_id: UUID,
        cycle_start: Date,
        cycle_end: Optional[Date],
    ) -> None:
        """
        cycle_log の作成/更新/削除後に呼ばれる。

        - 影響が出やすい期間をまとめて再計算し、skin_score を上書きする。
        """
        start_date, end_date = await ScoreService._calc_recalc_range(
            db=db,
            user_id=user_id,
            cycle_start=cycle_start,
            cycle_end=cycle_end,
        )
        await ScoreService.recalculate_scores_for_user_in_range(
            db=db,
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
        )

    @staticmethod
    async def recalculate_scores_for_user_in_range(
        db: AsyncSession,
        user_id: UUID,
        start_date: Date,
        end_date: Date,
    ) -> None:
        """
        指定期間の skin_score を再計算して保存（上書き）する。

        - 期間内の DailyRecord がある日だけ再計算する（全日走査しない）
        - まとめて commit（チャンク単位）して失敗しにくくする
        """
        # ✅ 期間内に存在する DailyRecord の日付だけを拾う（全日走査しない）
        stmt_dates = (
            select(DailyRecordModel.date)
            .where(DailyRecordModel.user_id == user_id)
            .where(DailyRecordModel.date >= start_date)
            .where(DailyRecordModel.date <= end_date)
            .order_by(DailyRecordModel.date.asc())
        )
        r_dates = await db.execute(stmt_dates)
        dates = [row[0] for row in r_dates.all()]

        if not dates:
            return

        # ✅ 小分けコミットで失敗しにくくする
        pending = 0
        changed_dates: list[Date] = []
        for d in dates:
            _, changed = await ScoreService.calculate_and_save_daily_score(
                db=db,
                user_id=user_id,
                target_date=d,
                commit=False,
            )
            if changed:
                changed_dates.append(d)
            pending += 1

            if pending >= ScoreService.RECALC_CHUNK_DAYS:
                await db.commit()
                await ScoreService._invalidate_radar_cache_for_dates(
                    user_id=user_id,
                    dates=changed_dates,
                )
                pending = 0
                changed_dates = []

        if pending > 0:
            await db.commit()
            await ScoreService._invalidate_radar_cache_for_dates(
                user_id=user_id,
                dates=changed_dates,
            )

    @staticmethod
    async def calculate_and_save_daily_score(
        db: AsyncSession,
        user_id: UUID,
        target_date: Date,
        commit: bool = True,
    ) -> tuple[Optional[SkinScoreModel], bool]:
        """
        指定ユーザー・指定日の DailyRecord から肌スコアを計算し、
        skin_score テーブルに UPSERT（更新 or 新規作成）する。

        戻り値:
            - 保存された SkinScoreModel
            - 保存結果に変更があったかどうか
        """
        # 1. 対象日の日次記録を取得
        stmt = (
            select(DailyRecordModel)
            .where(DailyRecordModel.user_id == user_id)
            .where(DailyRecordModel.date == target_date)
        )
        result = await db.execute(stmt)
        daily_record: Optional[DailyRecordModel] = result.scalar_one_or_none()

        if daily_record is None:
            return None, False

        # 2. 周辺データ取得（環境・ユーザー・生理周期）
        daily_env = await ScoreService._get_daily_env(
            db=db,
            target_date=target_date,
            pref_code=daily_record.env_pref_code,
        )
        user = await ScoreService._get_user(db=db, user_id=user_id)
        last_cycle = await ScoreService._get_last_cycle(
            db=db,
            user_id=user_id,
            target_date=target_date,
        )

        # 3. 日次記録＋環境＋生理情報からスコア計算
        score, score_details = ScoreService._calculate_score_from_daily_record(
            daily_record=daily_record,
            daily_env=daily_env,
            user=user,
            last_cycle=last_cycle,
            target_date=target_date,
        )

        # 4. 既存の SkinScore を探す（user_id + date は Unique 制約）
        stmt_score = (
            select(SkinScoreModel)
            .where(SkinScoreModel.user_id == user_id)
            .where(SkinScoreModel.date == target_date)
        )
        result_score = await db.execute(stmt_score)
        existing_score: Optional[SkinScoreModel] = result_score.scalar_one_or_none()

        old_score = existing_score.score if existing_score is not None else None
        old_details = (
            dict(existing_score.score_details)
            if existing_score and existing_score.score_details
            else None
        )

        if existing_score is None:
            skin_score = SkinScoreModel(
                user_id=user_id,
                date=target_date,
                score=score,
                score_details=score_details,
            )
            db.add(skin_score)
        else:
            existing_score.score = score
            existing_score.score_details = score_details
            skin_score = existing_score

        changed = (old_score != score) or (old_details != score_details)
        if commit:
            await db.commit()
            await db.refresh(skin_score)
            if changed:
                # この日付のスコアが変わった場合のみ該当期間のレーダーキャッシュを無効化
                await DashboardService.invalidate_radar_cache_for_date(
                    user_id=user_id,
                    target_date=target_date,
                )
        else:
            # バッチ処理向け：外側でまとめて commit する
            await db.flush()

        return skin_score, changed

    @staticmethod
    async def _invalidate_radar_cache_for_dates(
        user_id: UUID,
        dates: list[Date],
    ) -> None:
        if not dates:
            return
        for d in sorted(set(dates)):
            await DashboardService.invalidate_radar_cache_for_date(
                user_id=user_id,
                target_date=d,
            )

    # ----------------------------------------------------------
    # 内部用: データ取得ヘルパー
    # ----------------------------------------------------------
    @staticmethod
    async def _get_daily_env(
        db: AsyncSession,
        target_date: Date,
        pref_code: str,
    ) -> Optional[DailyEnvModel]:
        stmt = (
            select(DailyEnvModel)
            .where(DailyEnvModel.date == target_date)
            .where(DailyEnvModel.pref_code == pref_code)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_user(
        db: AsyncSession,
        user_id: UUID,
    ) -> Optional[UserModel]:
        stmt = select(UserModel).where(UserModel.user_id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        return user

    @staticmethod
    async def _get_last_cycle(
        db: AsyncSession,
        user_id: UUID,
        target_date: Date,
    ) -> Optional[CycleLogModel]:
        stmt = (
            select(CycleLogModel)
            .where(CycleLogModel.user_id == user_id)
            .where(CycleLogModel.start_date <= target_date)
            .order_by(CycleLogModel.start_date.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    # ----------------------------------------------------------
    # 内部用: DailyRecord からスコアを計算するロジック
    # ----------------------------------------------------------
    @staticmethod
    def _calculate_score_from_daily_record(
        daily_record: DailyRecordModel,
        daily_env: Optional[DailyEnvModel],
        user: Optional[UserModel],
        last_cycle: Optional[CycleLogModel],
        target_date: Date,
    ) -> tuple[int, dict]:
        sleep = getattr(daily_record, "sleep", None) or 3
        stress = getattr(daily_record, "stress", None) or 3
        skincare_effort = getattr(daily_record, "skincare_effort", None) or 3
        skin_condition = getattr(daily_record, "skin_condition", None) or 3

        menstrual_score = ScoreService._calc_menstrual_score(
            user=user,
            daily_record=daily_record,
            last_cycle=last_cycle,
            target_date=target_date,
        )

        climate_score = ScoreService._calc_climate_score(daily_env)

        total_score = int(skin_condition) * 20

        score_details = {
            "sleep": int(sleep),
            "stress": int(stress),
            "skincare_effort": int(skincare_effort),
            "menstrual": int(menstrual_score),
            "climate": int(climate_score),
            "skin_condition": int(skin_condition),
        }

        return total_score, score_details

    # ----------------------------------------------------------
    # 軸ごとの計算
    # ----------------------------------------------------------
    # NOTE:
    # ユーザー自己申告(daily_record.menstruation_status)は使用しない。
    # 生理状態は cycle_log を唯一の正とする。
    @staticmethod
    def _calc_menstrual_score(
        user: Optional[UserModel],
        daily_record: DailyRecordModel,
        last_cycle: Optional[CycleLogModel],
        target_date: Date,
    ) -> int:
        # 1. ユーザー自己申告を無視に変更
        # if getattr(daily_record, "menstruation_status", False):
        #     return 2  # 月経期

        # 2. cycle_log 上も生理中なら 2
        if last_cycle and last_cycle.end_date:
            if last_cycle.start_date <= target_date <= last_cycle.end_date:
                return 2

        # 3. cycle_log が無ければ、登録時の last_menstruation_start を初期起点に使う
        if user is None:
            return 3

        cycle_start = None
        if last_cycle:
            cycle_start = last_cycle.start_date
        elif getattr(user, "last_menstruation_start", None):
            cycle_start = user.last_menstruation_start

        if cycle_start is None:
            return 3

        # 4. cycle_log が無い初期推定時だけ 5日で強制終了
        if last_cycle is None:
            if target_date <= cycle_start + timedelta(
                days=ScoreService.DEFAULT_MENSTRUATION_DAYS - 1
            ):
                return 2

        L = getattr(user, "cycle_length_days", None)
        if not L:
            return 3

        predicted_next_start = cycle_start + timedelta(days=L)
        days_to_next = (predicted_next_start - target_date).days

        # （A）かなり遅れている or めちゃくちゃ先を見ている → 予測を信用しない
        if days_to_next < -5 or days_to_next > L + 10:
            return 3

        # （B）予定日を少し過ぎている（-5〜-1 日遅れ） → PMS 継続とみなす
        if -5 <= days_to_next < 0:
            return 1

        # 0〜6: 黄体期後半（PMS）
        if 0 <= days_to_next <= 6:
            return 1
        # 7〜13: 黄体期前半
        if 7 <= days_to_next <= 13:
            return 3
        # 14〜16: 排卵期
        if 14 <= days_to_next <= 16:
            return 4
        # それ以外: 卵胞期（安定期）
        return 5

    @staticmethod
    def _calc_climate_score(daily_env: Optional[DailyEnvModel]) -> int:
        if daily_env is None:
            return 3

        t = daily_env.avg_temp_c
        h = daily_env.avg_humidity
        u = daily_env.uv_index

        temp_score = 3
        humidity_score = 3
        uv_score = 3

        # --- 温度スコア ---
        if t is not None:
            if t < 0 or t > 35:
                temp_score = 1
            elif 0 <= t < 5 or 32 <= t <= 35:
                temp_score = 2
            elif 5 <= t < 10 or 28 <= t < 32:
                temp_score = 3
            elif 10 <= t < 15 or 25 <= t < 28:
                temp_score = 4
            else:  # 15〜25℃
                temp_score = 5

        # --- 湿度スコア ---
        if h is not None:
            if h < 10 or h >= 90:
                humidity_score = 1
            elif 10 <= h < 20 or 80 <= h < 90:
                humidity_score = 2
            elif 20 <= h < 30 or 70 <= h < 80:
                humidity_score = 3
            elif 30 <= h < 40 or 60 <= h < 70:
                humidity_score = 4
            else:  # 40〜60%
                humidity_score = 5

        # --- UV スコア（高いほど悪いので反転） ---
        if u is not None:
            if u >= 11:
                uv_score = 1
            elif 8 <= u < 11:
                uv_score = 2
            elif 6 <= u < 8:
                uv_score = 3
            elif 3 <= u < 6:
                uv_score = 4
            else:  # 0〜2
                uv_score = 5

        avg = round((temp_score + humidity_score + uv_score) / 3)
        return max(1, min(5, avg))
