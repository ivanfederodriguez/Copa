import time
import os
import mysql.connector
import pandas as pd
from datetime import datetime
from mysql.connector import Error

# DB Configuration from Environment Variables
DB_CONFIG = {
    'user': os.getenv('DB_USER', 'estadistica'),
    'host': os.getenv('DB_HOST', '54.94.131.196'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_DATABASE', 'datalake_economico'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'connect_timeout': 20  # Increased timeout
}

def get_connection(max_retries=3):
    retry_count = 0
    while retry_count < max_retries:
        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            if conn.is_connected():
                return conn
        except Error as e:
            print(f"Connection attempt {retry_count + 1} failed: {e}")
            retry_count += 1
            if retry_count < max_retries:
                print("Retrying in 5 seconds...")
                time.sleep(5)
            else:
                print("Max retries reached. Exiting.")
                raise e

def fetch_data():
    query = """
    SELECT 
        anio, 
        mes, 
        jurisdiccion, 
        liquidacion, 
        total_gral, 
        importe_gral 
    FROM plantilla_personal_provincia
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
        if 'cursor' in locals():
            cursor.close()
        conn.close()

def fetch_ipc_region5():
    # Fetch IPC data for Region 5 (NEA), Category 1 (General), Division 1
    # User requested region 5 for the dashboard charts
    query = """
    SELECT 
        YEAR(fecha) as anio, 
        MONTH(fecha) as mes, 
        valor as ipc_valor_nea,
        var_mensual as ipc_var_mensual_nea
    FROM ipc_valores
    WHERE id_region = 5 AND id_categoria = 1 AND id_division = 1
    ORDER BY fecha
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
        if 'cursor' in locals():
            cursor.close()
        conn.close()

def fetch_ripte():
    query = "SELECT YEAR(fecha) as anio, MONTH(fecha) as mes, valor as ripte_valor FROM ripte ORDER BY fecha"
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query)
        columns = [col[0] for col in cursor.description]
        data = cursor.fetchall()
        df = pd.DataFrame(data, columns=columns)
        # Calculate monthly variation for RIPTE
        df['ripte_var_mensual'] = df['ripte_valor'].pct_change()
        return df
    finally:
        if 'cursor' in locals():
            cursor.close()
        conn.close()

def process_data(df_personnel, df_ipc_nea, df_ripte):
    # --- Personnel Data Processing ---
    df_personnel['total_gral'] = pd.to_numeric(df_personnel['total_gral'], errors='coerce').fillna(0)
    df_personnel['importe_gral'] = pd.to_numeric(df_personnel['importe_gral'], errors='coerce').fillna(0)
    
    # 1. Total Wage Bill: Sum EVERYTHING (including SAC) as requested by user
    # "When we talk about wage mass, we must include everything that is paid"
    masa_salarial_total = df_personnel.groupby(['anio', 'mes'])['importe_gral'].sum().reset_index()
    masa_salarial_total.rename(columns={'importe_gral': 'masa_salarial'}, inplace=True)

    # 2. Filter out SAC for Average Salary calculation
    # "For average salary analysis, we should NOT include SAC, sac, S.A.C or s.a.c."
    sac_terms = r'SAC|S\.A\.C|sac|s\.a\.c'
    df_no_sac = df_personnel[~df_personnel['liquidacion'].str.contains(sac_terms, case=False, na=False)].copy()
    
    # 3. Employee Count: from sueldo rows (excluding SAC)
    df_empleados = df_no_sac[df_no_sac['liquidacion'].str.contains('sueldo', case=False, na=False)].copy()
    empleados_grouped = df_empleados.groupby(['anio', 'mes'])['total_gral'].sum().reset_index()
    empleados_grouped.rename(columns={'total_gral': 'cantidad_empleados'}, inplace=True)
    
    # 4. Wage amount for Average Salary: exclude SAC
    masa_sin_sac = df_no_sac.groupby(['anio', 'mes'])['importe_gral'].sum().reset_index()
    masa_sin_sac.rename(columns={'importe_gral': 'masa_sin_sac'}, inplace=True)
    
    # Merge Measures
    df_dashboard = pd.merge(empleados_grouped, masa_salarial_total, on=['anio', 'mes'], how='outer')
    df_dashboard = pd.merge(df_dashboard, masa_sin_sac, on=['anio', 'mes'], how='outer')
    
    # Calculate Average Salary using masa_sin_sac (without SAC)
    df_dashboard['salario_promedio'] = df_dashboard['masa_sin_sac'] / df_dashboard['cantidad_empleados']
    
    # Merge External Data
    df_dashboard = pd.merge(df_dashboard, df_ipc_nea, on=['anio', 'mes'], how='left')
    df_dashboard = pd.merge(df_dashboard, df_ripte, on=['anio', 'mes'], how='left')
    
    # --- ESTIMADO ENERO 2026 ---
    # User requested: IPC estimate 1.86% for Jan 2026 if not present
    # Check if Jan 2026 exists
    mask_jan_26 = (df_dashboard['anio'] == 2026) & (df_dashboard['mes'] == 1)
    if not df_dashboard.loc[mask_jan_26].empty:
        # If row exists but IPC is NaN (likely), fill it
        # We need the previous IPC value to calculate the index change or just force the monthly var
        # Just creating a column for 'ipc_var_mensual_final' merging official and estimate
        pass
    else:
        # If it doesn't exist, we can't create data out of thin air for personnel unless we have it.
        # Assuming we HAVE personnel data for Jan 2026 from the DB.
        pass

    # Calculations
    df_dashboard.sort_values(by=['anio', 'mes'], inplace=True)
    
    # 1. Monthly Variations
    df_dashboard['salario_var_mensual'] = df_dashboard['salario_promedio'].pct_change()
    
    # --- JAN 2026 IPC ---
    # Using official data from DB as requested by user.

    # 2. Interannual Variations
    df_dashboard['salario_promedio_lag12'] = df_dashboard['salario_promedio'].shift(12)
    df_dashboard['ipc_valor_nea_lag12'] = df_dashboard['ipc_valor_nea'].shift(12)
    
    # Variations
    df_dashboard['var_nominal_ia'] = (df_dashboard['salario_promedio'] / df_dashboard['salario_promedio_lag12']) - 1
    df_dashboard['var_ipc_ia'] = (df_dashboard['ipc_valor_nea'] / df_dashboard['ipc_valor_nea_lag12']) - 1
    
    # Real Variation
    df_dashboard['var_real_ia'] = ((1 + df_dashboard['var_nominal_ia']) / (1 + df_dashboard['var_ipc_ia'])) - 1

    return df_dashboard

