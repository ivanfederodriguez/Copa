import os
import json
import mysql.connector
import pandas as pd
from datetime import datetime
import numpy as np

# DB Configuration from Environment Variables
DB_CONFIG = {
    'user': os.getenv('DB_USER', 'estadistica'),
    'host': os.getenv('DB_HOST', '54.94.131.196'),
    'password': os.getenv('DB_PASSWORD', 'Estadistica2024!!'),
    'database': os.getenv('DB_DATABASE', 'datalake_economico'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'connect_timeout': 20
}

def get_connection():
    return mysql.connector.connect(**DB_CONFIG)

def fetch_coparticipacion_daily():
    """
    Fetches daily coparticipation data for 2025 and 2026 from local CSV.
    Metric: CFI (Neta de Ley 26075) + Reg.Simplif. p/Pequenos Contribuyentes (Ley N.24.977) + Compensacion Consenso Fiscal (2)
    """
    csv_path = os.path.join(os.path.dirname(__file__), 'consolidado_copa.csv')
    
    # Read CSV
    df = pd.read_csv(csv_path)
    
    # Parse dates (DD/MM/YYYY)
    df['fecha'] = pd.to_datetime(df['Fecha'], format='%d/%m/%Y', errors='coerce')
    
    # Filter for 2022 onwards
    mask = (df['fecha'].dt.year >= 2022)
    df = df.loc[mask].copy()
    
    # Ensure numeric columns
    cols_to_sum = [
        'CFI (Neta de Ley 26075)', 
        'Reg.Simplif. p/Pequenos Contribuyentes (Ley N.24.977)', 
        'Compensacion Consenso Fiscal (2)'
    ]
    
    for col in cols_to_sum:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
    # Calculate recaudacion
    df['recaudacion'] = df[cols_to_sum].sum(axis=1)
    
    # Sort
    df = df.sort_values('fecha')
    
    # Add auxiliary columns
    df['day'] = df['fecha'].dt.day
    df['month'] = df['fecha'].dt.month
    df['year'] = df['fecha'].dt.year
    
    return df[['fecha', 'recaudacion', 'day', 'month', 'year']]

def fetch_masa_salarial():
    """
    Fetches monthly salary bill for 2025 and 2026.
    """
    query = """
    SELECT 
        anio, 
        mes, 
        importe_gral 
    FROM plantilla_personal_provincia
    WHERE anio IN (2025, 2026)
    """
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query)
        columns = [col[0] for col in cursor.description]
        data = cursor.fetchall()
        df = pd.DataFrame(data, columns=columns)
        
        # Group sum
        df['importe_gral'] = pd.to_numeric(df['importe_gral'], errors='coerce').fillna(0)
        grouped = df.groupby(['anio', 'mes'])['importe_gral'].sum().reset_index()
        grouped.rename(columns={'importe_gral': 'masa_salarial'}, inplace=True)
        return grouped
    finally:
        conn.close()

