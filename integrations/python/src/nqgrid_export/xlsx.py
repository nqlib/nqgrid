"""Write ``.xlsx`` with openpyxl from nqgrid's ``format=sheet`` JSON (``pivotModelToSheet``).

The Python-only Excel path, for teams that want to customise workbooks in Python (extra sheets,
charts, corporate styles). All pivot logic — grouping, subtotals, % of total, heat levels, number
formats — already happened in nqgrid core, so the numbers match the app; this module only paints.

    sheet = client.export(spec, rows, format="sheet")
    xlsx = write_xlsx_from_sheet(sheet, spec=spec)

For a workbook identical to the app's export (KPIs sheet, measured column widths), use
``format="xlsx"`` instead. Needs ``openpyxl`` (``pip install 'nqgrid-export-client[xlsx]'``).
"""

from __future__ import annotations

import io
import json
import math
import re
from collections.abc import Mapping, Sequence
from typing import Any, Literal

Theme = Literal["light", "dark"]

# Mirrors @nqlib/nqgrid styles / render-static (PIVOT_HEAT_BASE_COLOR, PIVOT_HEAT_MIX_PERCENT,
# PIVOT_STATIC_PALETTE) so Python fills match the Node XLSX and the PDF.
HEAT_BASE_COLOR = "#ef6a24"
HEAT_MIX_PERCENT = (7, 15, 24, 33, 42, 52, 62, 72, 82)
HEAT_STEPS = len(HEAT_MIX_PERCENT)
PALETTE: dict[Theme, dict[str, str]] = {
    "light": {
        "surface": "#ffffff",
        "muted": "#efeee9",
        "foreground": "#281d15",
        "mutedForeground": "#7e7167",
        "border": "#dcdbd7",
        "hairline": "#f1f1ef",
    },
    "dark": {
        "surface": "#171717",
        "muted": "#201f1f",
        "foreground": "#e4e4e4",
        "mutedForeground": "#a1a1a1",
        "border": "#3a3738",
        "hairline": "#252424",
    },
}


def _js_round(x: float) -> int:
    """``Math.round`` (half up), so colors match the TypeScript implementation exactly."""
    return math.floor(x + 0.5)


def _mix(top: str, bottom: str, alpha: float) -> str:
    a = [int(top[i : i + 2], 16) for i in (1, 3, 5)]
    b = [int(bottom[i : i + 2], 16) for i in (1, 3, 5)]
    t = min(1.0, max(0.0, alpha))
    return "#" + "".join(f"{_js_round(x * t + y * (1 - t)):02x}" for x, y in zip(a, b, strict=True))


def heat_step(level: int, levels: int) -> int:
    """Model heat level (``0 … levels-1``) → palette step ``0 … 8`` (``pivotHeatStep``)."""
    if levels <= 1:
        return 0
    return _js_round(min(levels - 1, max(0, level)) * (HEAT_STEPS - 1) / (levels - 1))


def heat_fill_hex(level: int, levels: int = 9, theme: Theme = "light") -> str:
    """Solid fill for a heat level (``pivotHeatLevelFillHex``), e.g. ``#fde9de`` for level 0 of 9."""
    step = heat_step(level, levels)
    return _mix(HEAT_BASE_COLOR, PALETTE[theme]["surface"], HEAT_MIX_PERCENT[step] / 100)


def xlsx_sheet_name(name: str | None, fallback: str = "Pivot") -> str:
    """Excel sheet names: ≤ 31 chars, none of ``[]:*?/\\``."""
    clean = re.sub(r"\s+", " ", re.sub(r"[\[\]:*?/\\]", " ", name or "")).strip()[:31]
    return clean or fallback


