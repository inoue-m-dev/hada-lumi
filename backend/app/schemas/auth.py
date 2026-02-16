from pydantic import BaseModel, Field


class AuthVerifyRequest(BaseModel):
    token: str = Field(..., description="Firebase ID Token")


class AuthVerifyResponse(BaseModel):
    user_id: str = Field(..., description="ユーザーID（UUID）")
    firebase_uid: str = Field(..., description="Firebase UID")
    email: str | None = Field(None, description="メールアドレス")
