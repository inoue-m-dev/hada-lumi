from __future__ import annotations

from datetime import date as Date, timedelta
from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skin_score import SkinScore as SkinScoreModel
from app.models.user import User as UserModel
from app.schemas.ai_result import AnalysisRequest
from app.services.ai_care_hints import pick_care_hint_by_focus

from .ai_personal_rules import build_personal_rules
from .ai_response_builder import extract_sample_days_30d


# ============================================================
# LLM 向け: 内部キーをそのまま渡さないための変換
# ============================================================
_AXIS_KEYS_INTERNAL = [
    "sleep",
    "stress",
    "skincare_effort",
    "menstrual",
    "climate",
    "skin_condition",
]

_AXIS_LABELS_JA: dict[str, str] = {
    "sleep": "睡眠の質",
    "stress": "ストレス",
    "skincare_effort": "スキンケア努力",
    "menstrual": "ホルモン",
    "climate": "気候（温湿度・UV)",
    "skin_condition": "肌コンディション",
}


def _level_text(axis_key: str, value: float | int | None) -> str | None:
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None

    if axis_key == "sleep":
        if v <= 2:
            return "よくない"
        if v <= 3:
            return "まあまあ"
        return "落ち着き寄り"

    if axis_key == "stress":
        if v <= 2:
            return "強め"
        if v <= 3:
            return "やや強め"
        return "落ち着き寄り"

    if axis_key == "skincare_effort":
        if v <= 2:
            return "いまいち"
        if v <= 3:
            return "控えめ"
        return "しっかりめ"

    if axis_key == "menstrual":
        if v <= 2:
            return "影響が出やすい"
        if v <= 3:
            return "やや影響あり"
        return "落ち着き寄り"

    if axis_key == "climate":
        if v <= 2:
            return "影響が出やすい"
        if v <= 3:
            return "やや影響あり"
        return "落ち着き寄り"

    if axis_key == "skin_condition":
        if v <= 2:
            return "ゆらぎやすい"
        if v <= 3:
            return "やや不安定"
        return "安定寄り"

    return None


def _build_axis_digest(details: dict) -> list[str]:
    out: list[str] = []
    for k in _AXIS_KEYS_INTERNAL:
        label = _AXIS_LABELS_JA.get(k)
        if not label:
            continue
        text = _level_text(k, details.get(k))
        if text:
            out.append(f"{label}: {text}")
    return out[:4]


def _build_recent_digest(period_average: dict) -> list[str]:
    out: list[str] = []
    for k in _AXIS_KEYS_INTERNAL:
        label = _AXIS_LABELS_JA.get(k)
        if not label:
            continue
        text = _level_text(k, period_average.get(k))
        if text:
            out.append(f"{label}: {text}")
    return out[:4]


def _calc_axis_average(scores: Sequence[SkinScoreModel], axis_keys: list[str]) -> dict:
    if not scores:
        return {k: None for k in axis_keys}

    sums = {k: 0.0 for k in axis_keys}
    counts = {k: 0 for k in axis_keys}
    for s in scores:
        details = s.score_details or {}
        for k in axis_keys:
            v = details.get(k)
            if isinstance(v, (int, float)):
                sums[k] += float(v)
                counts[k] += 1
    return {k: round(sums[k] / counts[k], 2) if counts[k] else None for k in axis_keys}


def _build_weekly_summary_compact(
    scores: Sequence[SkinScoreModel],
    target_date: Date,
    problem_dates: set[Date],
    *,
    include_digest: bool,
) -> dict:
    today = next((s for s in scores if s.date == target_date), None)
    has_today_record = today is not None
    today_details = (today.score_details or {}) if today else {}

    period_average = _calc_axis_average(scores, _AXIS_KEYS_INTERNAL)

    if include_digest:
        today_digest = _build_axis_digest(today_details) if has_today_record else []
        recent_digest = _build_recent_digest(period_average)
    else:
        today_digest = []
        recent_digest = []

    return {
        "target_date": target_date.isoformat(),
        "today": {
            "has_record": has_today_record,
            "score": today.score if today else None,
            "is_problem_day": target_date in problem_dates,
            "digest": today_digest,
        },
        "recent_7d": {"digest": recent_digest},
        "note": "当日データがない場合は『今日』と断定せず『直近』『最近』の表現を優先する",
    }


def _pick_focus_axis(
    *,
    today_details: dict,
    period_average: dict,
) -> str | None:
    target_axes = ["sleep", "stress", "skincare_effort", "menstrual", "climate"]

    def pick_lowest_axis(values: dict) -> str | None:
        candidates: list[tuple[float, str]] = []
        for k in target_axes:
            v = values.get(k)
            if isinstance(v, (int, float)) and v <= 2:
                candidates.append((float(v), k))
        if not candidates:
            return None
        candidates.sort(key=lambda item: (item[0], target_axes.index(item[1])))
        return candidates[0][1]

    picked = pick_lowest_axis(today_details)
    if picked:
        return picked
    return pick_lowest_axis(period_average)


