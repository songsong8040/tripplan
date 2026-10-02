"""간이 PIN/토큰 처리. 로그인 없는 방 참여를 위한 최소한의 보호 장치."""

from __future__ import annotations

import hashlib
import hmac
import secrets


def hash_pin(pin: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), 120_000).hex()
    return salt, digest


def verify_pin(pin: str, salt: str, expected: str) -> bool:
    _, digest = hash_pin(pin, salt)
    return hmac.compare_digest(digest, expected)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
