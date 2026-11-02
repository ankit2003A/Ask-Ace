import re

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("invalid email address")
        return v

    @field_validator("password")
    @classmethod
    def bcrypt_limit(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 bytes")
        return v


class RegisterIn(Credentials):
    """Sign-up adds a display name and a stronger password rule. Login keeps
    the plain rule, so accounts made before this rule existed still get in."""
    name: str = Field(default="", max_length=80)

    @field_validator("name")
    @classmethod
    def tidy_name(cls, v: str) -> str:
        return " ".join(v.split())

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if not re.search(r"\d", v):
            raise ValueError("password must include a number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("password must include a special character")
        return v


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GoogleCredential(BaseModel):
    """The ID token Google Identity Services hands to the browser."""
    credential: str = Field(min_length=1, max_length=4096)


class GitHubCode(BaseModel):
    """The one-time code GitHub sends back to the browser after sign-in."""
    code: str = Field(min_length=1, max_length=512)


class AuthConfigOut(BaseModel):
    """What the sign-in screen needs to know before it draws itself."""
    google_client_id: str = ""
    github_client_id: str = ""


class AskIn(BaseModel):
    # 1, not 3: "hi" is a legitimate message and gets a friendly reply.
    question: str = Field(min_length=1, max_length=1000)
    document_id: int | None = None


class ExamIn(BaseModel):
    document_id: int
    count: int = Field(default=10, ge=1, le=30)
    question_type: str = "mcq"
    difficulty: str = "mixed"

    @field_validator("question_type")
    @classmethod
    def known_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("mcq", "truefalse", "short", "mixed"):
            raise ValueError("question_type must be mcq, truefalse, short or mixed")
        return v

    @field_validator("difficulty")
    @classmethod
    def known_difficulty(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("easy", "medium", "hard", "mixed"):
            raise ValueError("difficulty must be easy, medium, hard or mixed")
        return v


class ResponseIn(BaseModel):
    question_id: int
    answer: str = Field(default="", max_length=500)


class AttemptIn(BaseModel):
    # Generous ceiling: one entry per question, and exams cap at 30.
    responses: list[ResponseIn] = Field(default_factory=list, max_length=60)
