from __future__ import annotations

from datetime import date as Date, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skin_score import SkinScore as SkinScoreModel


AXIS_KEYS = [
    "sleep",
    "stress",
    "skincare_effort",
    "menstrual",
    "climate",
    "skin_condition",
]


# ============================================================
# Public API
# ============================================================
async def build_personal_rules(
    db: AsyncSession,
    user_id: UUID,
    target_date: Date,
) -> List[Dict[str, Any]]:
    """
    personal_rules は LLM が拾いやすい形に最小化して返す。

    - personal_summary: 個人傾向の要約（LLMがそのまま使える短文 + データ量）
    - personal_evidence: 裏取り用の最小限の数値（任意）

    ※「今日」などの時点断定をしやすい要素（today_flags / streak）は、
      まずは精度を上げるために返却から外す。
    """
    lookback_start = target_date - timedelta(days=29)
    week_start = target_date - timedelta(days=6)

    scores_30d = await _fetch_scores(db, user_id, lookback_start, target_date)
    scores_7d = await _fetch_scores(db, user_id, week_start, target_date)

    if not scores_30d:
        return []

    # ----------------------------
    # 問題日抽出（skin_condition <= 2）
    # ----------------------------
    problem_days = [
        s for s in scores_30d if (s.score_details or {}).get("skin_condition", 99) <= 2
    ]

    # ----------------------------
    # key_drivers（最大2つ）を決める
    # - 直近7日平均と問題日平均との差の大きい軸を優先
    # - gap が弱い場合は「問題日平均が低い（悪い）軸」から選ぶ
    # ----------------------------
    key_drivers: List[str] = []
    key_drivers_30d: List[str] = []

    if problem_days and scores_7d:
        weekly_avg = _calc_avg(scores_7d)
        problem_avg = _calc_avg(problem_days)

        gaps: List[Tuple[str, float]] = []
        for k in ("sleep", "stress", "skincare_effort", "menstrual", "climate"):
            w, p = weekly_avg.get(k), problem_avg.get(k)
            if w is not None and p is not None:
                gaps.append((k, round(w - p, 2)))

        gaps.sort(key=lambda x: x[1], reverse=True)
        key_drivers = [k for k, gap in gaps if gap >= 1.0][:2]

        if not key_drivers:
            candidates: List[Tuple[str, float]] = []
            for k in ("sleep", "stress", "skincare_effort", "menstrual", "climate"):
                v = problem_avg.get(k)
                if v is not None:
                    candidates.append((k, float(v)))
            candidates.sort(key=lambda x: x[1])
            key_drivers = [k for k, _ in candidates[:2]]

    # ----------------------------
    # key_drivers_30d（最大2つ）を決める
    # - 直近30日平均と問題日平均との差の大きい軸を優先
    # - gap が弱い場合は「問題日平均が低い（悪い）軸」から選ぶ
    # ----------------------------
    if problem_days:
        monthly_avg = _calc_avg(scores_30d)
        problem_avg = _calc_avg(problem_days)

        gaps_30d: List[Tuple[str, float]] = []
        for k in ("sleep", "stress", "skincare_effort", "menstrual", "climate"):
            m, p = monthly_avg.get(k), problem_avg.get(k)
            if m is not None and p is not None:
                gaps_30d.append((k, round(m - p, 2)))

        gaps_30d.sort(key=lambda x: x[1], reverse=True)
        key_drivers_30d = [k for k, gap in gaps_30d if gap >= 1.0][:2]

        if not key_drivers_30d:
            candidates_30d: List[Tuple[str, float]] = []
            for k in ("sleep", "stress", "skincare_effort", "menstrual", "climate"):
                v = problem_avg.get(k)
                if v is not None:
                    candidates_30d.append((k, float(v)))
            candidates_30d.sort(key=lambda x: x[1])
            key_drivers_30d = [k for k, _ in candidates_30d[:2]]

    # ----------------------------
    # LLMがそのまま使える短文（message_ja）を生成
    # ※時点の断定を避けるため「直近」の表現に固定
    # ※内部キーや数値・日数を文章に入れない（LLMがそのまま拾ってしまうため）
    # ----------------------------
    enough_data = (len(scores_30d) >= 14) and (len(problem_days) >= 4)

    if not problem_days or not enough_data:
        message_ja = "直近の記録から見ると、まだ『崩れやすいパターン』は作り途中です。"
    else:
        if key_drivers:
            drivers_ja = "と".join(_axis_to_ja(k) for k in key_drivers)
            message_ja = (
                f"直近の記録を見ると、{drivers_ja}のスコアが低い日が重なると、"
                "肌がゆらぎやすい日が出てきやすいようです。"
            )
        else:
            message_ja = (
                "直近の記録を見ると、いくつかの変化が重なると、"
                "肌がゆらぎやすい日が出てきやすいようです。"
            )

    rules: List[Dict[str, Any]] = [
        {
            "type": "personal_summary",
            "title": "個人傾向（要約）",
            "evidence": {
                "sample_days_30d": len(scores_30d),
                "problem_days": len(problem_days),
                "key_drivers": [_axis_to_ja(k) for k in key_drivers],
                "key_drivers_30d": [_axis_to_ja(k) for k in key_drivers_30d],
                "message_ja": message_ja,
            },
        }
    ]

    # 裏取り用の最小限の数値（LLMの根拠として使いたい場合のみ）
    if problem_days:
        problem_avg = _calc_avg(problem_days)
        rules.append(
            {
                "type": "personal_evidence",
                "title": "個人傾向（数値）",
                "evidence": {
                    "problem_days_count": len(problem_days),
                    "focus": {
                        "sleep": problem_avg.get("sleep"),
                        "stress": problem_avg.get("stress"),
                        "skincare_effort": problem_avg.get("skincare_effort"),
                        "menstrual": problem_avg.get("menstrual"),
                        "climate": problem_avg.get("climate"),
                    },
                },
            }
        )

    return rules


# ============================================================
# helpers
# ============================================================
async def _fetch_scores(
    db: AsyncSession,
    user_id: UUID,
    start: Date,
    end: Date,
) -> Sequence[SkinScoreModel]:
    stmt = (
        select(SkinScoreModel)
        .where(SkinScoreModel.user_id == user_id)
        .where(SkinScoreModel.date >= start)
        .where(SkinScoreModel.date <= end)
        .order_by(SkinScoreModel.date)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


def _calc_avg(scores: Sequence[SkinScoreModel]) -> Dict[str, Optional[float]]:
    sums = {k: 0.0 for k in AXIS_KEYS}
    counts = {k: 0 for k in AXIS_KEYS}

    for s in scores:
        d = s.score_details or {}
        for k in AXIS_KEYS:
            v = d.get(k)
            if isinstance(v, (int, float)):
                sums[k] += v
                counts[k] += 1

    return {k: round(sums[k] / counts[k], 2) if counts[k] else None for k in AXIS_KEYS}


def _axis_to_ja(axis: str) -> str:
    return {
        "sleep": "睡眠の質",
        "stress": "ストレス",
        "skincare_effort": "スキンケア努力",
        "menstrual": "ホルモン",
        "climate": "気候（温湿度・UV)",
    }.get(axis, axis)


def _has_consecutive(
    scores: Sequence[SkinScoreModel],
    key: str,
    predicate,
    required: int,
) -> bool:
    streak = 0
    for s in scores:
        v = (s.score_details or {}).get(key)
        if v is not None and predicate(int(v)):
            streak += 1
            if streak >= required:
                return True
        else:
            streak = 0
    return False
