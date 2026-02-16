from __future__ import annotations

from datetime import date as Date
import hashlib
import re
from uuid import UUID


def ensure_period(sentence: str) -> str:
    if not sentence:
        return ""
    return sentence if sentence.endswith("。") else f"{sentence}。"


def extract_sample_days_30d(rules: list[dict]) -> int | None:
    for rule in rules:
        if rule.get("type") != "personal_summary":
            continue
        evidence = rule.get("evidence") or {}
        sample_days = evidence.get("sample_days_30d")
        if isinstance(sample_days, int):
            return sample_days
    return None


def extract_personal_message(rules: list[dict]) -> str | None:
    for rule in rules:
        if rule.get("type") != "personal_summary":
            continue
        evidence = rule.get("evidence") or {}
        message = evidence.get("message_ja")
        if isinstance(message, str) and message.strip():
            return message.strip()
    return None


def is_low_data(sample_days: int | None) -> bool:
    if sample_days is None:
        return True
    return sample_days <= 3


def is_weekly_trend_day(d: Date) -> bool:
    # Monday only to avoid repeating daily
    return d.weekday() == 0


def build_trend_clause(message: str) -> str | None:
    if "作り途中" in message:
        return None
    tail = message
    if tail.startswith("直近の記録を見ると、"):
        tail = tail.replace("直近の記録を見ると、", "", 1)
    elif tail.startswith("直近の記録から見ると、"):
        tail = tail.replace("直近の記録から見ると、", "", 1)
    tail = tail.rstrip("。")
    if not tail:
        return None
    return f"過去の記録でも、{tail}"


def digest_to_phrase(
    item: str, *, use_label_map: bool = True
) -> tuple[str, str] | None:
    if ":" not in item:
        return None
    label, value = [s.strip() for s in item.split(":", 1)]
    label_map = {
        "睡眠の質": "睡眠の質が",
        "ストレス": "ストレスが",
        "スキンケア努力": "スキンケアが",
        "ホルモン": "ホルモンの揺れが",
        "気候（温湿度・UV)": "気候の影響が",
        "肌コンディション": "肌の調子が",
    }
    head = label_map.get(label) if use_label_map else None
    if not head and label:
        head = f"{label}が"
    if not head:
        return None
    return head, value


def pick_digest_phrases(digest: list[str], *, use_label_map: bool = True) -> list[str]:
    negatives = {
        "よくない",
        "控えめ",
        "いまいち",
        "強め",
        "やや強め",
        "影響が出やすい",
        "やや影響あり",
        "ゆらぎやすい",
        "やや不安定",
    }
    phrases: list[str] = []
    for item in digest:
        parsed = digest_to_phrase(item, use_label_map=use_label_map)
        if not parsed:
            continue
        head, value = parsed
        if value in negatives:
            phrases.append(f"{head}{value}")
    if phrases:
        return phrases[:2]
    for item in digest:
        parsed = digest_to_phrase(item, use_label_map=use_label_map)
        if not parsed:
            continue
        head, value = parsed
        phrases.append(f"{head}{value}")
        if len(phrases) >= 2:
            break
    return phrases


def build_low_data_root_cause(context_data: dict, sample_days: int | None) -> str:
    weekly = context_data.get("weekly_summary") or {}
    today = weekly.get("today") or {}
    recent = weekly.get("recent_7d") or {}
    digest = today.get("digest") or recent.get("digest") or []
    phrases = pick_digest_phrases(digest, use_label_map=False)
    if sample_days is None or sample_days < 3:
        return "記録がまだ少ないので、今は分析できなくてごめんなさい。"
    if not phrases:
        return "記録がまだ少ないので、今は直近の流れを軽くまとめるね。"
    if len(phrases) == 1:
        return f"直近の記録では、{phrases[0]}の傾向です。"
    return f"直近の記録では、{phrases[0]}と{phrases[1]}の傾向です。"


