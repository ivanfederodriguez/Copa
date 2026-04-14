import os
import json
import psycopg2
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

app = FastAPI(title="IPECD Analytics API")

# Enable CORS so the static frontend can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your domain
    allow_methods=["POST"],
    allow_headers=["*"],
)

class AnalyticsLog(BaseModel):
    id_usuario: int
    seccion_tablero: str
    accion: str
    detalle_interaccion: Optional[dict] = {}

def get_pg_connection():
    try:
        conn = psycopg2.connect(
            host=os.getenv('PG_HOST'),
            port=os.getenv('PG_PORT'),
            user=os.getenv('PG_USER'),
            password=os.getenv('PG_PASSWORD'),
            database=os.getenv('PG_DATABASE')
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

@app.post("/api/log")
async def log_activity(log: AnalyticsLog, request: Request):
    client_ip = request.client.host
    
    conn = get_pg_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO public.coparticipacion_registros 
            (id_usuario, seccion_tablero, accion, detalle_interaccion, ip_cliente)
            VALUES (%s, %s, %s, %s, %s);
        """
        cur.execute(query, (
            log.id_usuario,
            log.seccion_tablero,
            log.accion,
            json.dumps(log.detalle_interaccion),
            client_ip
        ))
        conn.commit()
        return {"status": "success", "message": "Activity logged"}
    except Exception as e:
        print(f"Error inserting log: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    import uvicorn
    # Runs the API on localhost:8080
    uvicorn.run(app, host="0.0.0.0", port=8080)
