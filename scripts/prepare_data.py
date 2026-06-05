#!/usr/bin/env python3
"""
Prepara les dades per a la visualització PR2.
- Llegeix el CSV de la PR1
- Calcula mètriques derivades
- Agrega fluxos i estadístiques per a D3
- Exporta JSON lleuger per al navegador
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT.parent / "PR1" / "Segona entrega" / "archive" / "bird_migration_with_origin_destination.csv"
OUT_DIR = ROOT / "data"

MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
# Agrupa coordenades en cel·les perquè el gruix del mapa reflecteixi volum (el CSV té origen/destí únics per fila).
FLOW_BIN_DEG = 45


def month_index(m: str) -> int:
    try:
        return MONTH_ORDER.index(m)
    except ValueError:
        return 0


def success_rate(series: pd.Series) -> float:
    return float((series == "Successful").mean())


def sanitize_for_json(obj):
    """Converteix NaN/Inf a null perquè el navegador pugui parsejar el JSON."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, (np.floating, np.integer)):
        val = float(obj) if isinstance(obj, np.floating) else int(obj)
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
    if obj is None or (isinstance(obj, float) and pd.isna(obj)):
        return None
    if pd.isna(obj):
        return None
    return obj


def prepare(df: pd.DataFrame) -> dict:
    df = df.copy()
    df["Altitude_Range_m"] = df["Max_Altitude_m"] - df["Min_Altitude_m"]
    df["Distance_per_RestStop_km"] = df["Flight_Distance_km"] / df["Rest_Stops"].replace(0, 1)
    start_i = df["Migration_Start_Month"].map(month_index)
    end_i = df["Migration_End_Month"].map(month_index)
    df["Migration_Duration_months"] = (end_i - start_i + 12) % 12 + 1
    df["Migration_Success_binary"] = (df["Migration_Success"] == "Successful").astype(int)
    df["Migration_Interrupted_binary"] = (df["Migration_Interrupted"] == "Yes").astype(int)
    df["Nesting_Success_binary"] = (df["Nesting_Success"] == "Yes").astype(int)
    df["Migrated_in_Flock_binary"] = (df["Migrated_in_Flock"] == "Yes").astype(int)

    # Fluxos agregats per al mapa: cel·les de 45° (sinó cada trajecte és únic i count=1).
    df["flow_start_lat"] = (df["Start_Latitude"] / FLOW_BIN_DEG).round() * FLOW_BIN_DEG
    df["flow_start_lon"] = (df["Start_Longitude"] / FLOW_BIN_DEG).round() * FLOW_BIN_DEG
    df["flow_end_lat"] = (df["End_Latitude"] / FLOW_BIN_DEG).round() * FLOW_BIN_DEG
    df["flow_end_lon"] = (df["End_Longitude"] / FLOW_BIN_DEG).round() * FLOW_BIN_DEG

    flow = (
        df.groupby(
            ["Species", "flow_start_lat", "flow_start_lon", "flow_end_lat", "flow_end_lon"],
            as_index=False,
        )
        .agg(
            count=("Bird_ID", "count"),
            avg_distance=("Flight_Distance_km", "mean"),
            success_rate=("Migration_Success_binary", "mean"),
            interrupted_rate=("Migration_Interrupted_binary", "mean"),
            Region=("Region", lambda s: s.mode().iloc[0]),
            start_lat=("flow_start_lat", "first"),
            start_lon=("flow_start_lon", "first"),
            end_lat=("flow_end_lat", "first"),
            end_lon=("flow_end_lon", "first"),
        )
        .sort_values("count", ascending=False)
        .head(400)
    )

    routes_sample = (
        df[
            [
                "Bird_ID",
                "Species",
                "Region",
                "Habitat",
                "Weather_Condition",
                "Migration_Reason",
                "Start_Latitude",
                "Start_Longitude",
                "End_Latitude",
                "End_Longitude",
                "Flight_Distance_km",
                "Flight_Duration_hours",
                "Average_Speed_kmph",
                "Altitude_Range_m",
                "Migration_Success",
                "Migration_Interrupted",
                "Interrupted_Reason",
                "Nesting_Success",
                "Migrated_in_Flock",
                "Flock_Size",
                "Food_Supply_Level",
                "Rest_Stops",
                "Migration_Start_Month",
                "Migration_End_Month",
            ]
        ]
        .sample(n=min(800, len(df)), random_state=42)
        .replace({np.nan: None})
        .to_dict(orient="records")
    )

    def grouped_stats(group_cols: list[str]) -> list[dict]:
        g = (
            df.groupby(group_cols, as_index=False)
            .agg(
                n=("Bird_ID", "count"),
                avg_distance=("Flight_Distance_km", "mean"),
                avg_duration=("Flight_Duration_hours", "mean"),
                avg_speed=("Average_Speed_kmph", "mean"),
                avg_altitude_range=("Altitude_Range_m", "mean"),
                success_rate=("Migration_Success_binary", "mean"),
                interrupted_rate=("Migration_Interrupted_binary", "mean"),
                nesting_rate=("Nesting_Success_binary", "mean"),
            )
            .sort_values("n", ascending=False)
        )
        return g.to_dict(orient="records")

    temporal = (
        df.groupby(["Migration_Start_Month", "Species"], as_index=False)
        .agg(n=("Bird_ID", "count"), success_rate=("Migration_Success_binary", "mean"))
    )
    temporal["month_order"] = temporal["Migration_Start_Month"].map(
        lambda m: MONTH_ORDER.index(m) if m in MONTH_ORDER else 99
    )
    temporal = temporal.sort_values("month_order")

    summary = {
        "total_records": int(len(df)),
        "species": sorted(df["Species"].unique().tolist()),
        "regions": sorted(df["Region"].unique().tolist()),
        "habitats": sorted(df["Habitat"].unique().tolist()),
        "weather": sorted(df["Weather_Condition"].unique().tolist()),
        "overall_success_rate": float(df["Migration_Success_binary"].mean()),
        "overall_interrupted_rate": float(df["Migration_Interrupted_binary"].mean()),
    }

    return {
        "summary": summary,
        "flows": flow.to_dict(orient="records"),
        "routes_sample": routes_sample,
        "by_species_region": grouped_stats(["Species", "Region"]),
        "by_weather": grouped_stats(["Weather_Condition"]),
        "by_habitat_food": grouped_stats(["Habitat", "Food_Supply_Level"]),
        "by_flock": grouped_stats(["Migrated_in_Flock"]),
        "by_species_wind": grouped_stats(["Species", "Weather_Condition"]),
        "temporal": temporal.to_dict(orient="records"),
        "month_order": MONTH_ORDER,
    }


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"No s'ha trobat el CSV: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    payload = sanitize_for_json(prepare(df))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "migration_enriched.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, allow_nan=False)
    print(f"Exportat: {out_path} ({out_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
