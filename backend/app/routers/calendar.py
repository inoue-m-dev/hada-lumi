# app/routers/calendar.py
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.deps import get_current_user_id, require_profile_complete

router = APIRouter(
    prefix="/calendar",
    tags=["calendar"],
    dependencies=[Depends(require_profile_complete)],
)

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]


@router.get("/ping")
async def ping_calendar(
    current_user_id: CurrentUserId,
):
    return {"message": "calendar ok"}
