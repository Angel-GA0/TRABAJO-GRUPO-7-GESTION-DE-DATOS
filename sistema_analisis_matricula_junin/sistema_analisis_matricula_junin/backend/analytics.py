from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent / "data"
YEARS = [2021, 2022, 2023, 2024]
MEASURES = ["total_estudiantes", "mujeres", "hombres", "retirados", "total_atraso"]


def _read_csv(path: Path, dtype: dict[str, str] | None = None) -> pd.DataFrame:
    # Excel in Spanish locales often exports a semicolon-delimited UTF-8 CSV.
    sample = path.read_text(encoding="utf-8-sig", errors="replace")[:4096]
    sep = ";" if sample.count(";") > sample.count(",") else ","
    return pd.read_csv(path, sep=sep, encoding="utf-8-sig", dtype=dtype)


@lru_cache(maxsize=1)
def load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    historical = _read_csv(
        DATA_DIR / "base_historica_junin.csv",
        dtype={"id_servicio": "string", "cod_mod": "string", "anexo": "string"},
    )
    summary = _read_csv(DATA_DIR / "base_resumida_junin.csv")

    for frame in (historical, summary):
        frame["anio"] = pd.to_numeric(frame["anio"], errors="coerce").astype("Int64")
        for col in MEASURES:
            frame[col] = pd.to_numeric(frame[col], errors="coerce").fillna(0).astype(float)

    historical["cod_mod"] = historical["cod_mod"].astype("string").str.zfill(7)
    historical["anexo"] = historical["anexo"].astype("string")
    historical["id_servicio"] = historical["id_servicio"].astype("string")
    return historical, summary


def _safe_pct(new: float, old: float) -> float | None:
    if old == 0 or pd.isna(old):
        return None
    return float((new - old) / old * 100)


def _safe_rate(part: float, total: float) -> float:
    return float(part / total * 100) if total else 0.0


def _round(value: Any, digits: int = 2) -> Any:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return round(float(value), digits)
    return value


def apply_filters(df: pd.DataFrame, filters: dict[str, Any]) -> pd.DataFrame:
    out = df.copy()
    mapping = {
        "province": "provincia",
        "district": "distrito",
        "ugel": "ugel",
    }
    for key, column in mapping.items():
        value = filters.get(key)
        if value and value != "Todos":
            out = out[out[column] == value]

    multi_mapping = {
        "levels": "nivel_agrupado",
        "managements": "gestion",
        "areas": "area",
    }
    for key, column in multi_mapping.items():
        values = filters.get(key) or []
        if values:
            out = out[out[column].isin(values)]
    return out


