# backend/app/db/__init__.py
from app.db.base import Base  # noqa: F401

# ここで全モデルを import して、
# Base.metadata にテーブル定義を登録させる
from app.models.user import User  # noqa: F401
from app.models.jp_prefecture import JpPrefecture  # noqa: F401
from app.models.daily_record import DailyRecord  # noqa: F401
from app.models.daily_env import DailyEnv  # noqa: F401
from app.models.cycle_log import CycleLog  # noqa: F401
from app.models.skin_score import SkinScore  # noqa: F401
from app.models.ai_result import AIResult  # noqa: F401
