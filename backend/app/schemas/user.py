# app/schemas/user.py

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class User(BaseModel):
    """
    DBから返すユーザー情報（レスポンス用）
    """

    model_config = ConfigDict(from_attributes=True)

    user_id: UUID = Field(..., description="ユーザーID（UUID）")
    firebase_uid: str = Field(..., description="Firebase UID")
    auth_provider: str = Field(..., description="認証方式（google）")
    email: Optional[str] = Field(
        None,
        description="メールアドレス",
    )

    skin_type: Optional[str] = Field(
        None,
        description="肌タイプ（dry/oily/normal/combination/sensitive）",
    )
    cycle_length_days: Optional[int] = Field(
        None,
        ge=20,
        le=40,
        description="生理周期の平均日数",
    )
    last_menstruation_start: Optional[date] = Field(
        None,
        description="直近の生理開始日",
    )
    # ❌ ここは消す（MVPでは送らない）
    # is_menstruation_user: bool = Field(
    #     True,
    #     description="生理追跡機能 ON/OFF",
    # )

    # ★ 初回登録では null の可能性があるので Optional に
    pref_code: Optional[str] = Field(
        None,
        pattern=r"^[0-9]{2}$",
        description="都道府県コード",
    )
    pref_name: Optional[str] = Field(
        None,
        description="都道府県名",
    )

    created_at: datetime = Field(..., description="作成日時")
    updated_at: datetime = Field(..., description="更新日時")


class UserRegisterRequest(BaseModel):
    """
    POST /users/register 用のリクエストボディ
    （初回登録なので firebase_uid / auth_provider 以外は全部任意）
    """

    firebase_uid: str = Field(..., description="Firebase UID")
    auth_provider: str = Field(
        ...,
        description="認証方式（google 固定想定）",
    )

    skin_type: Optional[str] = Field(
        None,
        description="肌タイプ",
    )
    cycle_length_days: Optional[int] = Field(
        None,
        ge=20,
        le=40,
        description="生理周期の平均日数",
    )
    last_menstruation_start: Optional[date] = Field(
        None,
        description="直近の生理開始日",
    )
    is_menstruation_user: bool = Field(
        True,
        description="生理追跡機能 ON/OFF",
    )

    # ★ 初回登録では未設定の想定なので Optional
    pref_code: Optional[str] = Field(
        None,
        pattern=r"^[0-9]{2}$",
        description="都道府県コード",
    )
    pref_name: Optional[str] = Field(
        None,
        description="都道府県名",
    )


class UserUpdateRequest(BaseModel):
    """
    PATCH /users/me 用：部分更新なので全部 Optional
    """

    skin_type: Optional[str] = Field(
        None,
        description="肌タイプ",
    )
    cycle_length_days: Optional[int] = Field(
        None,
        ge=20,
        le=40,
        description="生理周期の平均日数",
    )
    last_menstruation_start: Optional[date] = Field(
        None,
        description="直近の生理開始日",
    )
    is_menstruation_user: Optional[bool] = Field(
        None,
        description="生理追跡機能 ON/OFF",
    )
    pref_code: Optional[str] = Field(
        None,
        pattern=r"^[0-9]{2}$",
        description="都道府県コード",
    )
    pref_name: Optional[str] = Field(
        None,
        description="都道府県名",
    )
