"""Web Push notification management for waiters."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from shared.infrastructure.db import get_db, safe_commit
from shared.security.auth import current_user_context

router = APIRouter(prefix="/api/waiter/notifications", tags=["waiter-notifications"])


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # {p256dh: str, auth: str}


# In-memory store for dev (should be Redis or DB in production)
_subscriptions: dict[int, list[dict]] = {}


@router.post("/subscribe")
def subscribe_push(
    body: PushSubscription,
    user: dict = Depends(current_user_context),
):
    """Register push subscription for waiter."""
    user_id = int(user["sub"])
    if user_id not in _subscriptions:
        _subscriptions[user_id] = []

    # Avoid duplicates
    sub_data = {"endpoint": body.endpoint, "keys": body.keys}
    if sub_data not in _subscriptions[user_id]:
        _subscriptions[user_id].append(sub_data)

    return {"status": "subscribed"}


@router.delete("/unsubscribe")
def unsubscribe_push(
    body: PushSubscription,
    user: dict = Depends(current_user_context),
):
    """Remove push subscription."""
    user_id = int(user["sub"])
    sub_data = {"endpoint": body.endpoint, "keys": body.keys}
    if user_id in _subscriptions:
        _subscriptions[user_id] = [s for s in _subscriptions[user_id] if s != sub_data]
    return {"status": "unsubscribed"}


def get_subscriptions(user_id: int) -> list[dict]:
    """Get all push subscriptions for a user."""
    return _subscriptions.get(user_id, [])
