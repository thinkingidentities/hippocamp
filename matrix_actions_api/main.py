"""FastAPI server exposing a strict Matrix action surface for Gabe."""
from __future__ import annotations

import asyncio
import logging
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from nio import (
    AsyncClient,
    AsyncClientConfig,
    JoinedMembersError,
    JoinedMembersResponse,
    LoginError,
    LoginResponse,
    SyncError,
    SyncResponse,
    RoomSendError,
    RoomSendResponse,
)
from nio.events.room_events import RoomMessageText

logger = logging.getLogger("gabe.matrix_actions")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")


@dataclass
class MatrixSettings:
    """Runtime configuration for the Matrix bridge."""

    homeserver: str
    user_id: str
    device_id: str
    device_name: str
    session_store: Path
    op_password_path: Optional[str]
    op_cli_path: str

    @classmethod
    def from_env(cls) -> "MatrixSettings":
        homeserver = os.getenv("MATRIX_HOMESERVER", "https://matrix.hippocamp.ai")
        user_id = os.getenv("MATRIX_USER_ID")
        if not user_id:
            raise RuntimeError("MATRIX_USER_ID environment variable is required")
        device_id = os.getenv("MATRIX_DEVICE_ID", "GABE_ACTIONS_DEVICE")
        device_name = os.getenv("MATRIX_DEVICE_NAME", "Gabe Matrix Actions Bridge")
        store_path = Path(os.getenv("MATRIX_SESSION_STORE", ".matrix-store")).expanduser()
        store_path.mkdir(parents=True, exist_ok=True)
        op_password_path = os.getenv("OP_MATRIX_PASSWORD_PATH")
        op_cli_path = os.getenv("OP_CLI_PATH", "op")
        return cls(
            homeserver=homeserver,
            user_id=user_id,
            device_id=device_id,
            device_name=device_name,
            session_store=store_path,
            op_password_path=op_password_path,
            op_cli_path=op_cli_path,
        )


def load_secret(settings: MatrixSettings, env_key: str) -> str:
    """Load a secret from the environment or 1Password CLI."""

    value = os.getenv(env_key)
    if value:
        return value

    if settings.op_password_path:
        logger.info("Reading %s from 1Password path %s", env_key, settings.op_password_path)
        try:
            completed = subprocess.run(  # noqa: S603,S607
                [settings.op_cli_path, "read", settings.op_password_path],
                capture_output=True,
                text=True,
                check=False,
            )
        except FileNotFoundError as exc:  # pragma: no cover - depends on operator env
            raise RuntimeError("1Password CLI not found; set MATRIX_PASSWORD instead") from exc
        if completed.returncode != 0:
            raise RuntimeError(f"1Password CLI read failed: {completed.stderr.strip()}")
        secret = completed.stdout.strip()
        if secret:
            return secret

    raise RuntimeError(f"{env_key} not provided; set env var or configure OP_MATRIX_PASSWORD_PATH")


class SendMessageRequest(BaseModel):
    """Input payload for the send_message endpoint."""

    room_id: str = Field(..., description="Matrix room_id provided by the operator")
    message: str = Field(..., min_length=1, description="Plain text body to send")


class SendMessageResponse(BaseModel):
    """Response returned after sending a Matrix event."""

    event_id: str
    room_id: str
    status: str


class MatrixMessage(BaseModel):
    """Normalized Matrix text event returned to GPT."""

    body: str
    event_id: str
    sender: str
    timestamp: int


class MatrixMember(BaseModel):
    """Member of a Matrix room."""

    user_id: str
    display_name: Optional[str]


