import os
import psycopg2
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

conn = psycopg2.connect(
    host=os.getenv('PG_HOST'),
    port=os.getenv('PG_PORT'),
    user=os.getenv('PG_USER'),
    password=os.getenv('PG_PASSWORD'),
    database=os.getenv('PG_DATABASE')
)
cur = conn.cursor()
cur.execute("""
    SELECT r.id_registro, u.username, r.seccion_tablero, r.accion, 
           r.detalle_interaccion, r.ip_cliente, r.fecha_hora
    FROM public.coparticipacion_registros r
    JOIN public.usuarios_tableros u ON r.id_usuario = u.id_usuario
    ORDER BY r.fecha_hora DESC
    LIMIT 10;
""")
rows = cur.fetchall()
if not rows:
    print("No hay registros todavia en la tabla.")
else:
    print(f"=== Ultimos {len(rows)} registros ===")
    for row in rows:
        print(f"[{row[6]}] User={row[1]} | Seccion={row[2]} | Accion={row[3]} | Detalle={row[4]} | IP={row[5]}")
conn.close()
