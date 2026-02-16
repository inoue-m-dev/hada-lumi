# app/routers/users.py

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.deps import get_current_user_id  # 後で Firebase 認証に差し替え予定
from app.models.user import User as UserModel
from app.schemas.user import User, UserUpdateRequest

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

# DB セッション型
DbSession = Annotated[AsyncSession, Depends(get_db)]


def _normalize_pref_code(pref_code: str | None) -> str | None:
    if pref_code is None:
        return None
    value = pref_code.strip()
    if not value:
        return None
    return value.zfill(2) if value.isdigit() else value


# ============================================================
# 1. ログイン中ユーザー取得
# ============================================================
@router.get(
    "/me",
    response_model=User,
)
async def get_me(
    db: DbSession,
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """
    ログイン中ユーザーの情報を返す
    """
    stmt = select(UserModel).where(UserModel.user_id == current_user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    response = User.model_validate(user)
    response.pref_code = _normalize_pref_code(response.pref_code)
    return response


# ============================================================
# 2. ユーザー情報更新（PATCH）
# ============================================================
@router.patch(
    "/me",
    response_model=User,
)
async def update_me(
    body: UserUpdateRequest,
    db: DbSession,
    current_user_id: Annotated[UUID, Depends(get_current_user_id)],
):
    """
    ログイン中ユーザーのプロフィール部分更新
    """
    stmt = select(UserModel).where(UserModel.user_id == current_user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # 送られてきた項目だけ反映
    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    response = User.model_validate(user)
    response.pref_code = _normalize_pref_code(response.pref_code)
    return response
