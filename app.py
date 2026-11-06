"""Cafe kiosk frontend and MongoDB-backed order API."""

import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StrictInt
from pymongo import MongoClient
from pymongo.errors import PyMongoError


ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
MONGODB_URI = os.getenv("MONGODB_URI", "")
DATABASE_NAME = os.getenv("MONGODB_DB", "cafe_kiosk")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_SESSION_HOURS = 8
admin_sessions: dict[str, datetime] = {}
CATALOG = {item["id"]: item for item in json.loads((ROOT / "dist" / "catalog.json").read_text(encoding="utf-8"))}


class OrderItem(BaseModel):
    id: StrictInt
    temp: str
    qty: StrictInt = Field(ge=1, le=99)


class OrderRequest(BaseModel):
    place: Literal["매장", "포장"]
    items: list[OrderItem] = Field(min_length=1, max_length=30)


class AdminLogin(BaseModel):
    password: str


class StatusUpdate(BaseModel):
    status: Literal["received", "preparing", "ready", "completed"]


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    if not MONGODB_URI or "<db_password>" in MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured")
    return MongoClient(MONGODB_URI, serverSelectionTimeoutMS=8000, connectTimeoutMS=8000)


app = FastAPI(title="오후의 커피 주문 API")


def require_admin(request: Request) -> None:
    token = request.cookies.get("admin_session", "")
    expires_at = admin_sessions.get(token)
    if not expires_at or expires_at <= datetime.now(timezone.utc):
        admin_sessions.pop(token, None)
        raise HTTPException(status_code=401, detail="관리자 로그인이 필요합니다.")


def orders_collection():
    return get_mongo_client()[DATABASE_NAME]["orders"]


@app.get("/api/health")
def health() -> dict[str, str]:
    try:
        get_mongo_client().admin.command("ping")
    except (PyMongoError, RuntimeError):
        raise HTTPException(status_code=503, detail="MongoDB에 연결하지 못했습니다.") from None
    return {"database": "ok"}


@app.post("/api/orders", status_code=201)
def create_order(order: OrderRequest) -> dict[str, int | str]:
    items = []
    for requested in order.items:
        product = CATALOG.get(requested.id)
        if product is None:
            raise HTTPException(status_code=400, detail="메뉴를 확인해 주세요.")
        valid_temperature = (
            requested.temp == "" if product["cat"] == "디저트"
            else requested.temp == "ICE" if product.get("cold")
            else requested.temp in ("HOT", "ICE")
        )
        if not valid_temperature:
            raise HTTPException(status_code=400, detail="메뉴 옵션을 확인해 주세요.")
        items.append({
            "productId": product["id"],
            "name": product["name"],
            "temp": requested.temp,
            "quantity": requested.qty,
            "unitPrice": product["price"],
            "lineTotal": product["price"] * requested.qty,
        })

    count = sum(item["quantity"] for item in items)
    total = sum(item["lineTotal"] for item in items)
    order_id = ObjectId()
    order_number = str(order_id)[-8:].upper()
    document = {
        "_id": order_id,
        "orderNumber": order_number,
        "place": order.place,
        "items": items,
        "count": count,
        "total": total,
        "status": "received",
        "paymentStatus": "demo",
        "createdAt": datetime.now(timezone.utc),
    }
    try:
        orders_collection().insert_one(document)
    except (PyMongoError, RuntimeError):
        raise HTTPException(status_code=503, detail="주문 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.") from None
    return {"orderNumber": order_number, "total": total, "count": count}


@app.post("/api/admin/login")
def admin_login(credentials: AdminLogin, request: Request, response: Response) -> dict[str, bool]:
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="관리자 비밀번호가 설정되지 않았습니다.")
    if not secrets.compare_digest(credentials.password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    now = datetime.now(timezone.utc)
    for token, expiry in list(admin_sessions.items()):
        if expiry <= now:
            del admin_sessions[token]
    token = secrets.token_urlsafe(32)
    admin_sessions[token] = now + timedelta(hours=ADMIN_SESSION_HOURS)
    response.set_cookie(
        "admin_session", token, max_age=ADMIN_SESSION_HOURS * 3600,
        httponly=True, secure=request.url.scheme == "https", samesite="strict", path="/api/admin",
    )
    return {"ok": True}


@app.post("/api/admin/logout")
def admin_logout(request: Request, response: Response) -> dict[str, bool]:
    admin_sessions.pop(request.cookies.get("admin_session", ""), None)
    response.delete_cookie("admin_session", path="/api/admin")
    return {"ok": True}


@app.get("/api/admin/session")
def admin_session(request: Request) -> dict[str, bool]:
    require_admin(request)
    return {"ok": True}


@app.get("/api/admin/orders")
def list_orders(request: Request) -> dict[str, list[dict]]:
    require_admin(request)
    try:
        cursor = orders_collection().find({}).sort("createdAt", -1).limit(100)
        orders = [{
            "id": str(order["_id"]),
            "orderNumber": order.get("orderNumber", ""),
            "place": order.get("place", ""),
            "items": order.get("items", []),
            "count": order.get("count", 0),
            "total": order.get("total", 0),
            "status": order.get("status", "received"),
            "createdAt": order["createdAt"].isoformat() if order.get("createdAt") else "",
        } for order in cursor]
    except (PyMongoError, RuntimeError):
        raise HTTPException(status_code=503, detail="주문 목록을 불러오지 못했습니다.") from None
    return {"orders": orders}


@app.patch("/api/admin/orders/{order_id}/status")
def update_order_status(order_id: str, update: StatusUpdate, request: Request) -> dict[str, str]:
    require_admin(request)
    try:
        object_id = ObjectId(order_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="주문 번호가 올바르지 않습니다.") from None
    try:
        result = orders_collection().update_one(
            {"_id": object_id},
            {"$set": {"status": update.status, "updatedAt": datetime.now(timezone.utc)}},
        )
    except (PyMongoError, RuntimeError):
        raise HTTPException(status_code=503, detail="주문 상태를 변경하지 못했습니다.") from None
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="주문을 찾지 못했습니다.")
    return {"status": update.status}


app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="kiosk")
