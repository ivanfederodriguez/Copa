import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), '.env'))

def find_all_tables(dbname):
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
        """)
        tables = [row[0] for row in cursor.fetchall()]
        print(f"Total tables: {len(tables)}")
        # Print tables that might be relevant
        relevant = [t for t in tables if any(keyword in t.lower() for keyword in ['reca', 'prov', 'muni', 'copa', 'anual', 'tablero'])]
        print(f"Relevant tables: {relevant}")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

find_all_tables('datos_tablero')
find_all_tables('datalake_economico')