def yearly_totals(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby("anio", as_index=False)[MEASURES].sum()
    return grouped.sort_values("anio")


def _linear_predict(years: Iterable[int], values: Iterable[float], target_years: Iterable[int]) -> np.ndarray:
    x = np.asarray(list(years), dtype=float)
    y = np.asarray(list(values), dtype=float)
    targets = np.asarray(list(target_years), dtype=float)
    if len(x) < 2 or np.allclose(y, y[0]):
        return np.repeat(y[-1] if len(y) else 0.0, len(targets))
    slope, intercept = np.polyfit(x, y, 1)
    return slope * targets + intercept


def _average_change_predict(years: Iterable[int], values: Iterable[float], target_years: Iterable[int]) -> np.ndarray:
    x = list(years)
    y = np.asarray(list(values), dtype=float)
    targets = list(target_years)
    if len(y) < 2:
        return np.repeat(y[-1] if len(y) else 0.0, len(targets))
    avg_change = float(np.diff(y).mean())
    last_year = int(x[-1])
    last_value = float(y[-1])
    return np.asarray([last_value + avg_change * (int(t) - last_year) for t in targets])


def project_series(series: pd.DataFrame) -> dict[str, Any]:
    work = series[["anio", "total_estudiantes"]].dropna().sort_values("anio")
    years = work["anio"].astype(int).tolist()
    values = work["total_estudiantes"].astype(float).tolist()

    if len(years) < 2:
        observed = [{"year": int(y), "value": _round(v, 0)} for y, v in zip(years, values)]
        return {
            "observed": observed,
            "forecast": [],
            "model": "Datos insuficientes",
            "backtest": None,
            "sensitivity": [],
        }

    # Retrospective validation: use data up to 2023 to estimate 2024.
    train_years = years[:-1]
    train_values = values[:-1]
    actual_last = values[-1]
    last_year = years[-1]

    candidates: dict[str, float] = {}
    if len(train_years) >= 2:
        candidates["Tendencia lineal"] = float(_linear_predict(train_years, train_values, [last_year])[0])
        candidates["Cambio medio anual"] = float(_average_change_predict(train_years, train_values, [last_year])[0])
    else:
        candidates["Cambio medio anual"] = float(train_values[-1])

    errors = {name: abs(pred - actual_last) for name, pred in candidates.items()}
    selected_model = min(errors, key=errors.get)

    targets = [2025, 2026]
    linear_forecast = _linear_predict(years, values, targets)
    average_forecast = _average_change_predict(years, values, targets)
    selected_forecast = linear_forecast if selected_model == "Tendencia lineal" else average_forecast

    # Sensitivity band combines model disagreement and retrospective error.
    retrospective_error = float(errors[selected_model])
    lower = np.minimum(linear_forecast, average_forecast) - retrospective_error
    upper = np.maximum(linear_forecast, average_forecast) + retrospective_error
    lower = np.maximum(lower, 0)
    selected_forecast = np.maximum(selected_forecast, 0)

    observed = [{"year": int(y), "value": _round(v, 0)} for y, v in zip(years, values)]
    forecast = [
        {
            "year": int(year),
            "value": _round(value, 0),
            "lower": _round(low, 0),
            "upper": _round(high, 0),
        }
        for year, value, low, high in zip(targets, selected_forecast, lower, upper)
    ]
    error_pct = _safe_pct(candidates[selected_model], actual_last)
    return {
        "observed": observed,
        "forecast": forecast,
        "model": selected_model,
        "backtest": {
            "train_period": f"{train_years[0]}–{train_years[-1]}",
            "estimated_year": int(last_year),
            "estimated_value": _round(candidates[selected_model], 0),
            "actual_value": _round(actual_last, 0),
            "absolute_error": _round(retrospective_error, 0),
            "percentage_error": _round(abs(error_pct) if error_pct is not None else None, 2),
        },
        "alternatives": {
            "linear_2025": _round(linear_forecast[0], 0),
            "linear_2026": _round(linear_forecast[1], 0),
            "average_2025": _round(average_forecast[0], 0),
            "average_2026": _round(average_forecast[1], 0),
        },
    }


def _context_label(filters: dict[str, Any]) -> str:
    parts: list[str] = []
    if filters.get("province"):
        parts.append(f"Provincia de {str(filters['province']).title()}")
    if filters.get("district"):
        parts.append(f"Distrito de {str(filters['district']).title()}")
    if filters.get("ugel"):
        parts.append(str(filters["ugel"]).title())
    levels = filters.get("levels") or []
    if levels:
        parts.append(" / ".join(levels))
    return " · ".join(parts) if parts else "Departamento de Junín"


def build_summary(df: pd.DataFrame, start_year: int, end_year: int, projection: dict[str, Any], alerts: list[dict[str, Any]], filters: dict[str, Any]) -> dict[str, Any]:
    totals = yearly_totals(df)
    year_map = totals.set_index("anio")["total_estudiantes"].to_dict()
    start = float(year_map.get(start_year, 0))
    end = float(year_map.get(end_year, 0))
    abs_change = end - start
    pct_change = _safe_pct(end, start)
    year_gap = max(end_year - start_year, 1)
    avg_annual = abs_change / year_gap

    forecast_map = {item["year"]: item["value"] for item in projection.get("forecast", [])}
    attention = sum(1 for row in alerts if row["classification"] in {"Atención prioritaria", "Seguimiento"})
    growth = sum(1 for row in alerts if row["classification"] == "Demanda creciente")

    if pct_change is None:
        direction = "sin comparación válida"
    elif pct_change > 0.5:
        direction = "aumentó"
    elif pct_change < -0.5:
        direction = "disminuyó"
    else:
        direction = "se mantuvo relativamente estable"

    narrative = [
        f"Entre {start_year} y {end_year}, la matrícula del ámbito seleccionado {direction} en {format(abs(int(round(abs_change))), ',').replace(',', ' ')} estudiantes ({abs(pct_change or 0):.2f} %).",
    ]
    if forecast_map:
        narrative.append(
            f"La proyección tendencial referencial estima {format(int(forecast_map.get(2025, 0)), ',').replace(',', ' ')} estudiantes para 2025 y {format(int(forecast_map.get(2026, 0)), ',').replace(',', ' ')} para 2026; estos valores expresan continuidad estadística, no una predicción exacta."
        )
    if attention:
        narrative.append(f"Se identificaron {attention} ámbitos territoriales con señales que justifican revisión prioritaria o seguimiento.")
    if growth:
        narrative.append(f"También se detectaron {growth} ámbitos con señales de demanda creciente que podrían requerir anticipación de capacidad educativa.")

    return {
        "context": _context_label(filters),
        "start_year": start_year,
        "end_year": end_year,
        "start_total": _round(start, 0),
        "end_total": _round(end, 0),
        "absolute_change": _round(abs_change, 0),
        "percentage_change": _round(pct_change, 2),
        "average_annual_change": _round(avg_annual, 0),
        "forecast_2025": forecast_map.get(2025),
        "forecast_2026": forecast_map.get(2026),
        "attention_count": attention,
        "growth_count": growth,
        "narrative": narrative,
    }


def build_evolution(df: pd.DataFrame) -> dict[str, Any]:
    overall = yearly_totals(df)
    total = [
        {
            "year": int(row.anio),
            "enrollment": _round(row.total_estudiantes, 0),
            "women": _round(row.mujeres, 0),
            "men": _round(row.hombres, 0),
            "retired": _round(row.retirados, 0),
            "delay": _round(row.total_atraso, 0),
            "delay_rate": _round(_safe_rate(row.total_atraso, row.total_estudiantes), 3),
            "retirement_rate": _round(_safe_rate(row.retirados, row.total_estudiantes), 3),
        }
        for row in overall.itertuples(index=False)
    ]

    levels: dict[str, list[dict[str, Any]]] = {}
    grouped = df.groupby(["anio", "nivel_agrupado"], as_index=False)[MEASURES].sum()
    for level, part in grouped.groupby("nivel_agrupado"):
        levels[str(level)] = [
            {
                "year": int(row.anio),
                "enrollment": _round(row.total_estudiantes, 0),
                "delay_rate": _round(_safe_rate(row.total_atraso, row.total_estudiantes), 3),
                "retirement_rate": _round(_safe_rate(row.retirados, row.total_estudiantes), 3),
            }
            for row in part.sort_values("anio").itertuples(index=False)
        ]
    return {"overall": total, "levels": levels}


def _group_name(group_by: str) -> str:
    allowed = {"provincia", "distrito", "ugel", "nivel_agrupado", "gestion", "area"}
    return group_by if group_by in allowed else "provincia"


def build_comparison(df: pd.DataFrame, start_year: int, end_year: int, group_by: str) -> dict[str, Any]:
    group_by = _group_name(group_by)
    grouped = df.groupby([group_by, "anio"], as_index=False)[MEASURES].sum()
    pivot = grouped.pivot(index=group_by, columns="anio", values=MEASURES).fillna(0)

    rows: list[dict[str, Any]] = []
    for territory in pivot.index:
        def val(measure: str, year: int) -> float:
            try:
                return float(pivot.loc[territory, (measure, year)])
            except KeyError:
                return 0.0

        start = val("total_estudiantes", start_year)
        end = val("total_estudiantes", end_year)
        change = end - start
        pct = _safe_pct(end, start)
        delay_start = _safe_rate(val("total_atraso", start_year), start)
        delay_end = _safe_rate(val("total_atraso", end_year), end)
        retirement_start = _safe_rate(val("retirados", start_year), start)
        retirement_end = _safe_rate(val("retirados", end_year), end)
        trend = "Aumento" if (pct or 0) > 0.5 else "Disminución" if (pct or 0) < -0.5 else "Estabilidad"
        rows.append({
            "territory": str(territory),
            "start": _round(start, 0),
            "end": _round(end, 0),
            "absolute_change": _round(change, 0),
            "percentage_change": _round(pct, 2),
            "average_annual_change": _round(change / max(end_year - start_year, 1), 0),
            "delay_rate_start": _round(delay_start, 3),
            "delay_rate_end": _round(delay_end, 3),
            "delay_rate_change_pp": _round(delay_end - delay_start, 3),
            "retirement_rate_change_pp": _round(retirement_end - retirement_start, 3),
            "trend": trend,
        })

    rows.sort(key=lambda r: (r["percentage_change"] if r["percentage_change"] is not None else -999), reverse=True)
    declines = sorted([r for r in rows if (r["percentage_change"] or 0) < 0], key=lambda r: r["percentage_change"])[:10]
    growth = sorted([r for r in rows if (r["percentage_change"] or 0) > 0], key=lambda r: r["percentage_change"], reverse=True)[:10]

    transitions: list[dict[str, Any]] = []
    for territory, part in grouped.groupby(group_by):
        series = part.set_index("anio")["total_estudiantes"].to_dict()
        for y1, y2 in zip(YEARS[:-1], YEARS[1:]):
            transitions.append({
                "territory": str(territory),
                "period": f"{y1}–{y2}",
                "change_pct": _round(_safe_pct(float(series.get(y2, 0)), float(series.get(y1, 0))), 2),
            })

    return {
        "group_by": group_by,
        "rows": rows,
        "top_declines": declines,
        "top_growth": growth,
        "heatmap": transitions,
    }


def _territory_projection(part: pd.DataFrame) -> dict[str, Any]:
    series = yearly_totals(part)
    return project_series(series)


def build_alerts(df: pd.DataFrame, group_by: str, start_year: int, end_year: int) -> dict[str, Any]:
    group_by = _group_name(group_by)
    grouped = df.groupby([group_by, "anio"], as_index=False)[MEASURES].sum()
    base_rows: list[dict[str, Any]] = []

    for territory, part in grouped.groupby(group_by):
        part = part.sort_values("anio")
        index = part.set_index("anio")

        def get(year: int, col: str) -> float:
            return float(index.loc[year, col]) if year in index.index else 0.0

        start = get(start_year, "total_estudiantes")
        end = get(end_year, "total_estudiantes")
        pct = _safe_pct(end, start)
        recent = _safe_pct(get(2024, "total_estudiantes"), get(2023, "total_estudiantes"))
        annual_values = [get(year, "total_estudiantes") for year in YEARS]
        diffs = np.diff(annual_values)
        decline_periods = int(np.sum(diffs < 0))
        consecutive_last = 0
        for diff in diffs[::-1]:
            if diff < 0:
                consecutive_last += 1
            else:
                break

        delay_start = _safe_rate(get(start_year, "total_atraso"), start)
        delay_end = _safe_rate(get(end_year, "total_atraso"), end)
        retire_start = _safe_rate(get(start_year, "retirados"), start)
        retire_end = _safe_rate(get(end_year, "retirados"), end)
        projection = _territory_projection(part)
        forecast_2026 = next((item["value"] for item in projection.get("forecast", []) if item["year"] == 2026), None)
        projected_pct = _safe_pct(float(forecast_2026 or end), get(2024, "total_estudiantes"))
        base_rows.append({
            "territory": str(territory),
            "start_total": start,
            "end_total": end,
            "change_pct": pct,
            "recent_change_pct": recent,
            "decline_periods": decline_periods,
            "consecutive_recent_declines": consecutive_last,
            "delay_change_pp": delay_end - delay_start,
            "retirement_change_pp": retire_end - retire_start,
            "forecast_2026": forecast_2026,
            "projected_change_pct": projected_pct,
            "series": [{"year": y, "value": _round(v, 0)} for y, v in zip(YEARS, annual_values)],
        })

    def q(values: list[float], quantile: float, fallback: float = 0.0) -> float:
        clean = [v for v in values if v is not None and np.isfinite(v)]
        return float(np.quantile(clean, quantile)) if clean else fallback

    cumulative_values = [r["change_pct"] for r in base_rows if r["change_pct"] is not None]
    recent_values = [r["recent_change_pct"] for r in base_rows if r["recent_change_pct"] is not None]
    delay_values = [r["delay_change_pp"] for r in base_rows]
    retire_values = [r["retirement_change_pp"] for r in base_rows]

    thresholds = {
        "cumulative_low": q(cumulative_values, 0.25),
        "cumulative_high": q(cumulative_values, 0.75),
        "recent_low": q(recent_values, 0.25),
        "recent_high": q(recent_values, 0.75),
        "delay_high": q(delay_values, 0.75),
        "retirement_high": q(retire_values, 0.75),
    }

    rows: list[dict[str, Any]] = []
    for row in base_rows:
        attention_signals: list[str] = []
        growth_signals: list[str] = []

        if row["change_pct"] is not None and row["change_pct"] <= thresholds["cumulative_low"] and row["change_pct"] < 0:
            attention_signals.append(f"Disminución acumulada de {abs(row['change_pct']):.2f} %")
        if row["recent_change_pct"] is not None and row["recent_change_pct"] <= thresholds["recent_low"] and row["recent_change_pct"] < 0:
            attention_signals.append(f"Caída reciente de {abs(row['recent_change_pct']):.2f} %")
        if row["consecutive_recent_declines"] >= 2:
            attention_signals.append(f"{row['consecutive_recent_declines']} periodos consecutivos de disminución")
        if row["delay_change_pp"] >= thresholds["delay_high"] and row["delay_change_pp"] > 0:
            attention_signals.append(f"Aumento del atraso en {row['delay_change_pp']:.2f} puntos porcentuales")
        if row["retirement_change_pp"] >= thresholds["retirement_high"] and row["retirement_change_pp"] > 0:
            attention_signals.append(f"Aumento del retiro en {row['retirement_change_pp']:.2f} puntos porcentuales")
        if row["projected_change_pct"] is not None and row["projected_change_pct"] < 0:
            attention_signals.append(f"Proyección 2026 descendente ({row['projected_change_pct']:.2f} % frente a 2024)")

        if row["change_pct"] is not None and row["change_pct"] >= thresholds["cumulative_high"] and row["change_pct"] > 0:
            growth_signals.append(f"Crecimiento acumulado de {row['change_pct']:.2f} %")
        if row["recent_change_pct"] is not None and row["recent_change_pct"] >= thresholds["recent_high"] and row["recent_change_pct"] > 0:
            growth_signals.append(f"Crecimiento reciente de {row['recent_change_pct']:.2f} %")
        if row["projected_change_pct"] is not None and row["projected_change_pct"] > 0:
            growth_signals.append(f"Proyección 2026 ascendente ({row['projected_change_pct']:.2f} % frente a 2024)")

        if len(attention_signals) >= 3:
            classification = "Atención prioritaria"
            action = "Revisar captación de matrícula, permanencia escolar y factores territoriales; contrastar con información local antes de intervenir."
        elif attention_signals:
            classification = "Seguimiento"
            action = "Dar seguimiento al comportamiento y validar las señales con la UGEL o las instituciones del ámbito."
        elif growth_signals:
            classification = "Demanda creciente"
            action = "Anticipar posibles necesidades de capacidad y seguimiento de la demanda educativa."
        else:
            classification = "Comportamiento estable"
            action = "Mantener seguimiento regular y actualizar el análisis con nuevos periodos."

        rows.append({
            "territory": row["territory"],
            "classification": classification,
            "attention_signals": attention_signals,
            "growth_signals": growth_signals,
            "action": action,
            "start_total": _round(row["start_total"], 0),
            "end_total": _round(row["end_total"], 0),
            "change_pct": _round(row["change_pct"], 2),
            "recent_change_pct": _round(row["recent_change_pct"], 2),
            "delay_change_pp": _round(row["delay_change_pp"], 3),
            "retirement_change_pp": _round(row["retirement_change_pp"], 3),
            "forecast_2026": _round(row["forecast_2026"], 0),
            "projected_change_pct": _round(row["projected_change_pct"], 2),
            "series": row["series"],
            "signal_count": len(attention_signals),
        })

    priority_order = {"Atención prioritaria": 0, "Seguimiento": 1, "Demanda creciente": 2, "Comportamiento estable": 3}
    rows.sort(key=lambda r: (priority_order[r["classification"]], -r["signal_count"], r["change_pct"] if r["change_pct"] is not None else 0))
    return {
        "group_by": group_by,
        "thresholds": {k: _round(v, 3) for k, v in thresholds.items()},
        "rows": rows,
    }


def build_projection_by_level(df: pd.DataFrame) -> list[dict[str, Any]]:
    results = []
    for level, part in df.groupby("nivel_agrupado"):
        projection = project_series(yearly_totals(part))
        results.append({"level": str(level), **projection})
    return results


def get_metadata() -> dict[str, Any]:
    _, df = load_data()
    districts_by_province = {
        str(province): sorted(part["distrito"].dropna().astype(str).unique().tolist())
        for province, part in df.groupby("provincia")
    }
    ugels_by_province = {
        str(province): sorted(part["ugel"].dropna().astype(str).unique().tolist())
        for province, part in df.groupby("provincia")
    }
    return {
        "years": YEARS,
        "provinces": sorted(df["provincia"].dropna().astype(str).unique().tolist()),
        "districts_by_province": districts_by_province,
        "ugels": sorted(df["ugel"].dropna().astype(str).unique().tolist()),
        "ugels_by_province": ugels_by_province,
        "levels": [x for x in ["Inicial", "Primaria", "Secundaria"] if x in df["nivel_agrupado"].unique()],
        "managements": sorted(df["gestion"].dropna().astype(str).unique().tolist()),
        "areas": sorted(df["area"].dropna().astype(str).unique().tolist()),
        "comparison_groups": [
            {"value": "provincia", "label": "Provincias"},
            {"value": "distrito", "label": "Distritos"},
            {"value": "ugel", "label": "UGEL"},
            {"value": "nivel_agrupado", "label": "Niveles educativos"},
            {"value": "gestion", "label": "Tipo de gestión"},
            {"value": "area", "label": "Área urbana o rural"},
        ],
    }


def get_quality() -> dict[str, Any]:
    historical, summary = load_data()
    historical_dupes = int(historical.duplicated(["anio", "id_servicio", "nivel_agrupado", "gestion"]).sum())
    summary_dupes = int(summary.duplicated(["anio", "provincia", "distrito", "ugel", "nivel_agrupado", "gestion", "area"]).sum())
    negatives = int((historical[MEASURES] < 0).sum().sum())
    sex_diff = int((historical["mujeres"] + historical["hombres"] != historical["total_estudiantes"]).sum())
    territorial_nulls = int(historical[["departamento", "provincia", "distrito", "ugel", "area"]].isna().sum().sum())

    hist_totals = historical.groupby("anio")[MEASURES].sum().sort_index()
    sum_totals = summary.groupby("anio")[MEASURES].sum().sort_index()
    reconciliation_diff = float((hist_totals - sum_totals).abs().sum().sum())

    return {
        "metrics": [
            {"label": "Registros históricos", "value": int(len(historical)), "status": "ok"},
            {"label": "Registros resumidos", "value": int(len(summary)), "status": "ok"},
            {"label": "Servicios educativos", "value": int(historical["id_servicio"].nunique()), "status": "ok"},
            {"label": "Años integrados", "value": int(historical["anio"].nunique()), "status": "ok"},
            {"label": "Duplicados finales", "value": historical_dupes + summary_dupes, "status": "ok" if historical_dupes + summary_dupes == 0 else "warn"},
            {"label": "Valores negativos", "value": negatives, "status": "ok" if negatives == 0 else "warn"},
            {"label": "Diferencias por sexo", "value": sex_diff, "status": "ok" if sex_diff == 0 else "warn"},
            {"label": "Nulos territoriales", "value": territorial_nulls, "status": "ok" if territorial_nulls == 0 else "warn"},
            {"label": "Diferencia de conciliación", "value": _round(reconciliation_diff, 0), "status": "ok" if reconciliation_diff == 0 else "warn"},
        ],
        "flow": [
            "Cuatro archivos de Matriculación y Trayectoria Estudiantil (2021–2024)",
            "Estandarización de nombres, tipos y claves",
            "Creación y validación de id_servicio",
            "Agrupación para evitar duplicidad de registros",
            "Integración histórica 2021–2024",
            "Cruce territorial con el Padrón de Servicios Educativos 2024",
            "Controles de duplicados, nulos, negativos y coherencia por sexo",
            "Generación de base histórica y base resumida conciliadas",
        ],
        "limitations": [
            "Las proyecciones 2025–2026 son tendenciales y referenciales; no representan una predicción exacta.",
            "La serie histórica contiene cuatro observaciones anuales, por lo que se priorizan métodos simples y explicables.",
            "El Padrón 2024 se utiliza para complementar la ubicación territorial de los servicios de todos los años.",
            "Las alertas son señales para revisión y no sustituyen el análisis cualitativo de la UGEL o la autoridad educativa.",
            "Los cambios de atraso y retiro describen asociaciones temporales; no demuestran causalidad.",
        ],
        "annual_totals": [
            {"year": int(year), **{m: _round(row[m], 0) for m in MEASURES}}
            for year, row in hist_totals.iterrows()
        ],
    }


def build_dashboard(payload: dict[str, Any]) -> dict[str, Any]:
    _, summary_df = load_data()
    filters = payload.get("filters") or {}
    start_year = int(payload.get("start_year", 2021))
    end_year = int(payload.get("end_year", 2024))
    if start_year >= end_year:
        start_year, end_year = min(start_year, end_year), max(start_year, end_year)
        if start_year == end_year:
            start_year, end_year = 2021, 2024
    comparison_group = payload.get("comparison_group", "provincia")
    alert_group = payload.get("alert_group", comparison_group)

    filtered = apply_filters(summary_df, filters)
    evolution = build_evolution(filtered)
    projection = project_series(yearly_totals(filtered))
    comparison = build_comparison(filtered, start_year, end_year, comparison_group)
    alerts_data = build_alerts(filtered, alert_group, start_year, end_year)
    summary = build_summary(filtered, start_year, end_year, projection, alerts_data["rows"], filters)
    return {
        "summary": summary,
        "evolution": evolution,
        "comparison": comparison,
        "projection": projection,
        "projection_by_level": build_projection_by_level(filtered),
        "alerts": alerts_data,
    }
