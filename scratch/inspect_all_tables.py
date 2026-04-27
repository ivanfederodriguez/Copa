import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), '.env'))

def inspect_tables(dbname):
    print(f"\n--- Database: {dbname} ---")
    try:
        conn = psycopg2.connect(
            host=os.getenv('PG_HOST'),
            port=os.getenv('PG_PORT'),
            user=os.getenv('PG_USER'),
            password=os.getenv('PG_PASSWORD'),
            dbname=dbname
        )
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%recursos%' OR table_name LIKE '%copa%' OR table_name LIKE '%municip%')
        """)
        rows = cursor.fetchall()
        tables = [row[0] for row in rows]
        
        for table in tables:
            try:
                cursor.execute(f"SELECT * FROM {table} LIMIT 1")
                col_names = [desc[0] for desc in cursor.description]
                print(f"\nTable: {table}")
                print(f"Columns: {col_names}")
                row = cursor.fetchone()
                if row:
                    print(f"Sample: {row}")
            except Exception as e:
                print(f"Could not inspect {table}: {e}")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error connecting to {dbname}: {e}")

inspect_tables('datos_tablero')
inspect_tables('datalake_economico')
