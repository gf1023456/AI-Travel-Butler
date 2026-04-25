"""
AI Travel Butler - Tool Call Handler
"""

import json
import re
from typing import List, Dict, Any, Tuple


def parse_tool_arguments(raw_args: str) -> Dict[str, Any]:
    """Parse tool arguments from JSON string."""
    if not raw_args:
        return {}

    try:
        return json.loads(raw_args)
    except json.JSONDecodeError:
        # Try to fix common JSON issues
        try:
            cleaned = raw_args.replace("\\'", '"').replace("'", '"')
            # Fix: remove newlines after colon before array/object
            cleaned = re.sub(r':\s*\n\s*(\[|\{)', r': \1', cleaned)
            cleaned = re.sub(r"([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:", r'\1"\2":', cleaned)
            return json.loads(cleaned)
        except Exception:
            return {}


def normalize_location(args: Dict[str, Any], provider: str) -> Dict[str, Any]:
    """Normalize location data from tool call."""
    name = args.get("name")
    lat = args.get("lat")
    lng = args.get("lng")
    city = args.get("city")

    if not name or not lat or not lng or not city:
        return None

    # Convert string coordinates to float
    try:
        lat_float = float(lat) if isinstance(lat, (int, float, str)) else 39.9042
        lng_float = float(lng) if isinstance(lng, (int, float, str)) else 116.4074
    except (ValueError, TypeError):
        lat_float = 39.9042
        lng_float = 116.4074

    return {
        "name": str(name),
        "lat": lat_float,
        "lng": lng_float,
        "city": str(city),
        "day": args.get("day", 1),
        "sequence": args.get("sequence", 1),
        "time": args.get("time", ""),
        "transit_hint": args.get("transit_hint", ""),
        "description": args.get("description", ""),
        "category": args.get("category", "SIGHT"),
        "tags": args.get("tags", []),
        "address": args.get("address"),
        "rating": args.get("rating"),
        "source_provider": provider
    }


def normalize_recommendations(recommendations: List[Dict], provider: str) -> List[Dict[str, Any]]:
    """Normalize social recommendations."""
    normalized = []
    for rec in recommendations:
        if isinstance(rec, dict):
            normalized.append({
                "name": rec.get("title") or rec.get("name", ""),
                "platform": rec.get("platform", "all"),
                "category": rec.get("category", ""),
                "description": rec.get("reason") or rec.get("description", ""),
                "tags": rec.get("tags", []),
                "rank": rec.get("rank", 0),
                "hot_score": rec.get("hot_score", ""),
                "photo_tips": rec.get("photo_tips", ""),
                "source_provider": provider
            })
    return normalized


def map_tool_calls(tool_calls: List[Dict], mcp_trace: List[str], provider: str) -> Dict[str, Any]:
    """Process tool calls from AI model."""
    day_plan_itinerary = []
    social_recommendations = []

    print(f"[DEBUG] Processing {len(tool_calls) if tool_calls else 0} tool calls from {provider}")

    for tc in tool_calls or []:
        fn_name = tc.get("function", {}).get("name") or tc.get("name", "unknown")
        raw_args = tc.get("function", {}).get("arguments")
        args = {}

        # Special handling for get_social_recommendations
        if fn_name == "get_social_recommendations":
            if raw_args:
                args = parse_tool_arguments(raw_args)
                if not args:
                    args = {"recommendations": []}
                # Handle case where recommendations is still a string
                if isinstance(args.get("recommendations"), str):
                    try:
                        args["recommendations"] = json.loads(args["recommendations"])
                    except Exception:
                        args["recommendations"] = []
            else:
                args = tc.get("args", {})
        else:
            if isinstance(raw_args, dict):
                args = raw_args
            elif isinstance(raw_args, str):
                args = parse_tool_arguments(raw_args)
            else:
                args = tc.get("args", {}) if isinstance(tc.get("args"), dict) else {}

        if fn_name == "location":
            print(f"  [DEBUG] Processing location: {args.get('name')}")
            item = normalize_location(args, provider)
            if item:
                day_plan_itinerary.append(item)
                print(f"  [SUCCESS] Normalized location: {item['name']}")
            mcp_trace.append(f"tool:{provider}:location")

        if fn_name == "get_social_recommendations":
            social_recommendations = normalize_recommendations(args.get("recommendations", []), provider)
            print(f"  [INFO] Normalized {len(social_recommendations)} social recommendations")
            mcp_trace.append(f"tool:{provider}:get_social_recommendations")

    print(f"[RESULT] Locations: {len(day_plan_itinerary)}, Social Recs: {len(social_recommendations)}")
    return {
        "dayPlanItinerary": day_plan_itinerary,
        "socialRecommendations": social_recommendations
    }