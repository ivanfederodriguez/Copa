# Tablero de Control - Coparticipación y Empleo Provincial

Este proyecto es un tablero de control interactivo para visualizar datos de coparticipación federal y empleo público de la Provincia de Corrientes.

## Estructura del Proyecto

- `/main`: Monitor Mensual (Dashboard principal).
- `/analisis-anual`: Análisis histórico de los últimos 4 años.
- `/analisis-personal`: Análisis de empleo público y masa salarial.

## Configuración para Desarrollo Local

1.  **Variables de Entorno**: Copia el archivo `.env.example` a un nuevo archivo `.env` y completa tus credenciales de base de datos.
    ```bash
    cp .env.example .env
    ```
2.  **Dependencias de Python**: Asegúrate de tener instalado:
    - `mysql-connector-python`
    - `pandas`
    - `numpy`

3.  **Ejecutar ETL**: Para actualizar los datos manualmente:
    ```bash
    python main/etl_main.py
    python analisis-personal/etl_personal.py
    ```

## Despliegue (GitHub Pages / Vercel)

El frontend es estático y se puede servir directamente. 

### Notas Importantes para Producción:
- **Seguridad**: Los scripts de Python se han configurado para leer credenciales desde variables de entorno (`DB_USER`, `DB_PASSWORD`, etc.). Nunca subas el archivo `.env` al repositorio.
- **Automatización**: Se recomienda configurar **GitHub Actions** para ejecutar los scripts de ETL periódicamente y actualizar los archivos `dashboard_data.json` automáticamente.

## Créditos
Elaborado por IPECD - Instituto de Estadística y Ciencia de Datos de la Provincia de Corrientes.
