"""Whiteboard router — collaborative drawing, shapes, persistence."""

from fastapi import APIRouter, Depends
from app.models.models import User
from app.dependencies import get_current_user
from app.services.whiteboard_service import WhiteboardService
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter()


class ElementRequest(BaseModel):
    call_id: str
    type: str  # drawing, text, shape, image
    content: Dict[str, Any]
    x: int
    y: int
    width: int = 100
    height: int = 100
    color: str = "#000000"
    stroke_width: int = 2


class ElementUpdateRequest(BaseModel):
    call_id: str
    element_id: str
    updates: Dict[str, Any]


class ClearWhiteboardRequest(BaseModel):
    call_id: str


# ─── Whiteboard CRUD ──────────────────────────────────────

@router.post("/create")
async def create_whiteboard(call_id: str, current_user: User = Depends(get_current_user)):
    """Create a new whiteboard for the call."""
    result = await WhiteboardService.create_whiteboard(call_id, current_user.id)
    return result


@router.get("/{call_id}")
async def get_whiteboard(call_id: str, current_user: User = Depends(get_current_user)):
    """Get current whiteboard state."""
    return await WhiteboardService.get_whiteboard(call_id)


# ─── Element Management ────────────────────────────────────

@router.post("/element/add")
async def add_element(req: ElementRequest, current_user: User = Depends(get_current_user)):
    """Add element (shape, text, drawing) to whiteboard."""
    element = await WhiteboardService.add_element(
        req.call_id,
        current_user.id,
        {
            "type": req.type,
            "content": req.content,
            "x": req.x,
            "y": req.y,
            "width": req.width,
            "height": req.height,
            "color": req.color,
            "stroke_width": req.stroke_width,
        },
    )
    return element


@router.post("/element/update")
async def update_element(req: ElementUpdateRequest, current_user: User = Depends(get_current_user)):
    """Update element on whiteboard."""
    result = await WhiteboardService.update_element(
        req.call_id, req.element_id, req.updates
    )
    return result


@router.delete("/{call_id}/element/{element_id}")
async def delete_element(call_id: str, element_id: str, current_user: User = Depends(get_current_user)):
    """Delete element from whiteboard."""
    return await WhiteboardService.delete_element(call_id, element_id)


# ─── Whiteboard Operations ────────────────────────────────

@router.post("/{call_id}/clear")
async def clear_whiteboard(call_id: str, current_user: User = Depends(get_current_user)):
    """Clear all elements from whiteboard."""
    return await WhiteboardService.clear_whiteboard(call_id)


@router.post("/{call_id}/undo")
async def undo(call_id: str, current_user: User = Depends(get_current_user)):
    """Undo last action."""
    return await WhiteboardService.undo(call_id)


@router.post("/{call_id}/redo")
async def redo(call_id: str, current_user: User = Depends(get_current_user)):
    """Redo last undone action."""
    return await WhiteboardService.redo(call_id)


# ─── Export & Persistence ────────────────────────────────

@router.post("/{call_id}/export")
async def export_whiteboard(call_id: str, format: str = "json", current_user: User = Depends(get_current_user)):
    """Export whiteboard to file."""
    return await WhiteboardService.export_whiteboard(call_id, format)


@router.get("/{call_id}/export/download")
async def download_export(call_id: str, format: str = "json", current_user: User = Depends(get_current_user)):
    """Download exported whiteboard file."""
    return {
        "call_id": call_id,
        "download_url": f"https://api.flaskai.xyz/api/whiteboard/{call_id}/whiteboard.{format}",
        "format": format,
        "expires_at": "2026-02-19T02:37:00Z",
    }


@router.post("/{call_id}/background")
async def set_background(call_id: str, background_type: str, current_user: User = Depends(get_current_user)):
    """Set whiteboard background (blank, grid, dots, lined)."""
    return await WhiteboardService.add_background(call_id, background_type)


# ─── Collaboration ────────────────────────────────────────

@router.get("/{call_id}/collaborators")
async def get_collaborators(call_id: str, current_user: User = Depends(get_current_user)):
    """Get list of active collaborators with cursor positions."""
    collaborators = await WhiteboardService.get_collaborators(call_id)
    return {"call_id": call_id, "collaborators": collaborators}


@router.post("/{call_id}/cursor")
async def update_cursor(
    call_id: str,
    x: int,
    y: int,
    current_user: User = Depends(get_current_user),
):
    """Update user's cursor position (for remote visibility)."""
    return {
        "call_id": call_id,
        "user_id": current_user.id,
        "cursor": {"x": x, "y": y},
        "status": "updated",
    }


# ─── Whiteboard Drawing Tools ────────────────────────────

@router.post("/tool/pen")
async def pen_tool(call_id: str, color: str = "#000000", width: int = 2, current_user: User = Depends(get_current_user)):
    """Select pen drawing tool."""
    return {
        "call_id": call_id,
        "tool": "pen",
        "color": color,
        "width": width,
        "cursor": "crosshair",
    }


@router.post("/tool/eraser")
async def eraser_tool(call_id: str, size: int = 10, current_user: User = Depends(get_current_user)):
    """Select eraser tool."""
    return {
        "call_id": call_id,
        "tool": "eraser",
        "size": size,
        "cursor": "cell",
    }


@router.post("/tool/shape")
async def shape_tool(call_id: str, shape_type: str = "rectangle", current_user: User = Depends(get_current_user)):
    """Select shape drawing tool (rectangle, circle, line, arrow)."""
    return {
        "call_id": call_id,
        "tool": "shape",
        "shape_type": shape_type,
        "cursor": "crosshair",
    }


@router.post("/tool/text")
async def text_tool(call_id: str, font_size: int = 14, current_user: User = Depends(get_current_user)):
    """Select text insertion tool."""
    return {
        "call_id": call_id,
        "tool": "text",
        "font_size": font_size,
        "cursor": "text",
    }


@router.post("/{call_id}/selection")
async def selection_tool(call_id: str, current_user: User = Depends(get_current_user)):
    """Enable selection/edit mode."""
    return {
        "call_id": call_id,
        "mode": "selection",
        "cursor": "pointer",
    }


# ─── Templates & Presets ──────────────────────────────────

@router.get("/templates")
async def get_templates(current_user: User = Depends(get_current_user)):
    """Get available whiteboard templates."""
    return {
        "templates": [
            {"id": "blank", "name": "Blank", "thumbnail": "blank.png"},
            {"id": "grid", "name": "Grid", "thumbnail": "grid.png"},
            {"id": "dots", "name": "Dots", "thumbnail": "dots.png"},
            {"id": "kanban", "name": "Kanban Board", "thumbnail": "kanban.png"},
        ]
    }


@router.post("/{call_id}/apply-template")
async def apply_template(call_id: str, template_id: str, current_user: User = Depends(get_current_user)):
    """Apply a template to whiteboard."""
    return {
        "call_id": call_id,
        "template_applied": template_id,
        "status": "applied",
    }