class MatrixService:
    """Handles authenticated interactions with Matrix using matrix-nio."""

    def __init__(self, settings: MatrixSettings) -> None:
        self._settings = settings
        config = AsyncClientConfig(store_sync_tokens=True)
        self._client = AsyncClient(
            homeserver=settings.homeserver,
            user=settings.user_id,
            device_id=settings.device_id,
            store_path=str(settings.session_store),
            config=config,
        )
        self._password: Optional[str] = None
        self._lock = asyncio.Lock()
        self._logged_in = False

    async def _ensure_login(self) -> None:
        async with self._lock:
            if self._logged_in and self._client.access_token:
                return
            if not self._password:
                self._password = load_secret(self._settings, "MATRIX_PASSWORD")
            logger.info("Logging into Matrix homeserver %s as %s", self._settings.homeserver, self._settings.user_id)
            response = await self._client.login(  # type: ignore[arg-type]
                password=self._password,
                device_name=self._settings.device_name,
            )
            if isinstance(response, LoginError):
                logger.error("Matrix login failed: %s", response.message)
                raise HTTPException(status_code=401, detail="Matrix authentication failed")
            if not isinstance(response, LoginResponse):
                raise HTTPException(status_code=502, detail="Unexpected login response from Matrix")
            self._logged_in = True
            logger.info("Matrix session established for %s", self._settings.user_id)

    async def send_message(self, room_id: str, body: str) -> str:
        await self._ensure_login()
        logger.info("Sending message to room %s", room_id)
        response = await self._client.room_send(
            room_id,
            message_type="m.room.message",
            content={"msgtype": "m.text", "body": body},
        )
        if isinstance(response, RoomSendError):
            logger.error("Matrix send failed: %s", response.message)
            raise HTTPException(status_code=502, detail="Matrix send failed")
        if not isinstance(response, RoomSendResponse):
            raise HTTPException(status_code=502, detail="Unknown send response from Matrix")
        logger.info("Message delivered: %s", response.event_id)
        return response.event_id

    async def read_messages(self, room_id: str, limit: int) -> List[MatrixMessage]:
        await self._ensure_login()
        logger.info("Syncing room %s for latest messages", room_id)
        sync = await self._client.sync(timeout=5000, full_state=False)
        if isinstance(sync, SyncError):
            logger.error("Matrix sync failed: %s", sync.message)
            raise HTTPException(status_code=502, detail="Matrix sync failed")
        if not isinstance(sync, SyncResponse):
            raise HTTPException(status_code=502, detail="Unexpected sync response from Matrix")
        room = self._client.rooms.get(room_id)
        if not room:
            logger.error("Room %s not found in sync response", room_id)
            raise HTTPException(status_code=404, detail="Room not found or not joined")

        # Get timeline events from sync response
        timeline_events = []
        if room_id in sync.rooms.join:
            timeline_events = sync.rooms.join[room_id].timeline.events

        messages: List[MatrixMessage] = []
        for event in reversed(timeline_events):
            if isinstance(event, RoomMessageText):
                messages.append(
                    MatrixMessage(
                        body=event.body,
                        event_id=event.event_id,
                        sender=event.sender,
                        timestamp=event.server_timestamp,
                    )
                )
            if len(messages) >= limit:
                break
        return messages

    async def room_members(self, room_id: str) -> List[MatrixMember]:
        await self._ensure_login()
        response = await self._client.joined_members(room_id)
        if isinstance(response, JoinedMembersError):
            logger.error("Failed to fetch members for %s: %s", room_id, response.message)
            raise HTTPException(status_code=502, detail="Failed to fetch room members")
        if not isinstance(response, JoinedMembersResponse):
            raise HTTPException(status_code=502, detail="Unknown member response from Matrix")

        # In matrix-nio 0.25.2, response.members is a list of RoomMember objects
        return [
            MatrixMember(user_id=member.user_id, display_name=member.display_name)
            for member in response.members
        ]

    async def shutdown(self) -> None:
        if self._client:
            await self._client.close()
            logger.info("Matrix client connection closed")


app = FastAPI(
    title="Gabe Matrix Actions API",
    description="HTTPS bridge that allows ChatGPT GPT Actions to interact with Gabe's Clearing",
    version="1.0.0",
    servers=[{"url": "https://cognates.hippocamp.ai/gabe"}],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def get_service() -> MatrixService:
    service = getattr(app.state, "matrix_service", None)
    if service is None:
        raise HTTPException(status_code=500, detail="Matrix service not initialized")
    return service


@app.post("/send_message", response_model=SendMessageResponse)
async def send_message(request: SendMessageRequest, service: MatrixService = Depends(get_service)) -> SendMessageResponse:
    """Send a text event to a Matrix room when explicitly asked."""

    event_id = await service.send_message(request.room_id, request.message)
    return SendMessageResponse(event_id=event_id, room_id=request.room_id, status="sent")


@app.get("/read_messages", response_model=List[MatrixMessage])
async def read_messages(
    room_id: str = Query(..., description="Matrix room_id to read"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of events to return"),
    service: MatrixService = Depends(get_service),
) -> List[MatrixMessage]:
    """Return the latest Matrix text events for the requested room."""

    return await service.read_messages(room_id=room_id, limit=limit)


@app.get("/room_members", response_model=List[MatrixMember])
async def room_members(
    room_id: str = Query(..., description="Matrix room_id to inspect"),
    service: MatrixService = Depends(get_service),
) -> List[MatrixMember]:
    """Return the joined members for the requested Matrix room."""

    return await service.room_members(room_id=room_id)


@app.on_event("startup")
async def startup_event() -> None:
    """Instantiate the Matrix client exactly once for the process lifetime."""

    settings = MatrixSettings.from_env()
    app.state.settings = settings
    app.state.matrix_service = MatrixService(settings)
    logger.info("Matrix service initialized at startup")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Ensure the Matrix connection is closed when the server stops."""

    service: Optional[MatrixService] = getattr(app.state, "matrix_service", None)
    if service:
        await service.shutdown()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8080")), reload=False)
