# app/services/weather_service.py

from datetime import date
from uuid import UUID
import os
import httpx
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.daily_env import DailyEnv as DailyEnvModel
from app.models.user import User as UserModel
from app.models.jp_prefecture import JpPrefecture as JpPrefectureModel


class WeatherService:
    async def get_or_fetch_daily_env(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        target_date: date,
        pref_code: str | None = None,
    ) -> DailyEnvModel:
        """
        1. daily_env にデータがあればそれを返す
        2. なければ WeatherAPI を叩き、daily_env にINSERTして返す

        WeatherAPI を叩く中身は別担当が実装する想定。
        """
        # pref_code が指定されていない場合は、ユーザーの都道府県を取得
        if pref_code is None:
            user_stmt = select(UserModel).where(UserModel.user_id == user_id)
            result = await db.execute(user_stmt)
            user = result.scalar_one_or_none()

            if user is None:
                raise ValueError(f"User not found: {user_id}")

            if user.pref_code is None:
                raise ValueError(
                    f"User {user_id} has no pref_code set. Please set pref_code in user profile."
                )

            pref_code = user.pref_code

        # daily_env テーブルから既存データを検索
        stmt = select(DailyEnvModel).where(
            and_(
                DailyEnvModel.date == target_date,
                DailyEnvModel.pref_code == pref_code,
            )
        )
        result = await db.execute(stmt)
        existing_env = result.scalar_one_or_none()

        # 既存データがあればそれを返す
        if existing_env is not None:
            return existing_env

        # 既存データがなければ WeatherAPI を叩く
        # 都道府県の緯度経度を取得
        pref_stmt = select(JpPrefectureModel).where(
            JpPrefectureModel.pref_code == pref_code
        )
        result = await db.execute(pref_stmt)
        prefecture = result.scalar_one_or_none()

        if prefecture is None:
            raise ValueError(f"Prefecture not found: {pref_code}")

        latitude = prefecture.latitude
        longitude = prefecture.longitude

        # 環境変数からAPIキーを取得
        api_key = os.getenv("WEATHER_API_KEY")
        if not api_key:
            raise ValueError("WEATHER_API_KEY is not set in environment variables")

        # WeatherAPI.comのHistory APIを使用（当日も過去も対応）
        url = "http://api.weatherapi.com/v1/history.json"

        # httpxで非同期リクエスト
        async with httpx.AsyncClient() as client:
            params = {
                "key": api_key,
                "q": f"{latitude},{longitude}",
                "dt": target_date.strftime("%Y-%m-%d"),
            }

            try:
                response = await client.get(url, params=params, timeout=10.0)
                response.raise_for_status()  # HTTPエラーがあれば例外を発生
                data = response.json()
            except httpx.HTTPStatusError as e:
                raise ValueError(
                    f"Weather API request failed: {e.response.status_code} - {e.response.text}"
                )
            except httpx.TimeoutException:
                raise ValueError("Weather API request timed out")
            except Exception as e:
                raise ValueError(f"Weather API request failed: {str(e)}")

        # レスポンスから必要なデータを抽出
        try:
            forecastday = data["forecast"]["forecastday"][0]
            day_data = forecastday["day"]

            avg_temp_c = day_data.get("avgtemp_c")
            avg_humidity = day_data.get("avghumidity")
            uv_index = day_data.get("uv")
            weather_code = str(day_data.get("condition", {}).get("code", ""))
        except (KeyError, IndexError) as e:
            raise ValueError(f"Invalid Weather API response format: {str(e)}")

        # DailyEnvModelのインスタンスを作成
        new_env = DailyEnvModel(
            date=target_date,
            pref_code=pref_code,
            avg_temp_c=avg_temp_c,
            avg_humidity=avg_humidity,
            uv_index=uv_index,
            weather_code=weather_code,
        )

        # DBに保存
        db.add(new_env)
        await db.commit()
        await db.refresh(new_env)

        # 保存したデータを返す
        return new_env
