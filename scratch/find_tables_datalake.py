import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), '.env'))

def find_tables():
    try:
        conn = psycopg2.connect(
            host=os.getenv('PG_HOST'),
            port=os.getenv('PG_PORT'),
            user=os.getenv('PG_USER'),
            password=os.getenv('PG_PASSWORD'),
            dbname='datalake_economico'
        )
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%recursos%' OR table_name LIKE '%municipio%' OR table_name LIKE '%presupuesto%' OR table_name LIKE '%copa%')
        """)
        rows = cursor.fetchall()
        for row in rows:
            print(f"Table: {row[0]}")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

find_tables()
