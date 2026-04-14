import os
import psycopg2
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

def inspect_db():
    print(f"Connecting to {os.getenv('PG_HOST')} / {os.getenv('PG_DATABASE')}...")
    try:
        conn = psycopg2.connect(
            host=os.getenv('PG_HOST'),
            port=os.getenv('PG_PORT'),
            user=os.getenv('PG_USER'),
            password=os.getenv('PG_PASSWORD'),
            database=os.getenv('PG_DATABASE')
        )
        cur = conn.cursor()
        
        print("\n--- List of schemas ---")
        cur.execute("SELECT schema_name FROM information_schema.schemata;")
        for s in cur.fetchall():
            print(f"- {s[0]}")
            
        print("\n--- List of tables (all schemas) ---")
        cur.execute("""
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name;
        """)
        tables = cur.fetchall()
        if not tables:
            print("No tables found!")
        for t in tables:
            print(f"[{t[0]}] {t[1]}")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_db()
