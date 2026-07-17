from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from analytics import build_dashboard, get_metadata, get_quality  # noqa: E402


def main() -> None:
    meta = get_metadata()
    quality = get_quality()
    assert meta["years"] == [2021, 2022, 2023, 2024]
    checks = {item["label"]: item["value"] for item in quality["metrics"]}
    assert checks["Duplicados finales"] == 0
    assert checks["Valores negativos"] == 0
    assert checks["Diferencias por sexo"] == 0
    assert checks["Nulos territoriales"] == 0
    assert checks["Diferencia de conciliación"] == 0

    cases = [
        {"start_year": 2021, "end_year": 2024, "comparison_group": "provincia", "alert_group": "provincia", "filters": {}},
        {"start_year": 2022, "end_year": 2024, "comparison_group": "distrito", "alert_group": "distrito", "filters": {"province": "HUANCAYO"}},
        {"start_year": 2021, "end_year": 2023, "comparison_group": "ugel", "alert_group": "ugel", "filters": {"levels": ["Primaria"]}},
    ]
    for case in cases:
        result = build_dashboard(case)
        assert result["evolution"]["overall"]
        assert result["comparison"]["rows"]
        assert result["projection"]["forecast"]
        assert result["alerts"]["rows"]

    print("VALIDACIÓN APROBADA")
    print(f"Registros históricos: {checks['Registros históricos']}")
    print(f"Registros resumidos: {checks['Registros resumidos']}")
    print(f"Servicios educativos: {checks['Servicios educativos']}")
    print("Comparaciones, proyecciones y alertas: correctas")


if __name__ == "__main__":
    main()
