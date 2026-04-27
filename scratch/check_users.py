import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), '.env'))

def check_user():
    try:
        conn = psycopg2.connect(
            host=os.getenv('PG_HOST'),
            port=os.getenv('PG_PORT'),
            user=os.getenv('PG_USER'),
            password=os.getenv('PG_PASSWORD'),
            dbname=os.getenv('PG_DATABASE')
        )
        cursor = conn.cursor()
        cursor.execute("SELECT username, password_hash FROM usuarios_tableros")
        rows = cursor.fetchall()
        for row in rows:
            print(f"User: {row[0]}, Pass: {row[1]}")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

check_user()
