# Author : Rajveer Sharma
# Date : 17 Nov 2026
# @ Nxtwave
"""Sign-in through the Student Hub web app.

The hub's web app proxies /api/contest/* here and signs a 60-second HS256 identity token
for every request (platform/web/common/services/identity-token.ts), sent as
`Authorization: Bearer <token>`; no cookies come with it. With IDENTITY_JWT_SECRET set
(the web app's CONTEST_JWT_SECRET), such a request is signed in as the NxtRank login whose
username is the token's email. A hub owner or admin with no NxtRank login gets a stand-in
admin that exists only for the request; other hub staff without one get a read-only viewer;
anyone else (e.g. a student) is refused.

The token is checked here with the standard library (HS256 only), so no JWT package is needed."""

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from app.db.models import User

ISSUER = "student-hub-web"
AUDIENCE = "contest-api"
LEEWAY_SECS = 5  # clock difference allowed between the web app and this service

# stand-ins for hub staff with no NxtRank login: never saved, and their ids
# can't be a real user's (ids start at 1), so "is this me?" checks never match anyone
OWNER_STAND_IN_ID = -1
ADMIN_STAND_IN_ID = -2
VIEWER_STAND_IN_ID = -3
HUB_VIEWER_ROLES = ("senior_instructor", "instructor", "success_coach")
NO_PASSWORD = "!"  # not a hash any password produces


class InvalidToken(Exception):
    """The token is malformed, forged, expired or meant for someone else."""


@dataclass(frozen=True)
class Identity:
    sub: str  # the hub's staff id
    email: str  # lower-case
    name: str
    role: str  # owner | admin | senior_instructor | instructor


def bearer_token(authorization: str | None) -> str | None:
    """The token of an `Authorization: Bearer ...` header ("" if it's empty), else None."""
    if not authorization:
        return None
    scheme, _, token = authorization.strip().partition(" ")
    return token.strip() if scheme.lower() == "bearer" else None


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _json_part(part: str) -> dict:
    try:
        value = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    except ValueError:  # bad base64, bad UTF-8 or bad JSON
        raise InvalidToken("malformed") from None
    if not isinstance(value, dict):
        raise InvalidToken("malformed")
    return value


def _number(value) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def verify(token: str, secret: str, *, now: float | None = None) -> Identity:
    """Checks the signature, algorithm, issuer, audience, expiry and claims; raises InvalidToken."""
    parts = token.split(".")
    if len(parts) != 3 or not all(parts):
        raise InvalidToken("malformed")
    header_b64, payload_b64, signature = parts
    try:
        signed = f"{header_b64}.{payload_b64}".encode("ascii")
    except UnicodeEncodeError:
        raise InvalidToken("malformed") from None
    expected = _b64(hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).digest())
    if not hmac.compare_digest(signature.encode("ascii", "replace"), expected.encode("ascii")):
        raise InvalidToken("bad signature")

    header = _json_part(header_b64)
    if header.get("alg") != "HS256" or "crit" in header:
        raise InvalidToken("unexpected algorithm")
    claims = _json_part(payload_b64)
    if claims.get("iss") != ISSUER:
        raise InvalidToken("wrong issuer")
    aud = claims.get("aud")
    if not (aud == AUDIENCE or (isinstance(aud, list) and AUDIENCE in aud)):
        raise InvalidToken("wrong audience")

    now = time.time() if now is None else now
    exp = claims.get("exp")
    if not _number(exp):
        raise InvalidToken("no expiry")
    if now > exp + LEEWAY_SECS:
        raise InvalidToken("expired")
    nbf = claims.get("nbf")
    if nbf is not None and (not _number(nbf) or now + LEEWAY_SECS < nbf):
        raise InvalidToken("not valid yet")
    iat = claims.get("iat")
    if iat is not None and not _number(iat):
        raise InvalidToken("bad issued-at")

    sub, email, role, name = claims.get("sub"), claims.get("email"), claims.get("role"), claims.get("name")
    if not isinstance(sub, str) or not sub or not isinstance(role, str) or not role:
        raise InvalidToken("missing claims")
    if not isinstance(email, str) or "@" not in email.strip():
        raise InvalidToken("missing claims")
    email = email.strip().lower()
    return Identity(sub=sub, email=email, name=name.strip() if isinstance(name, str) and name.strip() else email,
                    role=role)


def stand_in(who: Identity) -> User | None:
    """The request's user for a hub owner (super admin) or admin (admin) with no NxtRank
    login; None for anyone else. Transient: never added to a database session."""
    if who.role == "owner":
        uid, is_super, role = OWNER_STAND_IN_ID, True, "admin"
    elif who.role == "admin":
        uid, is_super, role = ADMIN_STAND_IN_ID, False, "admin"
    elif who.role in HUB_VIEWER_ROLES:
        # NxtOne staff without a NxtRank login (NxtRank is being retired): read-only, every
        # student; NxtOne sends its own "my students" as roll numbers (routes_data._scope).
        uid, is_super, role = VIEWER_STAND_IN_ID, False, "viewer"
    else:
        return None
    # username is what audit fields and scan requests record (requested_by holds 64 characters)
    return User(id=uid, username=who.email[:64], display_name=who.name[:200], password_hash=NO_PASSWORD,
                role=role, active=True, is_super=is_super)
