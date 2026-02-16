from __future__ import annotations

import json
import logging
import os
import time
from datetime import date as Date
from typing import Any, Optional
from uuid import UUID

from openai import OpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_result import AIResult as AIResultModel
from app.schemas.ai_result import AIResult, AnalysisRequest
from app.services.ai_care_hints import CARE_HINT_PREFIX_MAP

from .ai_context_builder import build_analysis_context
from .ai_response_builder import (
    build_advice_fallback,
    build_closer,
    build_low_data_response,
    dedupe_repeated_sentences,
    ensure_period,
    extract_sample_days_30d,
    is_low_data,
    sanitize_text,
)
from .ai_prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

# OpenAI APIキーを環境変数から取得
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY is not set in environment variables")

client = OpenAI(api_key=openai_api_key)
logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.INFO)


class LLMAnalysis(BaseModel):
    root_cause: str = Field(..., min_length=1)
    advice: str | None = None


def _strip_30d_trend_sentence(root_cause: str) -> str:
    if not root_cause:
        return root_cause
    marker = "過去30日を振り返ると、"
    if marker not in root_cause:
        return root_cause
    head, tail = root_cause.split(marker, 1)
    if "。" in tail:
        _, rest = tail.split("。", 1)
        cleaned = f"{head}{rest}".strip()
        return cleaned
    return head.strip()


