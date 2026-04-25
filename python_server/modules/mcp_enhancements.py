"""
AI Travel Butler - MCP Enhancements
"""

from typing import List, Dict, Any


async def enrich_with_mcp_data(items: List[Dict], mcp_trace: List[str]) -> List[Dict]:
    """Enrich itinerary with MCP data."""
    if not items or len(items) == 0:
        return []

    mcp_tool_calls = []

    for item in items:
        try:
            lat = float(item.get("lat", 0))
            lng = float(item.get("lng", 0))
            place_name = item.get("name")
            city_name = item.get("city")

            if lat and lng and place_name and abs(lat) <= 90 and abs(lng) <= 180:
                mcp_tool_calls.append({
                    "name": "get_weather",
                    "args": {"latitude": lat, "longitude": lng}
                })
                mcp_tool_calls.append({
                    "name": "get_poi_info",
                    "args": {"name": place_name, "latitude": lat, "longitude": lng, "city": city_name}
                })
        except (ValueError, TypeError):
            continue

    if not mcp_tool_calls:
        return []

    print(f"[MCP DEBUG] Executing {len(mcp_tool_calls)} MCP tool calls")
    return []


def incorporate_mcp_results(plan_result: Dict, mcp_results: List[Dict]) -> Dict:
    """Incorporate MCP results into plan."""
    if not mcp_results:
        return plan_result

    updated_plan = plan_result.copy()
    itinerary = updated_plan.get("dayPlanItinerary", [])

    if not itinerary:
        return plan_result

    for mcp_result in mcp_results:
        if not mcp_result.get("success"):
            continue

        tool_name = mcp_result.get("toolName")
        result_data = mcp_result.get("result", {})
        args = mcp_result.get("args", {})

        if tool_name == "get_weather":
            target_lat = args.get("latitude")
            target_lng = args.get("longitude")
            condition = result_data.get("condition", "")
            temp = result_data.get("temperature", "")

            updated_itinerary = []
            for location in itinerary:
                try:
                    loc_lat = float(location.get("lat", 0))
                    loc_lng = float(location.get("lng", 0))
                    if target_lat and target_lng and loc_lat and loc_lng:
                        if abs(loc_lat - target_lat) < 0.01 and abs(loc_lng - target_lng) < 0.01:
                            weather_icon = get_weather_icon(condition)
                            location["weather_icon"] = weather_icon
                            location["weather_condition"] = condition
                            location["temperature"] = temp
                except (ValueError, TypeError):
                    pass
                updated_itinerary.append(location)
            updated_plan["dayPlanItinerary"] = updated_itinerary

        elif tool_name == "get_poi_info":
            poi_name = args.get("name")
            target_lat = args.get("latitude")
            target_lng = args.get("longitude")

            updated_itinerary = []
            for location in itinerary:
                try:
                    loc_lat = float(location.get("lat", 0))
                    loc_lng = float(location.get("lng", 0))
                    if location.get("name") == poi_name and target_lat and target_lng and loc_lat and loc_lng:
                        if abs(loc_lat - target_lat) < 0.01 and abs(loc_lng - target_lng) < 0.01:
                            if result_data.get("description"):
                                location["description"] = result_data["description"]
                            if result_data.get("opening_hours"):
                                location["opening_hours"] = result_data["opening_hours"]
                            if result_data.get("rating"):
                                location["rating"] = result_data["rating"]
                            if result_data.get("ticket_info"):
                                import re
                                ticket = re.sub(r"[^\d]", "", result_data["ticket_info"])
                                if ticket:
                                    location["estimated_cost"] = int(ticket)
                            if result_data.get("estimated_visit_time"):
                                location["visit_duration"] = result_data["estimated_visit_time"]
                            if result_data.get("address"):
                                location["address"] = result_data["address"]
                except (ValueError, TypeError):
                    pass
                updated_itinerary.append(location)
            updated_plan["dayPlanItinerary"] = updated_itinerary

    return updated_plan


def get_weather_icon(condition: str) -> str:
    """Map weather condition to emoji."""
    icon_map = {
        "晴": "☀️",
        "多云": "⛅",
        "阴": "☁️",
        "雨": "🌧️",
        "雪": "❄️",
        "雾": "🌫️",
        "霾": "😶‍🌫️"
    }

    for key, icon in icon_map.items():
        if key in condition:
            return icon

    return "🌤️"