def write_xlsx_from_sheet(
    sheet: Mapping[str, Any],
    *,
    spec: Mapping[str, Any] | None = None,
    levels: int | None = None,
    theme: Theme = "light",
    sheet_name: str | None = None,
) -> bytes:
    """``PivotSheet`` JSON → ``.xlsx`` bytes.

    Keeps numeric values with their Excel ``numFmt``, merges, frozen panes, bold subtotals and heat
    levels (as solid fills). ``levels`` defaults to ``spec.heat.levels`` or 9. With ``spec``, a hidden
    ``Spec`` sheet records the spec JSON for traceability (like the Node exporter).
    """
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    palette = PALETTE[theme]
    argb = lambda hex_: "FF" + hex_.lstrip("#").upper()  # noqa: E731
    thin = lambda hex_: Side(style="thin", color=argb(hex_))  # noqa: E731
    solid = lambda hex_: PatternFill(fill_type="solid", start_color=argb(hex_), end_color=argb(hex_))  # noqa: E731

    heat = spec.get("heat") if spec else None
    n_levels = levels or (heat.get("levels") if isinstance(heat, Mapping) else None) or 9
    cells: Sequence[Sequence[Mapping[str, Any]]] = sheet["cells"]
    frozen_rows = int(sheet.get("frozenRows", 0))
    frozen_cols = int(sheet.get("frozenCols", 0))
    dim_cols = int(sheet.get("rowHeaderColumnCount", frozen_cols))
    column_count = int(sheet.get("columnCount", max((len(r) for r in cells), default=0)))

    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = xlsx_sheet_name(sheet_name or sheet.get("title"))
    wb.properties.creator = "nqgrid-export-client"
    if sheet.get("title"):
        wb.properties.title = str(sheet["title"])

    for r, row in enumerate(cells, start=1):
        for c, src in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c)
            value = src.get("v")
            if value is not None:
                cell.value = value
                if isinstance(value, str) and value.startswith("="):
                    cell.data_type = "s"  # data, never a formula (openpyxl treats "=…" as one)
            if src.get("numFmt") and isinstance(value, int | float):
                cell.number_format = src["numFmt"]
            role = src.get("role")
            is_dim = c <= dim_cols
            font_color = palette["foreground"]
            if role in ("header", "corner"):
                font_color = palette["mutedForeground"]
                cell.border = Border(bottom=thin(palette["border"]))
                cell.alignment = Alignment(vertical="center", horizontal="right" if role == "header" else "left")
            else:
                top = thin(palette["border"]) if role == "grandTotal" else Side()
                cell.border = Border(bottom=thin(palette["hairline"]), top=top)
                cell.alignment = Alignment(
                    vertical="top" if is_dim and role == "group" else "center", horizontal="left" if is_dim else "right"
                )
            cell.font = Font(name="Calibri", size=11, bold=bool(src.get("bold")), color=argb(font_color))
            if src.get("heat") is not None:
                cell.fill = solid(heat_fill_hex(int(src["heat"]), n_levels, theme))
            elif role in ("group", "grandTotal"):
                cell.fill = solid(palette["muted"])
        ws.row_dimensions[r].height = 20 if r <= frozen_rows else 18

    for m in sheet.get("merges", []):
        ws.merge_cells(
            start_row=m["row"] + 1,
            start_column=m["col"] + 1,
            end_row=m["row"] + m["rowSpan"],
            end_column=m["col"] + m["colSpan"],
        )
    if frozen_rows or frozen_cols:
        ws.freeze_panes = ws.cell(row=frozen_rows + 1, column=frozen_cols + 1)

    for c in range(column_count):
        if c < dim_cols:
            longest = max((len(str(row[c].get("v") or "")) for row in cells if c < len(row)), default=0)
            width = min(40, max(12, longest + 4))
        else:
            header = cells[frozen_rows - 1][c].get("v") if frozen_rows and c < len(cells[frozen_rows - 1]) else ""
            width = min(24, max(12, len(str(header or "")) + 3))
        ws.column_dimensions[get_column_letter(c + 1)].width = width

    if spec is not None:
        ss = wb.create_sheet("Spec")
        ss.sheet_state = "hidden"
        ss.append(["nqgrid · PivotSpec v1 (rebuild this workbook from the spec and the same rows)"])
        ss.append([])
        for line in json.dumps(spec, indent=2, ensure_ascii=False).split("\n"):
            ss.append([line])
        ss.column_dimensions["A"].width = 100

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
