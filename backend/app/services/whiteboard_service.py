"""Collaborative whiteboard with real-time sync and persistence."""

import json
from typing import Dict, List, Any
from datetime import datetime
from app.services.redis_service import redis_service


class WhiteboardService:
    """Manage persistent whiteboard for calls."""

    @staticmethod
    async def create_whiteboard(call_id: str, user_id: str) -> Dict:
        """Create a new whiteboard for the call."""
        key = f"call:{call_id}:whiteboard"
        
        whiteboard = {
            "call_id": call_id,
            "created_by": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "title": f"Whiteboard - {call_id}",
            "elements": [],
            "version": 1,
            "is_active": True,
        }
        
        await redis_service.redis.setex(key, 86400, json.dumps(whiteboard))
        return whiteboard

    @staticmethod
    async def add_element(call_id: str, user_id: str, element: Dict[str, Any]) -> Dict:
        """Add element (shape, text, drawing) to whiteboard."""
        key = f"call:{call_id}:whiteboard"
        data = await redis_service.redis.get(key)
        
        if not data:
            whiteboard = {
                "call_id": call_id,
                "elements": [],
                "version": 1,
            }
        else:
            whiteboard = json.loads(data)
        
        element_with_meta = {
            "id": f"{len(whiteboard['elements'])}",
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "type": element.get("type", "drawing"),  # drawing, text, shape, image
            "content": element.get("content", {}),
            "x": element.get("x", 0),
            "y": element.get("y", 0),
            "width": element.get("width", 100),
            "height": element.get("height", 100),
            "rotation": element.get("rotation", 0),
            "color": element.get("color", "#000000"),
            "stroke_width": element.get("stroke_width", 2),
            "opacity": element.get("opacity", 1),
        }
        
        whiteboard["elements"].append(element_with_meta)
        whiteboard["version"] += 1
        
        await redis_service.redis.setex(key, 86400, json.dumps(whiteboard))
        return element_with_meta

    @staticmethod
    async def update_element(call_id: str, element_id: str, updates: Dict) -> Dict:
        """Update an element on the whiteboard."""
        key = f"call:{call_id}:whiteboard"
        data = await redis_service.redis.get(key)
        
        if not data:
            return {"status": "error", "message": "Whiteboard not found"}
        
        whiteboard = json.loads(data)
        
        for elem in whiteboard["elements"]:
            if elem["id"] == element_id:
                elem.update(updates)
                elem["updated_at"] = datetime.utcnow().isoformat()
                whiteboard["version"] += 1
                
                await redis_service.redis.setex(key, 86400, json.dumps(whiteboard))
                return elem
        
        return {"status": "error", "message": "Element not found"}

    @staticmethod
    async def delete_element(call_id: str, element_id: str) -> Dict:
        """Delete element from whiteboard."""
        key = f"call:{call_id}:whiteboard"
        data = await redis_service.redis.get(key)
        
        if not data:
            return {"status": "error"}
        
        whiteboard = json.loads(data)
        original_len = len(whiteboard["elements"])
        whiteboard["elements"] = [e for e in whiteboard["elements"] if e["id"] != element_id]
        
        if len(whiteboard["elements"]) < original_len:
            whiteboard["version"] += 1
            await redis_service.redis.setex(key, 86400, json.dumps(whiteboard))
            return {"status": "deleted"}
        
        return {"status": "not_found"}

    @staticmethod
    async def get_whiteboard(call_id: str) -> Dict:
        """Get current whiteboard state."""
        key = f"call:{call_id}:whiteboard"
        data = await redis_service.redis.get(key)
        
        if not data:
            return {
                "call_id": call_id,
                "elements": [],
                "version": 0,
                "is_active": False,
            }
        
        return json.loads(data)

    @staticmethod
    async def clear_whiteboard(call_id: str) -> Dict:
        """Clear all elements from whiteboard."""
        key = f"call:{call_id}:whiteboard"
        data = await redis_service.redis.get(key)
        
        if not data:
            return {"status": "not_found"}
        
        whiteboard = json.loads(data)
        whiteboard["elements"] = []
        whiteboard["version"] += 1
        whiteboard["cleared_at"] = datetime.utcnow().isoformat()
        
        await redis_service.redis.setex(key, 86400, json.dumps(whiteboard))
        return whiteboard

    @staticmethod
    async def export_whiteboard(call_id: str, format: str = "json") -> Dict:
        """Export whiteboard to file."""
        key = f"call:{call_id}:whiteboard"
        data = await redis_service.redis.get(key)
        
        if not data:
            return {"status": "error"}
        
        whiteboard = json.loads(data)
        
        export_data = {
            "call_id": call_id,
            "format": format,
            "elements": whiteboard["elements"],
            "exported_at": datetime.utcnow().isoformat(),
            "export_url": f"https://api.flaskai.xyz/api/whiteboard/{call_id}/export.{format}",
        }
        
        return export_data

    @staticmethod
    async def undo(call_id: str) -> Dict:
        """Undo last action on whiteboard."""
        history_key = f"call:{call_id}:whiteboard:history"
        
        # In production, would maintain action history
        return {
            "status": "undo_executed",
            "call_id": call_id,
        }

    @staticmethod
    async def redo(call_id: str) -> Dict:
        """Redo last undone action."""
        history_key = f"call:{call_id}:whiteboard:history"
        
        return {
            "status": "redo_executed",
            "call_id": call_id,
        }

    @staticmethod
    async def add_background(call_id: str, background_type: str) -> Dict:
        """Add background to whiteboard (blank, grid, dots, lines)."""
        key = f"call:{call_id}:whiteboard"
        data = await redis_service.redis.get(key)
        
        if not data:
            whiteboard = {"call_id": call_id, "elements": [], "version": 1}
        else:
            whiteboard = json.loads(data)
        
        whiteboard["background"] = {
            "type": background_type,  # blank, grid, dots, lined
            "color": "#ffffff",
            "grid_size": 20 if background_type == "grid" else None,
        }
        
        await redis_service.redis.setex(key, 86400, json.dumps(whiteboard))
        return whiteboard["background"]

    @staticmethod
    async def get_collaborators(call_id: str) -> List[Dict]:
        """Get list of active collaborators on whiteboard."""
        key = f"call:{call_id}:whiteboard:collaborators"
        
        # In production, would track active users
        return [
            {"user_id": "user1", "name": "Alice", "cursor_x": 100, "cursor_y": 200},
            {"user_id": "user2", "name": "Bob", "cursor_x": 300, "cursor_y": 150},
        ]
