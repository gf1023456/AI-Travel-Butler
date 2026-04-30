"""
AI Travel Butler - Plan Verification
"""

from typing import List, Dict, Any


def verify_plan(items: List[Dict], mcp_trace: List[str]) -> List[str]:
    """Verify itinerary and return warnings."""
    warnings = []

    if not items or len(items) == 0:
        warnings.append("未生成任何地图标注点，请重试或切换模型。")
        mcp_trace.append("agent:verifier:warnings:1:no_locations")
        return warnings

    by_day = {}
    for item in items:
        day = item.get("day", 1)
        if day not in by_day:
            by_day[day] = []
        by_day[day].append(item)

    import math

    for day, day_items in by_day.items():
        if len(day_items) < 3:
            warnings.append(f"Day {day} 行程点位少于 3 个，建议补充早餐/晚间活动/交通节点。")

        sequences = sorted([int(x.get("sequence", 0)) for x in day_items])
        for i in range(1, len(sequences)):
            if sequences[i] == sequences[i - 1]:
                warnings.append(f"Day {day} 存在重复 sequence={sequences[i]}，可能导致顺序冲突。")
                break

        for i in range(len(day_items) - 1):
            current = day_items[i]
            next_item = day_items[i + 1]

            try:
                curr_lat = float(current.get("lat", 0))
                curr_lng = float(current.get("lng", 0))
                next_lat = float(next_item.get("lat", 0))
                next_lng = float(next_item.get("lng", 0))

                if curr_lat and curr_lng and next_lat and next_lng:
                    lat_diff = abs(curr_lat - next_lat)
                    lng_diff = abs(curr_lng - next_lng)
                    if lat_diff > 0.5 and lng_diff > 0.5:
                        warnings.append(f"Day {day} 中 {current.get('name')} 和 {next_item.get('name')} 之间距离过远，可能不连贯。")
                        mcp_trace.append(f"agent:verifier:geo_gap_warning:day_{day}")
            except (ValueError, TypeError):
                pass

    unique_cities = set(item.get("city") for item in items if item.get("city"))
    if len(unique_cities) > 1:
        warnings.append(f"行程包含了多个城市: {', '.join(unique_cities)}，不符合目的地要求。")
        mcp_trace.append("agent:verifier:multi_city_warning")

    if warnings:
        mcp_trace.append(f"agent:verifier:warnings:{len(warnings)}")
    else:
        mcp_trace.append("agent:verifier:pass")

    return warnings