def fetch_ipc_nea():
    """
    Fetch IPC NEA General for 2025 and 2026.
    """
    query = """
    SELECT 
        YEAR(fecha) as anio, 
        MONTH(fecha) as mes, 
        valor as ipc_valor
    FROM ipc_valores
    WHERE id_region = 5 AND id_categoria = 1 AND id_division = 1
      AND YEAR(fecha) >= 2022
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query)
        columns = [col[0] for col in cursor.description]
        data = cursor.fetchall()
        df = pd.DataFrame(data, columns=columns)
        return df
    finally:
        conn.close()

import calendar

def process_data(df_daily, df_salary, df_ipc):
    # Determine available months in 2026
    # Converting to Python list of standard ints to avoid JSON serialization issues
    months_2026 = sorted(df_daily[df_daily['year'] == 2026]['month'].unique().astype(int).tolist())
    
    available_periods = []
    data_by_period = {}
    
    MONTH_NAMES = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
        7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    }

    # 1. Prepare Daily Data Template
    all_days = pd.DataFrame({'day': range(1, 32)})

    # Track completeness to find default
    default_period_id = None
    last_available_period_id = None

    for m in months_2026:
        month_label = MONTH_NAMES.get(m, str(m))
        period_id = f"2026-{m:02d}"
        last_available_period_id = period_id
        
        available_periods.append({
            "id": period_id,
            "label": month_label,
            "month": m
        })
        
        # --- Filter Data for this Month ---
        
        # Daily Data
        df_daily_25 = df_daily[(df_daily['year'] == 2025) & (df_daily['month'] == m)].copy()
        df_daily_26 = df_daily[(df_daily['year'] == 2026) & (df_daily['month'] == m)].copy()
        
        # Determine Completeness
        # Filter for non-zero revenue to find the REAL last day of data
        # (Since CSV has placeholders with 0.0 for the whole month)
        real_data_26 = df_daily_26[df_daily_26['recaudacion'] > 0]
        max_day_26 = real_data_26['day'].max() if not real_data_26.empty else 0
        is_complete = max_day_26 >= 28
        
        if is_complete:
            default_period_id = period_id
        
        daily_25 = pd.merge(all_days, df_daily_25[['day', 'recaudacion']], on='day', how='left').fillna(0)
        daily_26 = pd.merge(all_days, df_daily_26[['day', 'recaudacion']], on='day', how='left').fillna(0)
        
        # Aggregates (Recaudación)
        total_recaudacion_25 = df_daily_25['recaudacion'].sum()
        total_recaudacion_26 = df_daily_26['recaudacion'].sum()
        
        # Salary
        salary_25_row = df_salary[(df_salary['anio'] == 2025) & (df_salary['mes'] == m)]
        salary_26_row = df_salary[(df_salary['anio'] == 2026) & (df_salary['mes'] == m)]
        
        total_salary_25 = salary_25_row['masa_salarial'].values[0] if not salary_25_row.empty else 0
        total_salary_26 = salary_26_row['masa_salarial'].values[0] if not salary_26_row.empty else 0
        
        # IPC & Real Variation
        ipc_25_row = df_ipc[(df_ipc['anio'] == 2025) & (df_ipc['mes'] == m)]
        ipc_26_row = df_ipc[(df_ipc['anio'] == 2026) & (df_ipc['mes'] == m)]
        
        val_ipc_25 = ipc_25_row['ipc_valor'].values[0] if not ipc_25_row.empty else None
        val_ipc_26 = ipc_26_row['ipc_valor'].values[0] if not ipc_26_row.empty else None

        # Hack for Jan 2026 estimate if missing
        if m == 1 and val_ipc_26 is None:
             # Try fetching Dec 2025 for estimate
             conn = get_connection()
             cursor = conn.cursor()
             cursor.execute("SELECT valor FROM ipc_valores WHERE id_region=5 AND id_categoria=1 AND YEAR(fecha)=2025 AND MONTH(fecha)=12")
             dec_25_data = cursor.fetchone()
             conn.close()
             val_ipc_dec_25 = dec_25_data[0] if dec_25_data else None
             
             if val_ipc_dec_25 is not None:
                 val_ipc_26 = val_ipc_dec_25 * 1.0186

        var_ipc_ia = 0
        if val_ipc_25 and val_ipc_26:
            var_ipc_ia = (val_ipc_26 / val_ipc_25) - 1
            
        # Variations
        rec_var_nom = (total_recaudacion_26 / total_recaudacion_25 - 1) if total_recaudacion_25 > 0 else 0
        rec_var_real = ((1 + rec_var_nom) / (1 + var_ipc_ia) - 1) if (1 + var_ipc_ia) != 0 else 0
        
        sal_var_nom = (total_salary_26 / total_salary_25 - 1) if total_salary_25 > 0 else 0
        sal_var_real = ((1 + sal_var_nom) / (1 + var_ipc_ia) - 1) if (1 + var_ipc_ia) != 0 else 0
        
        cov_25 = (total_salary_25 / total_recaudacion_25) if total_recaudacion_25 > 0 else 0
        cov_26 = (total_salary_26 / total_recaudacion_26) if total_recaudacion_26 > 0 else 0
        
        # Build Data Object
        data_by_period[period_id] = {
            "kpi": {
                "recaudacion": {
                    "current": total_recaudacion_26 / 1_000_000,
                    "prev": total_recaudacion_25 / 1_000_000,
                    "var_nom": rec_var_nom * 100,
                    "var_real": rec_var_real * 100,
                    "diff_nom": (total_recaudacion_26 - total_recaudacion_25) / 1_000_000
                },
                "masa_salarial": {
                    "current": total_salary_26 / 1_000_000,
                    "prev": total_salary_25 / 1_000_000,
                    "var_nom": sal_var_nom * 100,
                    "var_real": sal_var_real * 100,
                    "diff_nom": (total_salary_26 - total_salary_25) / 1_000_000,
                    "cobertura_current": cov_26 * 100,
                    "cobertura_prev": cov_25 * 100
                },
                "meta": {
                    "periodo": f"{month_label} 2026",
                    "ipc_ia": var_ipc_ia * 100
                }
            },
            "charts": {
                "daily": {
                    "labels": all_days['day'].astype(str).tolist(),
                    "data_2025_nom": (daily_25['recaudacion'] / 1_000_000).tolist(),
                    "data_2026": (daily_26['recaudacion'] / 1_000_000).tolist(),
                }
            }
        }
        
    # If no complete period found, default to available latest
    if default_period_id is None:
        default_period_id = last_available_period_id

    # Final JSON Structure
    data = {
        "meta": {
            "available_periods": available_periods,
            "default_period_id": default_period_id
        },
        "data": data_by_period
    }
    
    return data

def process_annual_data(df_daily, df_ipc):
    """
    Process annual data for the last 4 COMPLETE years.
    Uses CURRENT/LATEST available IPC as base for Real values (Moneda Constante).
    """
    # 1. Identify valid years (having data)
    years = sorted(df_daily['year'].unique())
    
    # 2. Determine completeness per year
    complete_years = []
    for y in years:
        df_y = df_daily[df_daily['year'] == y]
        # Check if year has data for Dec 20-31? Or at least 11 months + some days?
        # Simplest: check max date in year.
        max_date = df_y['fecha'].max()
        if max_date.month == 12 and max_date.day >= 20: # Heuristic for complete year
            complete_years.append(y)
            
    # Select last 4 complete years
    if not complete_years:
        return {} # Should not happen given 2022-2024 are past
        
    # Get last 4
    target_years = complete_years[-4:]
    
    # 3. Calculate metrics for these years
    annual_metrics = []
    
    # Find Base IPC (Fixed: Jan 2022)
    ipc_base_row = df_ipc[(df_ipc['anio'] == 2022) & (df_ipc['mes'] == 1)]
    
    # If Jan 2022 not found, try to find the earliest available? 
    # Or just default 1 if missing for safety? 
    # Ideally should exist if we are processing 2022 data.
    if not ipc_base_row.empty:
        ipc_base_val = ipc_base_row['ipc_valor'].values[0]
    else:
        # Fallback to first available if 2022-01 missing
        ipc_base_val = df_ipc['ipc_valor'].iloc[0] if not df_ipc.empty else 100
        
    base_label = "Enero 2022"
    
    prev_nominal = None
    prev_real = None

    for y in target_years:
        # Aggregates
        df_y = df_daily[df_daily['year'] == y]
        nominal_total = df_y['recaudacion'].sum()
        
        # Real Total (Deflated to Base Period)
        real_total = 0
        for m in range(1, 13):
            month_rev = df_y[df_y['month'] == m]['recaudacion'].sum()
            
            ipc_m_row = df_ipc[(df_ipc['anio'] == y) & (df_ipc['mes'] == m)]
            ipc_m_val = ipc_m_row['ipc_valor'].values[0] if not ipc_m_row.empty else None
            
            if ipc_m_val and ipc_base_val:
                factor = ipc_base_val / ipc_m_val
                real_month = month_rev * factor
                real_total += real_month
            else:
                real_total += month_rev

        # Calculate Variations
        var_nom = None
        var_real = None
        
        if prev_nominal is not None and prev_nominal > 0:
            var_nom = (nominal_total / prev_nominal - 1) * 100
            
        if prev_real is not None and prev_real > 0:
            var_real = (real_total / prev_real - 1) * 100

        annual_metrics.append({
            "year": int(y),
            "nominal": nominal_total,
            "real": real_total,
            "var_nominal": var_nom,
            "var_real": var_real
        })
        
        prev_nominal = nominal_total
        prev_real = real_total
        
    return {
        "periods": annual_metrics,
        "meta": {
            "base_ipc": base_label,
            "years_included": [int(y) for y in target_years]
        }
    }

def main():
    print("Fetching Daily Coparticipation...")
    df_daily = fetch_coparticipacion_daily()
    
    print("Fetching Monthly Salary...")
    df_salary = fetch_masa_salarial()
    
    print("Fetching IPC Data...")
    df_ipc = fetch_ipc_nea()
    
    print("Processing Data...")
    json_data = process_data(df_daily, df_salary, df_ipc)
    
    print("Processing Annual Data...")
    annual_data = process_annual_data(df_daily, df_ipc)
    json_data["annual"] = annual_data
    
    output_path = os.path.join(os.path.dirname(__file__), 'dashboard_data.json')
    with open(output_path, 'w') as f:
        json.dump(json_data, f, indent=2)
        
    print(f"Data saved to {output_path}")

if __name__ == "__main__":
    main()
