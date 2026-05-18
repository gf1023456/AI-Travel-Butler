"""
AI Travel Butler - Post-processing Functions
"""

from typing import List, Dict, Any
from .utils import get_city_center, infer_city_from_request, infer_requested_days
from .normalizer import normalize_location


def extract_expected_city_from_input(user_input: str, social_recommendations: List[Dict]) -> str:
    """Extract expected city from user input."""
    return infer_city_from_request(user_input, social_recommendations) or ""


def _geo_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Approximate distance in km using equirectangular projection."""
    import math
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


def harmonize_itinerary_city(items: List[Dict], expected_city: str, mcp_trace: List[str]) -> List[Dict]:
    """Ensure all locations are in the expected city, with geo-distance validation."""
    if not expected_city:
        return items

    center = get_city_center(expected_city)
    max_dist_km = 100  # ~1 degree threshold

    replaced = 0
    skipped = 0
    normalized = []
    for item in items:
        if item.get("city") == expected_city:
            normalized.append(item)
        else:
            item_lat = item.get("lat")
            item_lng = item.get("lng")
            if item_lat and item_lng:
                try:
                    dist = _geo_distance_km(float(item_lat), float(item_lng), center["lat"], center["lng"])
                    if dist > max_dist_km:
                        skipped += 1
                        mcp_trace.append(f"postprocess:city_skip_geo:{item.get('name')}:{item.get('city')}->{expected_city}:{dist:.0f}km")
                        normalized.append(item)
                        continue
                except (ValueError, TypeError):
                    pass
            replaced += 1
            normalized.append({**item, "city": expected_city})

    if replaced > 0:
        mcp_trace.append(f"postprocess:city_aligned:{expected_city}:count:{replaced}")
    if skipped > 0:
        mcp_trace.append(f"postprocess:city_geo_skipped:{expected_city}:count:{skipped}")

    return normalized


def synthesize_locations_from_social(user_input: str, social_recommendations: List[Dict], provider: str, mcp_trace: List[str]) -> List[Dict]:
    """Generate locations from social recommendations as fallback."""
    if not social_recommendations:
        return []

    city = infer_city_from_request(user_input, social_recommendations)
    center = get_city_center(city or "北京")
    requested_days = infer_requested_days(user_input)
    target_count = min(12, max(4, requested_days * 3))
    picks = social_recommendations[:target_count]

    slots = ["09:30 - 11:00", "12:30 - 14:00", "15:30 - 17:00", "19:00 - 21:00"]

    items = []
    for idx, rec in enumerate(picks):
        lat_offset = (idx - 1.5) * 0.02
        lng_offset = (idx - 1.5) * 0.02
        item = normalize_location({
            "name": rec.get("title", ""),
            "city": city or "目的地待确认",
            "description": rec.get("reason") or f"热门打卡：{rec.get('title', '')}",
            "lat": center["lat"] + lat_offset,
            "lng": center["lng"] + lng_offset,
            "time": slots[idx % len(slots)] if slots else "10:00 - 12:00",
            "day": min(requested_days, idx // 3 + 1),
            "sequence": idx % 3 + 1,
            "transit_hint": "从酒店/出发地前往" if idx == 0 else f"从上一站前往 {rec.get('title', '')}",
            "category": "FOOD" if idx == 1 else "SIGHT",
            "source": f"fallback:{provider}:social_to_location",
            "confidence": 0.45
        }, provider)
        if item:
            items.append(item)

    mcp_trace.append(f"fallback:{provider}:synthesized_locations:{len(items)}:days:{requested_days}")
    return items


def ensure_minimum_items_by_requested_days(items: List[Dict], user_input: str, social_recommendations: List[Dict], provider: str, mcp_trace: List[str]) -> List[Dict]:
    """Ensure minimum number of items based on requested days."""
    requested_days = infer_requested_days(user_input)
    min_required = max(3, requested_days * 3)

    safe_items = items if isinstance(items, list) else []
    day_set = set(int(x.get("day", 1)) for x in safe_items)

    day_coverage_ok = len(day_set) >= requested_days
    count_ok = len(safe_items) >= min_required

    if day_coverage_ok and count_ok:
        return safe_items

    if not day_coverage_ok:
        mcp_trace.append(f"postprocess:days_mismatch:need:{requested_days}:got:{len(day_set)}")
    if not count_ok:
        mcp_trace.append(f"postprocess:count_mismatch:need:{min_required}:got:{len(safe_items)}")

    synthesized = synthesize_locations_from_social(user_input, social_recommendations, provider, mcp_trace)
    if not synthesized:
        return safe_items

    if not safe_items:
        return synthesized

    merged = list(safe_items)
    existing_keys = set(f"{x.get('day')}|{x.get('sequence')}|{x.get('name')}" for x in merged)

    for item in synthesized:
        key = f"{item.get('day')}|{item.get('sequence')}|{item.get('name')}"
        if key not in existing_keys:
            merged.append(item)
            existing_keys.add(key)
            if len(merged) >= min_required:
                break

    mcp_trace.append(f"postprocess:backfill_from_social:added:{len(merged) - len(safe_items)}")
    return merged


def enrich_with_mcp_signals(items: List[Dict], mcp_trace: List[str], real_weather: Dict = None) -> List[Dict]:
    """Enrich itinerary with MCP signals. Pass real_weather={\"temp\":...,\"icon\":...,\"text\":...,\"obsTime\":...} from external API."""
    import math

    sorted_items = sorted(items, key=lambda x: (x.get("day", 1), x.get("sequence", 1)))
    enriched = []

    for idx, item in enumerate(sorted_items):
        next_transit = item.get("transit_hint", "")

        if not next_transit and idx < len(sorted_items) - 1:
            next_item = sorted_items[idx + 1]
            try:
                curr_lat = float(item.get("lat", 0))
                curr_lng = float(item.get("lng", 0))
                next_lat = float(next_item.get("lat", 0))
                next_lng = float(next_item.get("lng", 0))

                if curr_lat and curr_lng and next_lat and next_lng:
                    lat_diff = abs(curr_lat - next_lat)
                    lng_diff = abs(curr_lng - next_lng)
                    dist_km = math.sqrt(lat_diff**2 + lng_diff**2) * 111

                    if dist_km < 2:
                        duration = int(dist_km * 10)
                        next_transit = f"建议步行从 {item.get('name')} 前往 {next_item.get('name')}，约 {duration} 分钟"
                    elif dist_km < 15:
                        duration = int(dist_km * 3)
                        next_transit = f"建议打车从 {item.get('name')} 前往 {next_item.get('name')}，约 {duration} 分钟"
                    else:
                        duration = int(dist_km * 0.5) + 30
                        next_transit = f"从 {item.get('name')} 前往 {next_item.get('name')} 较远(约{dist_km:.1f}km)，建议安排{duration}分钟左右"
                    mcp_trace.append("mcp:route:realistic_transit_hint")
                else:
                    next_transit = f"建议从 {item.get('name')} 前往下一站"
                    mcp_trace.append("mcp:route:missing_coordinates")
            except Exception:
                next_transit = f"建议从 {item.get('name')} 前往下一站"
                mcp_trace.append("mcp:route:error_calculating")

        if real_weather:
            text = real_weather.get("text", "晴")
            icon_map = {"晴": "☀️", "多云": "⛅", "阴": "☁️", "雨": "🌧️", "雪": "❄️", "雾": "🌫️", "霾": "😶‍🌫️"}
            icon_emoji = next((v for k, v in icon_map.items() if k in text), "🌤️")
            weather = {
                "weather_icon": icon_emoji,
                "weather_condition": text,
                "temperature": f"{real_weather.get('temp', '25')}°C"
            }
            mcp_trace.append("mcp:weather:realtime_api")
        else:
            time_str = item.get("time", "")
            first_hour = int(time_str.split(":")[0]) if ":" in time_str else 12
            if first_hour <= 8:
                weather = {"weather_icon": "🌤️", "weather_condition": "清晨晴朗", "temperature": "18°C"}
            elif first_hour <= 16:
                weather = {"weather_icon": "☀️", "weather_condition": "白天晴朗", "temperature": "25°C"}
            else:
                weather = {"weather_icon": "🌙", "weather_condition": "夜间微风", "temperature": "20°C"}
            if not item.get("weather_icon"):
                mcp_trace.append("mcp:weather:estimated_point_forecast")

        description = item.get("description", "")
        if not description or len(description) < 20:
            description = f"{item.get('name', '该景点')}是本次行程的重要打卡点，风景优美，值得深度游玩。建议停留1-2小时，体验当地特色文化。"
            mcp_trace.append("mcp:suggestion:estimated_duration")

        cost_tags = ["门票", "收费", "付费", "价格", "消费"]
        has_cost = any(tag in description.lower() for tag in cost_tags)
        estimated_cost = item.get("estimated_cost")
        if not estimated_cost:
            estimated_cost = 30 if not has_cost else 80
            mcp_trace.append("mcp:cost:estimated")

        enriched.append({
            **item,
            "transit_hint": next_transit or "建议步行或公共交通前往",
            **weather,
            "visit_duration": item.get("visit_duration") or ("1-2小时"),
            "source": item.get("source") or "mcp:enriched",
            "estimated_cost": estimated_cost,
            "confidence": item.get("confidence", 0.62)
        })

    return enriched