def _pick_focus_axis_from_rules(personal_rules: list[dict]) -> str | None:
    for rule in personal_rules:
        if rule.get("type") != "personal_summary":
            continue
        evidence = rule.get("evidence") or {}
        key_drivers = evidence.get("key_drivers") or []
        if not isinstance(key_drivers, list):
            continue
        for driver in key_drivers:
            if not isinstance(driver, str):
                continue
            driver_map = {
                "睡眠の質": "sleep",
                "ストレス": "stress",
                "スキンケア努力": "skincare_effort",
                "ホルモン": "menstrual",
                "気候（温湿度・UV)": "climate",
                "肌コンディション": "skin_condition",
            }
            mapped = driver_map.get(driver)
            if mapped:
                return mapped
    return None


async def _fetch_user(db: AsyncSession, user_id: UUID) -> UserModel:
    stmt = select(UserModel).where(UserModel.user_id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")
    return user


async def _fetch_skin_scores(
    db: AsyncSession,
    user_id: UUID,
    start_date: Date,
    end_date: Date,
) -> Sequence[SkinScoreModel]:
    stmt = (
        select(SkinScoreModel)
        .where(SkinScoreModel.user_id == user_id)
        .where(SkinScoreModel.date >= start_date)
        .where(SkinScoreModel.date <= end_date)
        .order_by(SkinScoreModel.date)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


def _stable_seed(user_id: UUID, target_date: Date) -> int:
    # 日付×ユーザーで「日替わり・ユーザーごとに安定」する seed
    # Pythonのhash()はプロセスごとに変わるので使わない
    s = f"{user_id}:{target_date.isoformat()}"
    return abs(sum(ord(c) for c in s)) % (2**31 - 1)


async def build_analysis_context(
    db: AsyncSession,
    user_id: UUID,
    request: AnalysisRequest,
) -> dict:
    target_date: Date = request.target_date
    problem_dates = set(request.problem_dates or [])

    user = await _fetch_user(db, user_id)

    week_start = target_date - timedelta(days=6)
    weekly_scores = await _fetch_skin_scores(
        db=db,
        user_id=user_id,
        start_date=week_start,
        end_date=target_date,
    )

    personal_rules = await build_personal_rules(
        db=db,
        user_id=user_id,
        target_date=target_date,
    )

    today_score = next((s for s in weekly_scores if s.date == target_date), None)
    today_details = (today_score.score_details or {}) if today_score else {}
    period_average = _calc_axis_average(weekly_scores, _AXIS_KEYS_INTERNAL)
    focus_axis = _pick_focus_axis_from_rules(personal_rules)
    if not focus_axis:
        focus_axis = _pick_focus_axis(
            today_details=today_details,
            period_average=period_average,
        )
    if focus_axis == "skincare_effort":
        focus_key = "skincare"
    else:
        focus_key = focus_axis
    focus_axis_ja = _AXIS_LABELS_JA.get(focus_axis) if focus_axis else None
    sample_days_30d = extract_sample_days_30d(personal_rules)

    weekly_summary = _build_weekly_summary_compact(
        scores=weekly_scores,
        target_date=target_date,
        problem_dates=problem_dates,
        include_digest=len(weekly_scores) > 0,
    )
    has_recent_7d = bool(
        weekly_summary["today"]["digest"] or weekly_summary["recent_7d"]["digest"]
    )
    has_30d_trend = sample_days_30d is not None and sample_days_30d >= 14

    # ✅ care_hints_text は冒頭フレーズ付きで渡す
    skin_type = getattr(user, "skin_type", None)
    seed = _stable_seed(user_id, target_date)
    care_hints_text = pick_care_hint_by_focus(
        focus_key,
        skin_type=skin_type,
        seed=seed,
        include_reason=True,
    )
    care_hints_reason_text = pick_care_hint_by_focus(
        focus_key,
        skin_type=skin_type,
        seed=seed,
        include_reason=True,
    )

    return {
        "meta": {
            "target_date": target_date.isoformat(),
            "user_id": str(user_id),
            "skin_type": skin_type,
        },
        "weekly_summary": weekly_summary,
        "trend_flags": {
            "has_recent_7d": has_recent_7d,
            "has_30d_trend": has_30d_trend,
        },
        "focus_axis_ja": focus_axis_ja,
        "personal_rules": personal_rules,
        # ✅ プロンプトが要求しているフィールド名で入れる
        "care_hints_text": care_hints_text,
        "care_hints_reason_text": care_hints_reason_text,
    }
