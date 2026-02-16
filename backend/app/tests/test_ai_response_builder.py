from app.services.ai_response_builder import ensure_care_hint_first_sentence


def test_ensure_care_hint_first_sentence_prefers_hint() -> None:
    advice = "今日は軽めのケアでOK。無理せず休もう。"
    care_hint = "保湿を1ステップだけ入れてみて。"
    closer = "無理せず休もう。"

    result = ensure_care_hint_first_sentence(
        advice,
        care_hint=care_hint,
        closer=closer,
    )

    assert result.startswith(care_hint)
