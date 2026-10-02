"""실제 이동 경로(도로/보행로)와 소요 시간.

- car : 카카오모빌리티 길찾기 API (카카오 REST 키 사용)
- walk: OpenStreetMap 기반 routing.openstreetmap.de 도보 경로 (키 불필요, 공정 사용)
- 대중교통은 무료 공개 API 가 없어 지원하지 않는다(프론트에서 추정치 + 카카오맵 링크)

같은 구간은 메모리에 캐시해 반복 호출을 줄인다.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Literal

import httpx
from pydantic import BaseModel, Field

from .config import get_settings

logger = logging.getLogger(__name__)

KAKAO_DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/v1/directions"
OSM_FOOT_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/driving/{a};{b}"
CONCURRENCY = 4
MAX_LEGS = 40

Mode = Literal["car", "walk"]


class Point(BaseModel):
    lat: float
    lng: float


class LegRequest(BaseModel):
    mode: Mode
    start: Point
    end: Point


class RouteRequest(BaseModel):
    legs: list[LegRequest] = Field(..., max_length=MAX_LEGS)


class LegResult(BaseModel):
    distance_m: int
    duration_s: int
    geometry: list[tuple[float, float]]  # [(lat, lng), ...]


_cache: dict[tuple, LegResult | None] = {}


def _key(leg: LegRequest) -> tuple:
    r = lambda v: round(v, 5)  # noqa: E731 - 약 1m 정밀도
    return (leg.mode, r(leg.start.lat), r(leg.start.lng), r(leg.end.lat), r(leg.end.lng))


async def _car(client: httpx.AsyncClient, leg: LegRequest) -> LegResult | None:
    key = get_settings().kakao_rest_api_key
    if not key:
        return None
    res = await client.get(
        KAKAO_DIRECTIONS_URL,
        params={
            "origin": f"{leg.start.lng},{leg.start.lat}",
            "destination": f"{leg.end.lng},{leg.end.lat}",
            "priority": "RECOMMEND",
        },
        headers={"Authorization": f"KakaoAK {key}"},
    )
    if res.status_code != 200:
        logger.warning("카카오 길찾기 실패(%s): %s", res.status_code, res.text[:120])
        return None
    route = (res.json().get("routes") or [{}])[0]
    if route.get("result_code") != 0:
        return None  # 출발지=도착지 근접 등 경로 없음
    coords: list[tuple[float, float]] = []
    for section in route.get("sections", []):
        for road in section.get("roads", []):
            v = road.get("vertexes", [])
            coords.extend((v[i + 1], v[i]) for i in range(0, len(v) - 1, 2))
    summary = route.get("summary", {})
    return LegResult(distance_m=int(summary.get("distance", 0)), duration_s=int(summary.get("duration", 0)), geometry=coords)


async def _walk(client: httpx.AsyncClient, leg: LegRequest) -> LegResult | None:
    url = OSM_FOOT_URL.format(a=f"{leg.start.lng},{leg.start.lat}", b=f"{leg.end.lng},{leg.end.lat}")
    res = await client.get(url, params={"overview": "full", "geometries": "geojson"})
    if res.status_code != 200:
        logger.warning("도보 경로 실패(%s): %s", res.status_code, res.text[:120])
        return None
    routes = res.json().get("routes") or []
    if not routes:
        return None
    r = routes[0]
    coords = [(lat, lng) for lng, lat in r["geometry"]["coordinates"]]
    return LegResult(distance_m=round(r["distance"]), duration_s=round(r["duration"]), geometry=coords)


async def route_legs(legs: list[LegRequest]) -> list[LegResult | None]:
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(client: httpx.AsyncClient, leg: LegRequest) -> LegResult | None:
        k = _key(leg)
        if k in _cache:
            return _cache[k]
        async with sem:
            try:
                result = await (_car(client, leg) if leg.mode == "car" else _walk(client, leg))
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                logger.warning("경로 조회 오류(%s): %s", leg.mode, exc)
                return None  # 일시 오류는 캐시하지 않는다
        _cache[k] = result
        return result

    async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": "TripPlan/1.0"}) as client:
        return list(await asyncio.gather(*(one(client, leg) for leg in legs)))