class AIService:
    @staticmethod
    def _split_fixed_prefix(advice: str) -> tuple[str, str]:
        for prefix in CARE_HINT_PREFIX_MAP.values():
            if advice.startswith(prefix):
                return prefix, advice[len(prefix) :].lstrip()
        return "", advice

    @staticmethod
    def _is_two_sentences(text: str) -> bool:
        if not text:
            return False
        normalized = text.strip()
        if not normalized.endswith("。"):
            return False
        sentences = [s.strip() for s in normalized.split("。") if s.strip()]
        return len(sentences) == 2

    @staticmethod
    def _rewrite_advice(advice: str) -> str:
        if not advice or not advice.strip():
            return advice
        max_len = int(len(advice) * 1.2)
        if max_len < 1:
            return advice
        fixed_prefix, body = AIService._split_fixed_prefix(advice)
        if fixed_prefix:
            body_max_len = max_len - len(fixed_prefix)
            if body_max_len < 1:
                return advice
        else:
            body_max_len = max_len
            body = advice

        instructions = (
            "You are a careful Japanese copy editor. "
            "Rewrite the advice in a casual tone while preserving meaning. "
            "Do NOT add medical claims or diagnoses. "
            "Keep exactly two sentences, each ending with '。'. "
            "Return only the rewritten advice."
        )
        prompt = (
            f"Length must be <= {body_max_len} characters.\n"
            f"Original advice:\n{body}\n"
        )
        try:
            response = client.responses.create(
                model="gpt-5-nano",
                instructions=instructions,
                input=prompt,
                max_output_tokens=120,
                reasoning={"effort": "minimal"},
                text={"verbosity": "low"},
            )
            rewritten = (response.output_text or "").strip()
        except Exception:
            return advice

        if not rewritten:
            return advice
        if len(rewritten) > body_max_len:
            return advice
        combined = f"{fixed_prefix}{rewritten.lstrip()}" if fixed_prefix else rewritten
        if len(combined) > max_len:
            return advice
        if not AIService._is_two_sentences(combined):
            return advice
        return combined

    @staticmethod
    async def run_analysis_and_build_context_only(
        db: AsyncSession,
        user_id: UUID,
        request: AnalysisRequest,
    ) -> dict:
        return await build_analysis_context(db=db, user_id=user_id, request=request)

    @staticmethod
    async def get_cached_result(
        db: AsyncSession,
        user_id: UUID,
        target_date: Date,
    ) -> AIResult | None:
        stmt = (
            select(AIResultModel)
            .where(AIResultModel.user_id == user_id)
            .where(AIResultModel.date == target_date)
        )
        result = await db.execute(stmt)
        existing: AIResultModel | None = result.scalar_one_or_none()
        if existing is None:
            return None
        if not existing.root_cause or not existing.advice:
            return None
        return AIResult.model_validate(existing)

    @staticmethod
    async def run_analysis_with_openai(
        db: AsyncSession,
        user_id: UUID,
        request: AnalysisRequest,
    ) -> AIResult:
        cached = await AIService.get_cached_result(
            db=db,
            user_id=user_id,
            target_date=request.target_date,
        )
        if cached is not None:
            logger.info(
                "ai_cache_hit user_id=%s date=%s",
                str(user_id),
                str(request.target_date),
            )
            return cached

        # 1) context を作る（care_hints_text はプロンプト外に渡す）
        context = await build_analysis_context(db=db, user_id=user_id, request=request)

        closer = build_closer(user_id, request.target_date)
        personal_rules = context.get("personal_rules") or []
        sample_days_30d = extract_sample_days_30d(personal_rules)
        has_30d_trend = sample_days_30d is not None and sample_days_30d >= 14
        if is_low_data(sample_days_30d):
            care_hint_sentence: str = (context.get("care_hints_text") or "").strip()
            care_hint_sentence = ensure_period(care_hint_sentence)
            root_cause, advice = build_low_data_response(
                care_hint_sentence,
                context,
                sample_days=sample_days_30d,
                closer=closer,
            )
            advice = AIService._rewrite_advice(advice)
            if not has_30d_trend:
                root_cause = _strip_30d_trend_sentence(root_cause)
                root_cause = f"{root_cause} 記録がもう少し溜まると、過去30日の傾向も見られるようになります。"
            analysis_raw: Any = {
                "low_data": True,
                "sample_days_30d": sample_days_30d,
            }
            return await AIService._upsert_ai_result(
                db=db,
                user_id=user_id,
                target_date=request.target_date,
                root_cause=root_cause,
                advice=advice,
                analysis_raw=analysis_raw,
            )

        care_hint_sentence: str = (context.get("care_hints_reason_text") or "").strip()
        care_hint_sentence = ensure_period(care_hint_sentence)

        prompt_context = dict(context)
        prompt_context.pop("care_hints_text", None)
        prompt_context.pop("care_hints_reason_text", None)
        context_json = json.dumps(
            prompt_context, ensure_ascii=False, separators=(",", ":")
        )
        user_prompt = USER_PROMPT_TEMPLATE.format(
            context_json=context_json,
            care_hint_sentence=care_hint_sentence,
        )

        logger.info(
            "ai_prompt_sizes context_bytes=%d prompt_chars=%d",
            len(context_json.encode("utf-8")),
            len(user_prompt),
        )

        # 2) OpenAI
        logger.info("openai_start model=%s", "gpt-5-nano")
        t_openai_start = time.perf_counter()
        response = client.responses.parse(
            model="gpt-5-nano",
            instructions=SYSTEM_PROMPT,
            input=user_prompt,
            max_output_tokens=380,
            reasoning={"effort": "minimal"},
            text={"verbosity": "medium"},
            text_format=LLMAnalysis,
        )
        t_openai_done = time.perf_counter()

        raw_text = response.output_text
        parsed_obj: Optional[LLMAnalysis] = getattr(response, "output_parsed", None)

        req_id = getattr(response, "request_id", None)
        resp_id = getattr(response, "id", None)
        logger.info(
            "openai_done ms=%d response_id=%s request_id=%s",
            int((t_openai_done - t_openai_start) * 1000),
            resp_id,
            req_id,
        )

        # 3) parse
        t_parse_start = time.perf_counter()
        if parsed_obj is not None:
            analysis_raw: Any = parsed_obj.model_dump()
            root_cause = parsed_obj.root_cause
            advice = parsed_obj.advice
            logger.info(
                "ai_parse_ok ms=%d", int((time.perf_counter() - t_parse_start) * 1000)
            )
        else:
            try:
                parsed: Any = json.loads(raw_text)
                analysis_raw = parsed
                root_cause = parsed.get("root_cause")
                advice = parsed.get("advice")
                logger.info(
                    "ai_parse_ok_fallback ms=%d",
                    int((time.perf_counter() - t_parse_start) * 1000),
                )
            except Exception as e:
                logger.warning(
                    "ai_parse_fail ms=%d err=%s raw_head=%r",
                    int((time.perf_counter() - t_parse_start) * 1000),
                    str(e),
                    raw_text[:250],
                )
                analysis_raw = {"raw_text": raw_text, "parse_error": True}
                root_cause = None
                advice = None

        # 4) 最低限の保険
        if not isinstance(root_cause, str) or not root_cause.strip():
            root_cause = "直近の流れを見ると、いくつかの変化が重なって肌がゆらぎやすい日が出ています。"

        root_cause = root_cause.strip()
        if not has_30d_trend:
            root_cause = _strip_30d_trend_sentence(root_cause)
            root_cause = f"{root_cause} 記録がもう少し溜まると、過去30日の傾向も見られるようになります。"
        advice = ""

        # 5) advice は常に care_hint + closer の2文で固定
        advice = build_advice_fallback(care_hint_sentence, closer)
        advice = AIService._rewrite_advice(advice)

        # 6) 禁止語/内部語の最終ガード（過剰な置換は避ける）
        root_cause = sanitize_text(root_cause)
        advice = sanitize_text(advice)
        advice = dedupe_repeated_sentences(advice)

        return await AIService._upsert_ai_result(
            db=db,
            user_id=user_id,
            target_date=request.target_date,
            root_cause=root_cause,
            advice=advice,
            analysis_raw=analysis_raw,
        )

    @staticmethod
    async def _upsert_ai_result(
        db: AsyncSession,
        user_id: UUID,
        target_date: Date,
        root_cause: str,
        advice: str,
        analysis_raw: Any,
    ) -> AIResult:
        stmt = (
            select(AIResultModel)
            .where(AIResultModel.user_id == user_id)
            .where(AIResultModel.date == target_date)
        )
        result = await db.execute(stmt)
        existing: AIResultModel | None = result.scalar_one_or_none()

        if existing is None:
            ai_result = AIResultModel(
                user_id=user_id,
                date=target_date,
                root_cause=root_cause,
                advice=advice,
                analysis_raw=analysis_raw,
            )
            db.add(ai_result)
        else:
            existing.root_cause = root_cause
            existing.advice = advice
            existing.analysis_raw = analysis_raw
            ai_result = existing

        await db.commit()
        await db.refresh(ai_result)

        return AIResult.model_validate(ai_result)