import json

def generate_json(df):
    MONTH_NAMES = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
        7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    }

    # Get last valid month (based on Salary data availability)
    last_row = df[df['salario_promedio'].notna()].iloc[-1]
    
    # CBT Analysis
    CBT_JAN_2026 = 376248
    salario_avg = last_row['salario_promedio']
    
    # Calculate CBT ratio (How many CBTs per average salary)
    cbt_ratio = salario_avg / CBT_JAN_2026
    
    # Period strings
    current_period = f"{MONTH_NAMES[int(last_row['mes'])]} {int(last_row['anio'])}"
    
    # Get previous year row for same month
    prev_series = df[(df['anio'] == int(last_row['anio']) - 1) & (df['mes'] == int(last_row['mes']))]
    prev_period = "Año Anterior"
    if not prev_series.empty:
        prev_period = f"{MONTH_NAMES[int(prev_series.iloc[0]['mes'])]} {int(prev_series.iloc[0]['anio'])}"

    kpis = {
        "salario_promedio": salario_avg,
        "masa_salarial": last_row['masa_salarial'] / 1_000_000,
        "empleados": last_row['cantidad_empleados'],
        "var_nominal_ia": last_row['var_nominal_ia'] * 100 if pd.notna(last_row['var_nominal_ia']) else 0,
        "var_real_ia": last_row['var_real_ia'] * 100 if pd.notna(last_row['var_real_ia']) else 0,
        "mes": int(last_row['mes']),
        "anio": int(last_row['anio']),
        "periodo_actual": current_period,
        "periodo_anterior": prev_period,
        "cbt_valor": CBT_JAN_2026,
        "cbt_ratio": cbt_ratio
    }
    
    # Charts: Ensure we take the last 12 months based on Salary Data (Primary)
    # Even if RIPTE is missing for last months, we keep the rows.
    df_last12 = df[df['salario_promedio'].notna()].tail(12)
    
    # Replace NaN RIPTE with None for JSON (Chart.js handles nulls better than 0 for lines)
    ripte_values = [x if pd.notna(x) else None for x in df_last12['ripte_valor'].tolist()]

    charts = {
        "labels": df_last12.apply(lambda x: f"{MONTH_NAMES[int(x['mes'])]}", axis=1).tolist(),
        "salario_promedio": df_last12['salario_promedio'].tolist(),
        "ripte_valor": ripte_values,
        "salario_var_mensual": (df_last12['salario_var_mensual'] * 100).fillna(0).tolist(),
        "ipc_var_mensual": (df_last12['ipc_var_mensual_nea'] * 100).fillna(0).tolist()
    }
    
    final_data = {"kpi": kpis, "charts": charts}
    
    # Save to the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, 'dashboard_data.json')
    
    with open(output_path, 'w') as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)
    print(f"Generated {output_path} with CBT & IPC Estimates")

def main():
    print("Fetching Personnel Data...")
    df_personnel = fetch_data() # Reuse existing function for raw data
    
    print("Fetching IPC NEA Data...")
    df_ipc = fetch_ipc_region5()
    
    print("Fetching RIPTE Data...")
    df_ripte = fetch_ripte()
    
    print("Processing Dashboard Data...")
    df_dashboard = process_data(df_personnel, df_ipc, df_ripte)
    
    generate_json(df_dashboard)


if __name__ == "__main__":
    main()