def build_low_data_response(
    care_hint: str,
    context_data: dict,
    *,
    sample_days: int | None,
    closer: str,
) -> tuple[str, str]:
    root_cause = build_low_data_root_cause(context_data, sample_days)
    if sample_days is None or sample_days < 3:
        root_cause = (
            f"{root_cause}"
            "また、記録がたまってきたらもう少ししっかり見られるので、"
            "記録できる日は続けてみてね。"
        )
    elif sample_days < 14:
        root_cause = (
            f"{root_cause}"
            "また、記録がたまってきたらもう少ししっかり見られるので、"
            "記録できる日は続けてみてね。"
        )
    advice = build_advice_fallback(care_hint, closer)
    return root_cause, advice


def build_advice_fallback(care_hint: str, closer: str) -> str:
    if care_hint:
        return f"{care_hint} {closer}"
    return f"低刺激の保湿を1ステップだけ入れて、{closer}"


def _extract_hint_action(care_hint: str) -> str:
    text = care_hint.strip()
    if "と、" in text:
        text = text.split("と、", 1)[0]
    if "。" in text:
        text = text.split("。", 1)[0]
    return text.strip()


def ensure_care_hint_first_sentence(advice: str, *, care_hint: str, closer: str) -> str:
    if not advice or not advice.strip():
        return build_advice_fallback(care_hint, closer)

    normalized = re.sub(r"[。\.]{2,}", "。", advice)
    hint_action = _extract_hint_action(care_hint)
    if care_hint and (
        care_hint in normalized or (hint_action and hint_action in normalized)
    ):
        return normalized

    sentences = [s.strip() for s in normalized.split("。") if s.strip()]
    if not sentences:
        return build_advice_fallback(care_hint, closer)

    first = ensure_period(care_hint).rstrip()
    rest = sentences[1:]
    if rest:
        return f"{first} " + "。".join(rest) + "。"
    if closer:
        return f"{first} {closer}"
    return first


def dedupe_repeated_sentences(text: str) -> str:
    if not text:
        return text
    normalized = re.sub(r"[。\.]{2,}", "。", text)
    parts = [p.strip() for p in normalized.split("。") if p.strip()]
    if len(parts) >= 2 and parts[0] == parts[1]:
        parts.pop(1)
    return "。".join(parts) + ("。" if normalized.endswith("。") else "")


def pick_generic_advice(advice: str, *, care_hint: str, closer: str) -> str:
    markers = [
        "短時間ケア案",
        "ケア案",
        "取り入れてみてください",
        "実践しましょう",
        "意識して",
        "整えることをおすすめ",
        "具体的には",
        "内容を",
    ]
    is_generic = any(m in advice for m in markers) or len(advice) < 25
    combined = advice
    hint_action = _extract_hint_action(care_hint)
    already_mentions_hint = bool(hint_action) and hint_action in combined
    if care_hint and care_hint not in combined and not already_mentions_hint:
        combined = f"{care_hint} {combined}"
    if is_generic:
        if closer not in combined:
            combined = combined.rstrip("。") + f"。{closer}"
        return combined
    if not any(x in combined for x in ["OK", "大丈夫", "十分", "ここまで", "軽め"]):
        if closer not in combined:
            combined = combined.rstrip("。") + f"。{closer}"
    return combined


def sanitize_text(text: str) -> str:
    internal_words = [
        "problem_days",
        "score_details",
        "personal_rules",
        "skincare_effort",
        "skin_condition",
        "menstrual",
        "climate",
        "sleep",
        "stress",
    ]
    for w in internal_words:
        text = text.replace(w, "")
    return " ".join(text.split()).strip()


def build_closer(user_id: UUID, target_date: Date) -> str:
    s = f"{user_id}:{target_date.isoformat()}".encode("utf-8")
    digest = hashlib.sha256(s).digest()[:8]
    seed = int.from_bytes(digest, "big", signed=False)
    closers = [
        "今日これをやってみるだけでも大丈夫です。",
        "今日はこのくらいでも十分です。",
        "無理せず、できることから少しずつやっていけば大丈夫です。",
        "こんな感じで、整えておくといいと思います。",
        "もし今日はできなくても心配なし！またできる日にやりましょ。",
    ]
    return closers[seed % len(closers)]
