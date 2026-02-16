# app/deps.py
from __future__ import annotations

import os
from typing import Annotated
from uuid import UUID

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User as UserModel

# 共通 DB セッション型
DbSession = Annotated[AsyncSession, Depends(get_db)]
auth_scheme = HTTPBearer()


def _init_firebase() -> None:
    if firebase_admin._apps:
        return

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    private_key = os.getenv("FIREBASE_PRIVATE_KEY")

    if not project_id or not client_email or not private_key:
        raise RuntimeError("Firebase credentials are not set in environment variables.")

    cred = credentials.Certificate(
        {
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
            "private_key": private_key.replace("\\n", "\n"),
        }
    )
    firebase_admin.initialize_app(cred)


def verify_firebase_token(token: str) -> dict:
    _init_firebase()
    return firebase_auth.verify_id_token(token)


async def get_current_user(
    db: DbSession,
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme),
) -> UserModel:
    """
    Firebase ID トークンを検証して user を取得する
    """
    try:
        decoded = verify_firebase_token(cred.credentials)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID token.",
        ) from exc

    firebase_uid = decoded["uid"]
    stmt = select(UserModel).where(UserModel.firebase_uid == firebase_uid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is not registered.",
        )

    return user


async def get_current_user_id(
    user: Annotated[UserModel, Depends(get_current_user)],
) -> UUID:
    return user.user_id


def _profile_missing_fields(user: UserModel) -> list[str]:
    missing: list[str] = []
    if not user.pref_code:
        missing.append("pref_code")
    if not user.skin_type:
        missing.append("skin_type")
    if user.cycle_length_days is None:
        missing.append("cycle_length_days")
    if user.last_menstruation_start is None:
        missing.append("last_menstruation_start")
    return missing


async def require_profile_complete(
    user: Annotated[UserModel, Depends(get_current_user)],
) -> None:
    missing = _profile_missing_fields(user)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profile is incomplete.",
        )
