# app/routers/auth.py
from typing import Annotated
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.deps import verify_firebase_token
from app.models.user import User as UserModel
from app.schemas.auth import AuthVerifyRequest, AuthVerifyResponse

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

DbSession = Annotated[AsyncSession, Depends(get_db)]
logger = logging.getLogger(__name__)


@router.post(
    "/verify",
    response_model=AuthVerifyResponse,
)
async def verify_auth(
    body: AuthVerifyRequest,
    db: DbSession,
):
    try:
        decoded = verify_firebase_token(body.token)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.warning("Firebase token verification failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID token.",
        ) from exc

    firebase_uid = decoded["uid"]
    auth_provider = decoded.get("firebase", {}).get("sign_in_provider") or "google"
    email = decoded.get("email")

    stmt = select(UserModel).where(UserModel.firebase_uid == firebase_uid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = UserModel(
            firebase_uid=firebase_uid,
            auth_provider=auth_provider,
            email=email,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if email and user.email is None:
            user.email = email
            await db.commit()
            await db.refresh(user)

    return AuthVerifyResponse(
        user_id=str(user.user_id),
        firebase_uid=user.firebase_uid,
        email=user.email,
    )


@router.get("/ping")
async def ping_auth():
    return {"message": "auth ok"}
