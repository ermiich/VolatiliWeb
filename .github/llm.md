# VolatiliWeb — LLM Implementation Spec (MVP)

> **Instrucciones para el agente de IA:** Este documento es la fuente única de verdad para generar el MVP completo de VolatiliWeb. Léelo íntegro antes de escribir cualquier archivo. Sigue el orden de secciones. No omitas archivos. Cuando una sección diga "CRÍTICO", es una restricción no negociable de arquitectura o seguridad.

---

## Tabla de contenidos

1. [Visión y objetivo](#1-visión-y-objetivo)
2. [Stack tecnológico con versiones exactas](#2-stack-tecnológico-con-versiones-exactas)
3. [Estructura de directorios completa](#3-estructura-de-directorios-completa)
4. [Arquitectura de contenedores Docker Compose](#4-arquitectura-de-contenedores-docker-compose)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Esquema de base de datos PostgreSQL](#6-esquema-de-base-de-datos-postgresql)
7. [Backend: FastAPI — especificación completa de la API REST](#7-backend-fastapi--especificación-completa-de-la-api-rest)
8. [Worker: Celery + integración con Volatility 3](#8-worker-celery--integración-con-volatility-3)
9. [Frontend: React — componentes y flujo de UI](#9-frontend-react--componentes-y-flujo-de-ui)
10. [Volúmenes y gestión de archivos](#10-volúmenes-y-gestión-de-archivos)
11. [Manejo de errores y resiliencia](#11-manejo-de-errores-y-resiliencia)
12. [Script de pruebas de integración](#12-script-de-pruebas-de-integración)
13. [README.md requerido](#13-readmemd-requerido)
14. [Checklist de entrega](#14-checklist-de-entrega)

---

## 1. Visión y objetivo

**VolatiliWeb** es una aplicación web local, autohospedada en Docker, que expone el motor de análisis forense de memoria **Volatility 3** a través de una interfaz visual interactiva. El usuario objetivo es un investigador forense que no quiere trabajar con la CLI.

### Principios de diseño no negociables

- **Local-first:** Sin llamadas a servicios externos. Todo corre en la máquina del investigador.
- **Asincrónico:** Ningún análisis bloquea la UI. Todos los plugins corren en el worker.
- **Idempotente:** Ejecutar el mismo plugin sobre el mismo volcado dos veces no genera trabajo duplicado (deduplicación por hash).
- **Trazable:** Cada operación tiene un estado persistido en DB. Si el sistema se reinicia, los resultados no se pierden.
- **Resiliente:** Un plugin que crashea no tumba el worker ni bloquea otras tareas.

---

## 2. Stack tecnológico con versiones exactas

| Componente | Tecnología | Versión |
|---|---|---|
| Motor de análisis | Volatility 3 | `HEAD` del repo oficial (clonado en build) |
| Backend | Python | 3.11 |
| Framework API | FastAPI | 0.111.x |
| Servidor ASGI | Uvicorn | 0.29.x |
| ORM | SQLAlchemy | 2.0.x (async) |
| Migraciones DB | Alembic | 1.13.x |
| Task Queue | Celery | 5.3.x |
| Message Broker | Redis | 7.2 (imagen Docker oficial) |
| Base de datos | PostgreSQL | 16 (imagen Docker oficial) |
| Driver async PG | asyncpg | 0.29.x |
| Driver sync PG (Celery) | psycopg2-binary | 2.9.x |
| Frontend | React | 18.x |
| Build tool | Vite | 5.x |
| Estilos | Tailwind CSS | 3.x |
| Iconos | Lucide React | latest |
| Fetch HTTP | Axios | 1.x |
| Tablas | TanStack Table (react-table) | 8.x |
| Notificaciones UI | React Hot Toast | 2.x |
| Contenedores | Docker Compose | v2 (plugin integrado) |

---

## 3. Estructura de directorios completa

El agente debe generar **exactamente** este árbol de archivos. No crear archivos adicionales no especificados.

```
volatiliweb/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   └── app/
│       ├── __init__.py
│       ├── main.py                  # Entrypoint FastAPI
│       ├── config.py                # Pydantic Settings
│       ├── database.py              # Engine async SQLAlchemy
│       ├── models/
│       │   ├── __init__.py
│       │   ├── case.py
│       │   ├── dump.py
│       │   └── plugin_execution.py
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── case.py
│       │   ├── dump.py
│       │   └── plugin_execution.py
│       ├── api/
│       │   ├── __init__.py
│       │   ├── router.py            # Agrega todos los sub-routers
│       │   ├── cases.py
│       │   ├── dumps.py
│       │   └── plugins.py
│       └── core/
│           ├── __init__.py
│           ├── hashing.py           # SHA-256 de archivos
│           └── storage.py           # Gestión de rutas /evidence
│
├── worker/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── celery_app.py            # Instancia Celery
│       ├── config.py
│       ├── database.py              # Engine sync SQLAlchemy (Celery es síncrono)
│       ├── models/                  # Mismos modelos, copiados (no hay monorepo)
│       │   ├── __init__.py
│       │   ├── case.py
│       │   ├── dump.py
│       │   └── plugin_execution.py
│       └── tasks/
│           ├── __init__.py
│           ├── volatility_runner.py # Lógica de ejecución de plugins
│           └── plugin_tasks.py      # Tasks Celery registradas
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js            # Axios instance con base URL
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── CaseList.jsx
│       │   ├── CaseCreate.jsx
│       │   ├── DumpUpload.jsx
│       │   ├── PluginSelector.jsx
│       │   ├── PluginResultTable.jsx
│       │   ├── StatusBadge.jsx
│       │   └── LoadingSpinner.jsx
│       ├── pages/
│       │   ├── HomePage.jsx
│       │   ├── CasePage.jsx
│       │   └── AnalysisPage.jsx
│       ├── hooks/
│       │   └── usePolling.js        # Hook para polling de estado de tarea
│       └── utils/
│           └── formatters.js
│
└── tests/
    ├── test_integration.py
    ├── fixtures/
    │   └── README_fixtures.md       # Instrucciones para obtener volcados de prueba
    └── conftest.py
```

---

## 4. Arquitectura de contenedores Docker Compose

### 4.1 `docker-compose.yml` — spec completa

Generar exactamente este archivo con los siguientes servicios, redes, volúmenes y dependencias:

```yaml
# docker-compose.yml
services:

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - web-api
    networks:
      - volatiliweb-net

  web-api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - evidence-data:/evidence
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - volatiliweb-net
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

  worker:
    build:
      context: ./worker
      dockerfile: Dockerfile
    env_file:
      - .env
    volumes:
      - evidence-data:/evidence:ro      # CRÍTICO: read-only. El worker NUNCA escribe archivos, sólo lee.
      - symbols-data:/symbols:ro        # Tablas de símbolos ISF de Volatility
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - volatiliweb-net
    command: celery -A app.celery_app worker --loglevel=info --concurrency=2

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - volatiliweb-net

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks:
      - volatiliweb-net

volumes:
  postgres-data:
  evidence-data:
  symbols-data:

networks:
  volatiliweb-net:
    driver: bridge
```

### 4.2 Dockerfiles

#### `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
```

#### `worker/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema para Volatility 3
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev git curl \
    && rm -rf /var/lib/apt/lists/*

# Clonar Volatility 3 desde el repo oficial e instalarlo como paquete
RUN git clone --depth 1 https://github.com/volatilityfoundation/volatility3.git /opt/volatility3 \
    && pip install --no-cache-dir -e /opt/volatility3

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
```

#### `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

## 5. Variables de entorno

### `.env.example`

```dotenv
# PostgreSQL
POSTGRES_USER=volatiliweb
POSTGRES_PASSWORD=changeme_in_production
POSTGRES_DB=volatiliweb_db
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/0

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=db+postgresql://volatiliweb:changeme_in_production@db:5432/volatiliweb_db

# Paths de volúmenes (dentro de los contenedores)
EVIDENCE_PATH=/evidence
SYMBOLS_PATH=/symbols

# API
SECRET_KEY=generate_a_random_64_char_hex_string_here
ALLOWED_ORIGINS=http://localhost:3000

# Upload limits
MAX_UPLOAD_SIZE_MB=32768    # 32 GB en MB
UPLOAD_CHUNK_SIZE_MB=100    # Para uploads por streaming
```

### `backend/app/config.py`

Usar `pydantic-settings` para cargar estas variables con validación de tipos. Todas las variables deben tener un valor por defecto para tests.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    postgres_user: str
    postgres_password: str
    postgres_db: str
    postgres_host: str = "db"
    postgres_port: int = 5432
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    evidence_path: str = "/evidence"
    symbols_path: str = "/symbols"
    secret_key: str = "dev_secret_key"
    allowed_origins: list[str] = ["http://localhost:3000"]
    max_upload_size_mb: int = 32768

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

---

## 6. Esquema de base de datos PostgreSQL

### Entidades y relaciones

```
Case (1) ──── (N) Dump (1) ──── (N) PluginExecution (1) ──── (0..1) PluginResult
```

### 6.1 Modelo `Case` (`backend/app/models/case.py`)

```python
"""
Un caso agrupa uno o más volcados de memoria relacionados a una investigación.
"""

id: UUID (PK, default gen_random_uuid())
name: VARCHAR(255) NOT NULL
description: TEXT NULLABLE
created_at: TIMESTAMPTZ DEFAULT now()
updated_at: TIMESTAMPTZ DEFAULT now()
```

### 6.2 Modelo `Dump` (`backend/app/models/dump.py`)

```python
"""
Representa un archivo de volcado de memoria (.raw, .mem, .dmp) subido al sistema.
El archivo físico vive en /evidence/{case_id}/{dump_id}.{ext}
"""

id: UUID (PK)
case_id: UUID (FK → Case.id, ON DELETE CASCADE)
filename: VARCHAR(512) NOT NULL        # Nombre original del archivo
file_path: VARCHAR(1024) NOT NULL      # Ruta absoluta en /evidence
file_size_bytes: BIGINT NOT NULL
file_hash_sha256: VARCHAR(64) NOT NULL  # UNIQUE — para deduplicación
detected_os: VARCHAR(128) NULLABLE     # Resultado del autodetect de Volatility
detected_os_version: VARCHAR(256) NULLABLE
status: ENUM('uploaded', 'detecting', 'ready', 'error') DEFAULT 'uploaded'
error_message: TEXT NULLABLE
uploaded_at: TIMESTAMPTZ DEFAULT now()
```

**Índice obligatorio:** `CREATE UNIQUE INDEX idx_dump_hash ON dump(file_hash_sha256);`

### 6.3 Modelo `PluginExecution` (`backend/app/models/plugin_execution.py`)

```python
"""
Representa una solicitud de ejecución de un plugin sobre un volcado.
Desacopla el estado de la tarea del resultado final.
"""

id: UUID (PK)
dump_id: UUID (FK → Dump.id, ON DELETE CASCADE)
plugin_name: VARCHAR(128) NOT NULL      # e.g. "windows.pslist.PsList"
plugin_display_name: VARCHAR(128)       # e.g. "Process List"
celery_task_id: VARCHAR(255) NULLABLE   # ID de la tarea Celery para tracking
status: ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending'
started_at: TIMESTAMPTZ NULLABLE
completed_at: TIMESTAMPTZ NULLABLE
error_message: TEXT NULLABLE
error_traceback: TEXT NULLABLE          # Stack trace completo para debugging
result_row_count: INTEGER NULLABLE      # Cuántas filas devolvió el plugin
result_data: JSONB NULLABLE            # Array de dicts con el resultado del plugin
created_at: TIMESTAMPTZ DEFAULT now()
```

**Índice obligatorio:** `CREATE UNIQUE INDEX idx_execution_dump_plugin ON plugin_execution(dump_id, plugin_name);`

Esto garantiza que el mismo plugin no se ejecute dos veces sobre el mismo volcado (deduplicación por `(dump_id, plugin_name)`).

**Índice de búsqueda en resultado:**
`CREATE INDEX idx_result_data_gin ON plugin_execution USING GIN (result_data);`

---

## 7. Backend: FastAPI — especificación completa de la API REST

### 7.1 Configuración de la app (`app/main.py`)

```python
# Configurar CORSMiddleware con origins del .env
# Configurar max request size para uploads grandes
# Incluir el router principal de app/api/router.py
# Agregar health check en GET /health → {"status": "ok", "version": "0.1.0"}
# En startup event: verificar que /evidence y /symbols sean accesibles
```

### 7.2 Endpoints de Cases (`api/cases.py`)

| Método | Path | Descripción |
|---|---|---|
| `GET` | `/api/cases` | Lista todos los casos, ordenados por `created_at DESC` |
| `POST` | `/api/cases` | Crea un nuevo caso. Body: `{name, description?}` |
| `GET` | `/api/cases/{case_id}` | Retorna un caso con sus dumps anidados |
| `DELETE` | `/api/cases/{case_id}` | Elimina el caso y todos sus dumps del disco y la DB |

### 7.3 Endpoints de Dumps (`api/dumps.py`)

| Método | Path | Descripción | Notas |
|---|---|---|---|
| `POST` | `/api/cases/{case_id}/dumps` | Upload de volcado | Ver spec de upload más abajo |
| `GET` | `/api/cases/{case_id}/dumps` | Lista dumps de un caso | |
| `GET` | `/api/dumps/{dump_id}` | Detalle de un dump con sus plugin_executions | |
| `DELETE` | `/api/dumps/{dump_id}` | Elimina dump de disco y DB | |
| `POST` | `/api/dumps/{dump_id}/detect-os` | Dispara autodetección de OS | Encola tarea Celery `detect_os` |

#### Spec del endpoint de upload (`POST /api/cases/{case_id}/dumps`)

```
Content-Type: multipart/form-data
Campo: file (UploadFile)

Flujo obligatorio:
1. Validar extensión del archivo: solo .raw, .mem, .dmp son aceptados. Retornar 422 si no.
2. Validar tamaño: si supera MAX_UPLOAD_SIZE_MB retornar 413.
3. Calcular SHA-256 del archivo en streaming (no cargar todo en memoria).
4. Buscar en DB si ya existe un Dump con ese file_hash_sha256.
   - Si existe: retornar 200 con el dump existente y header X-Deduplicated: true
   - Si no existe: continuar
5. Guardar el archivo en /evidence/{case_id}/{dump_id_nuevo}{ext}
6. Insertar registro en DB con status='uploaded'
7. Encolar tarea Celery detect_os(dump_id) con prioridad alta
8. Retornar 201 con el objeto Dump recién creado

CRÍTICO: El archivo debe guardarse con streaming (chunks de 1MB) para no cargar
         todo el volcado en RAM del contenedor de la API.
```

### 7.4 Endpoints de Plugins (`api/plugins.py`)

| Método | Path | Descripción |
|---|---|---|
| `GET` | `/api/plugins` | Lista todos los plugins disponibles (ver catálogo en sección 8.4) |
| `POST` | `/api/dumps/{dump_id}/execute` | Ejecuta un plugin sobre un dump |
| `GET` | `/api/executions/{execution_id}` | Estado y resultado de una ejecución |
| `GET` | `/api/dumps/{dump_id}/executions` | Historial de ejecuciones de un dump |

#### Spec del endpoint de ejecución (`POST /api/dumps/{dump_id}/execute`)

```
Body JSON: { "plugin_name": "windows.pslist.PsList" }

Flujo obligatorio:
1. Verificar que el dump existe y tiene status='ready'. Retornar 422 si no.
2. Verificar que el dump tiene detected_os. Retornar 422 si está null con mensaje claro.
3. Buscar si ya existe una PluginExecution con (dump_id, plugin_name) y status='completed'.
   - Si existe: retornar 200 con la ejecución existente y header X-Cached: true
4. Si existe una ejecución con status='running' o 'pending': retornar 202 con esa ejecución.
5. Crear nueva PluginExecution con status='pending'.
6. Encolar tarea Celery run_plugin(execution_id).
7. Retornar 202 Accepted con la ejecución creada (sin resultado todavía).
```

### 7.5 Schemas Pydantic (schemas/)

Generar schemas de request y response para cada endpoint. Los schemas de response deben excluir información sensible como `file_path` absoluto (exponer solo `filename`).

```python
# Ejemplo de schema de response para PluginExecution
class PluginExecutionResponse(BaseModel):
    id: UUID
    dump_id: UUID
    plugin_name: str
    plugin_display_name: str
    status: str                     # pending | running | completed | failed
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    result_row_count: Optional[int]
    result_data: Optional[list[dict]]  # null si todavía no completó
    error_message: Optional[str]       # null si no falló
    created_at: datetime

    class Config:
        from_attributes = True
```

---

## 8. Worker: Celery + integración con Volatility 3

### 8.1 Instancia Celery (`worker/app/celery_app.py`)

```python
from celery import Celery
from app.config import settings

celery_app = Celery(
    "volatiliweb_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.plugin_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,        # ACK solo después de completar (resiliencia ante crasheos)
    worker_prefetch_multiplier=1,  # Un task a la vez por worker (volcados son pesados)
    task_soft_time_limit=1800,  # 30 minutos soft limit
    task_time_limit=2100,       # 35 minutos hard limit (mata el proceso si se cuelga)
)
```

### 8.2 Integración con Volatility 3 — CRÍTICO

**PROBLEMA:** Importar Volatility 3 directamente dentro de la tarea Celery es frágil. Si el plugin crashea con un segfault o corrupción de memoria, mata el proceso worker entero.

**SOLUCIÓN OBLIGATORIA:** Usar `multiprocessing` para ejecutar Volatility en un proceso hijo supervisado. La tarea Celery supervisa el proceso hijo. Si el hijo muere, la tarea captura el error y actualiza la DB sin tumbar el worker.

```python
# worker/app/tasks/volatility_runner.py

import multiprocessing
import json
import sys
import traceback
from pathlib import Path

def _run_volatility_in_subprocess(
    dump_path: str,
    plugin_class_path: str,  # e.g. "volatility3.plugins.windows.pslist.PsList"
    symbols_path: str,
    result_queue: multiprocessing.Queue,
):
    """
    Esta función corre en un proceso hijo separado.
    Importa y ejecuta Volatility 3. Si crashea, sólo muere este proceso.
    Envía el resultado (o el error) por la Queue al proceso padre.
    """
    try:
        import volatility3.framework
        from volatility3.framework import automagic, constants, interfaces
        from volatility3.framework.configuration import requirements
        from volatility3 import plugins
        import volatility3.plugins.windows as win_plugins

        # Configurar path de symbols
        constants.SYMBOL_BASEPATHS = [symbols_path, constants.SYMBOL_BASEPATHS[0]]

        # Crear contexto de Volatility
        ctx = volatility3.framework.contexts.Context()
        failures = volatility3.framework.import_files(plugins, prefix="volatility3.plugins")

        # Configurar la fuente del volcado
        single_location = "file://" + str(Path(dump_path).resolve())
        ctx.config["automagic.LayerStacker.single_location"] = single_location

        # Resolver automagics (detección automática de OS y capas)
        automagics = automagic.available(ctx)
        plugin_list = volatility3.framework.list_plugins()

        # Obtener la clase del plugin
        plugin_cls = plugin_list.get(plugin_class_path)
        if plugin_cls is None:
            result_queue.put({"error": f"Plugin '{plugin_class_path}' no encontrado."})
            return

        # Construir y validar el plugin
        constructed = automagic.run(automagics, ctx, plugin_cls, "plugins", progress_callback=None)

        # Iterar sobre el TreeGrid y convertir a lista de dicts
        rows = []
        columns = [col.name for col in constructed.run().columns]

        for row in constructed.run().generator:
            row_dict = {}
            for col_name, value in zip(columns, row):
                # Convertir tipos de Volatility a tipos serializables
                if hasattr(value, '__int__'):
                    row_dict[col_name] = int(value)
                elif hasattr(value, '__str__'):
                    row_dict[col_name] = str(value)
                else:
                    row_dict[col_name] = repr(value)
            rows.append(row_dict)

        result_queue.put({"rows": rows, "columns": columns})

    except Exception as e:
        result_queue.put({
            "error": str(e),
            "traceback": traceback.format_exc()
        })


def execute_volatility_plugin(
    dump_path: str,
    plugin_class_path: str,
    symbols_path: str,
    timeout_seconds: int = 1500,
) -> dict:
    """
    Interfaz pública del runner. Lanza el proceso hijo y espera el resultado.
    Retorna dict con 'rows' y 'columns', o lanza excepción con el error.
    """
    result_queue = multiprocessing.Queue()

    process = multiprocessing.Process(
        target=_run_volatility_in_subprocess,
        args=(dump_path, plugin_class_path, symbols_path, result_queue),
        daemon=True,
    )
    process.start()
    process.join(timeout=timeout_seconds)

    if process.is_alive():
        process.terminate()
        process.join(timeout=5)
        raise TimeoutError(f"El plugin '{plugin_class_path}' superó el límite de {timeout_seconds}s")

    if process.exitcode != 0 and result_queue.empty():
        raise RuntimeError(f"El proceso del plugin terminó con código {process.exitcode} sin resultado")

    result = result_queue.get_nowait()

    if "error" in result:
        raise RuntimeError(result["error"] + "\n" + result.get("traceback", ""))

    return result
```

### 8.3 Tasks Celery (`worker/app/tasks/plugin_tasks.py`)

```python
# Dos tasks principales:

@celery_app.task(bind=True, name="detect_os")
def detect_os(self, dump_id: str):
    """
    Ejecuta el autodetect de Volatility sobre un volcado.
    Actualiza dump.detected_os y dump.status en DB.
    """
    # 1. Obtener dump de DB
    # 2. Actualizar status='detecting'
    # 3. Llamar execute_volatility_plugin con plugin "volatility3.plugins.windows.info.Info"
    # 4. Parsear la salida para extraer OS y versión
    # 5. Actualizar dump.detected_os, dump.detected_os_version, dump.status='ready'
    # 6. En caso de excepción: dump.status='error', dump.error_message=str(e)
    # Siempre: usar try/except y commit o rollback en DB


@celery_app.task(bind=True, name="run_plugin")
def run_plugin(self, execution_id: str):
    """
    Ejecuta un plugin registrado sobre el volcado asociado.
    """
    # 1. Obtener PluginExecution de DB
    # 2. Obtener el Dump asociado
    # 3. Actualizar execution.status='running', execution.started_at=now()
    # 4. Mapear plugin_name a plugin_class_path (ver catálogo en 8.4)
    # 5. Llamar execute_volatility_plugin(dump.file_path, plugin_class_path, settings.symbols_path)
    # 6. Guardar resultado:
    #    - execution.status='completed'
    #    - execution.result_data=result['rows']
    #    - execution.result_row_count=len(result['rows'])
    #    - execution.completed_at=now()
    # 7. En caso de excepción:
    #    - execution.status='failed'
    #    - execution.error_message=str(e) (primeras 500 chars)
    #    - execution.error_traceback=traceback completo
    #    - execution.completed_at=now()
```

### 8.4 Catálogo de plugins del MVP

El sistema debe soportar exactamente estos plugins en el MVP. El endpoint `GET /api/plugins` los retorna como lista estática.

```python
PLUGIN_CATALOG = [
    {
        "name": "windows.info.Info",
        "display_name": "System Info",
        "description": "Información general del sistema operativo y el volcado",
        "class_path": "volatility3.plugins.windows.info.Info",
        "os": "windows",
    },
    {
        "name": "windows.pslist.PsList",
        "display_name": "Process List",
        "description": "Lista de procesos activos al momento del volcado",
        "class_path": "volatility3.plugins.windows.pslist.PsList",
        "os": "windows",
    },
    {
        "name": "windows.pstree.PsTree",
        "display_name": "Process Tree",
        "description": "Árbol de procesos con jerarquía padre-hijo",
        "class_path": "volatility3.plugins.windows.pstree.PsTree",
        "os": "windows",
    },
    {
        "name": "windows.netscan.NetScan",
        "display_name": "Network Scan",
        "description": "Conexiones de red activas y sockets",
        "class_path": "volatility3.plugins.windows.netscan.NetScan",
        "os": "windows",
    },
    {
        "name": "windows.cmdline.CmdLine",
        "display_name": "Command Lines",
        "description": "Argumentos de línea de comandos de cada proceso",
        "class_path": "volatility3.plugins.windows.cmdline.CmdLine",
        "os": "windows",
    },
    {
        "name": "windows.dlllist.DllList",
        "display_name": "DLL List",
        "description": "DLLs cargadas por cada proceso",
        "class_path": "volatility3.plugins.windows.dlllist.DllList",
        "os": "windows",
    },
    {
        "name": "windows.malfind.Malfind",
        "display_name": "Malfind (lento)",
        "description": "Detecta regiones de memoria con posible código inyectado",
        "class_path": "volatility3.plugins.windows.malfind.Malfind",
        "os": "windows",
    },
]
```

### 8.5 Cómo añadir nuevos plugins (documentar en README)

Para registrar un nuevo plugin de Volatility en el sistema:

1. Verificar que el plugin existe en la instalación de Volatility 3 con `python -m volatility3 -f <dump> <plugin.Name> --help`
2. Añadir una entrada al diccionario `PLUGIN_CATALOG` en `worker/app/tasks/plugin_tasks.py` con los campos: `name`, `display_name`, `description`, `class_path`, `os`
3. El sistema no requiere reinicio para detectar el nuevo plugin — el frontend obtiene el catálogo en tiempo real desde `GET /api/plugins`

---

## 9. Frontend: React — componentes y flujo de UI

### 9.1 Principios de diseño

- **Tema:** Dark mode exclusivo. Fondo principal: `#0f1117`. Superficies: `#1a1d27`. Bordes: `#2d3148`.
- **Color de acento:** Violeta/índigo: `#6366f1` (Indigo-500 de Tailwind).
- **Tipografía:** Inter o sistema sans-serif. Sin serif fonts.
- **Sin animaciones innecesarias.** Solo transiciones funcionales (loading states, tooltips).
- Los colores de estado de procesos son semánticos: rojo = sospechoso, amarillo = atención, verde = normal.

### 9.2 Flujo de navegación

```
/ (HomePage)
├── Lista de casos existentes con stats (dumps, ejecuciones)
└── Botón "Nuevo Caso" → modal de creación

/cases/:caseId (CasePage)
├── Header con nombre y descripción del caso
├── Lista de dumps subidos
├── Área de drag-and-drop para subir nuevo volcado
└── Click en dump → /cases/:caseId/dumps/:dumpId

/cases/:caseId/dumps/:dumpId (AnalysisPage)
├── Info del volcado (OS detectado, tamaño, hash SHA-256 truncado)
├── PluginSelector (grilla de plugins disponibles, deshabilitados si OS no detectado)
├── Historial de ejecuciones anteriores
└── Resultado activo en tabla interactiva
```

### 9.3 Componente `PluginResultTable`

Este es el componente más importante del frontend. Implementar con TanStack Table v8.

**Características obligatorias:**
- Paginación client-side (25 filas por página por defecto, selector de 10/25/50/100).
- Búsqueda global sobre todas las columnas (input de texto con debounce de 300ms).
- Ordenamiento por columna (click en header).
- **Resaltado de procesos sospechosos** para el plugin `windows.pslist.PsList`:
  - Procesos cuyo `PPID` no corresponde a ningún `PID` en la lista → fila en rojo (`bg-red-900/30 border-l-2 border-red-500`).
  - Procesos con `PID` < 4 que no sean `System` o `Idle` → fila en amarillo.
  - `smss.exe`, `csrss.exe`, `wininit.exe` con más de 1 instancia → fila en amarillo.
- Columnas ocultables mediante un menú de toggle.
- Export a CSV del resultado completo (no solo la página visible).
- Tooltip en filas resaltadas explicando por qué es sospechoso.

### 9.4 Hook `usePolling` (`src/hooks/usePolling.js`)

```javascript
/**
 * Hace polling a una URL cada `interval` ms mientras `condition` sea true.
 * Se detiene cuando la condición es false o el componente se desmonta.
 * Retorna { data, loading, error }
 *
 * Uso:
 * const { data } = usePolling(
 *   `/api/executions/${executionId}`,
 *   (data) => !['completed', 'failed'].includes(data?.status),
 *   2000
 * )
 */
```

### 9.5 Feedback visual de estados

Todos los estados de una `PluginExecution` deben tener representación visual clara:

| Status | Componente `StatusBadge` | Color |
|---|---|---|
| `pending` | "En cola" + ícono reloj | Gris |
| `running` | "Analizando..." + spinner giratorio | Azul |
| `completed` | "Completado" + ✓ | Verde |
| `failed` | "Error" + ícono X | Rojo |

El estado `running` y `pending` activan el hook `usePolling` en la `AnalysisPage` para actualizar automáticamente cada 2 segundos.

### 9.6 Upload de volcados

Implementar drag-and-drop con las siguientes reglas:

- Solo aceptar extensiones: `.raw`, `.mem`, `.dmp`.
- Mostrar progreso de upload con una barra (usar `onUploadProgress` de Axios).
- Mostrar el tamaño del archivo antes de subir con confirmación si supera 1 GB.
- Mostrar el SHA-256 calculado en el frontend (usando `crypto.subtle`) para que el investigador pueda verificarlo.
- Si la API responde con `X-Deduplicated: true`, mostrar mensaje: *"Este volcado ya existe en el sistema. Se redirige al análisis existente."*

---

## 10. Volúmenes y gestión de archivos

### 10.1 Estructura del volumen `/evidence`

```
/evidence/
└── {case_id_uuid}/
    └── {dump_id_uuid}.{ext}   # Solo un archivo por dump_id
```

### 10.2 Módulo `core/storage.py`

```python
"""
Centraliza toda la lógica de rutas de archivos.
Ningún otro módulo debe construir paths de /evidence directamente.
"""

def get_dump_path(case_id: str, dump_id: str, extension: str) -> Path:
    ...

def ensure_case_directory(case_id: str) -> Path:
    """Crea el directorio del caso si no existe."""
    ...

def delete_dump_file(file_path: str) -> bool:
    """Elimina el archivo del disco. Retorna True si existía."""
    ...

def calculate_sha256_streaming(file: UploadFile, chunk_size: int = 1024 * 1024) -> str:
    """Calcula el SHA-256 de un UploadFile sin cargar todo en memoria."""
    ...
```

### 10.3 Volumen `/symbols`

El volumen `symbols-data` se monta como **read-only** en el worker en `/symbols`. El investigador debe colocar aquí los archivos ISF (Intermediate Symbol Format) de Volatility 3 antes de analizar volcados.

La estructura esperada dentro del volumen (documentar en README):

```
/symbols/
└── windows/
    └── ntkrnlmp.pdb/
        └── {GUID}/
            └── ntkrnlmp.pdb.json.xz   # Archivo ISF comprimido
```

Volatility 3 busca automáticamente en este path si `SYMBOL_BASEPATHS` lo incluye.

### 10.4 Política de retención de archivos (MVP)

- Los archivos en `/evidence` se conservan mientras el registro `Dump` exista en DB.
- Al hacer `DELETE /api/dumps/{dump_id}`, la API elimina primero el archivo del disco y luego el registro de DB (en ese orden, para no tener registros huérfanos).
- Al hacer `DELETE /api/cases/{case_id}`, se eliminan en cascada todos los dumps del disco antes de eliminar el caso.
- No hay limpieza automática por tiempo en el MVP (documentar como mejora futura).

---

## 11. Manejo de errores y resiliencia

### 11.1 Errores HTTP estándar de la API

```python
# En app/main.py, registrar exception handlers para:

@app.exception_handler(404)
# Retornar: {"error": "not_found", "message": "Recurso no encontrado", "detail": null}

@app.exception_handler(422)
# Retornar: {"error": "validation_error", "message": "...", "detail": [...errores Pydantic...]}

@app.exception_handler(413)
# Retornar: {"error": "file_too_large", "message": "El archivo supera el límite de X GB"}

@app.exception_handler(500)
# Retornar: {"error": "internal_error", "message": "Error interno. Ver logs del servidor."}
# NUNCA exponer stack traces en respuestas HTTP de producción.
```

### 11.2 Resiliencia del worker

- `task_acks_late=True` en Celery: si el worker se cae mientras procesa una tarea, Redis la reencola automáticamente.
- Siempre envolver el body de cada task en `try/except Exception as e` y actualizar el estado en DB en el bloque `finally`.
- El campo `error_traceback` en `PluginExecution` guarda el stack trace completo solo en DB (no se expone en la API por defecto, pero disponible para debugging directo en DB).
- Si la detección de OS falla, el dump queda en `status='error'`. El usuario puede reintentar desde la UI.

### 11.3 Validaciones de negocio

- No permitir ejecutar plugins si `dump.status != 'ready'`.
- No permitir ejecutar plugins si `dump.detected_os` es null.
- No permitir subir archivos de 0 bytes.
- No permitir nombres de caso vacíos o con solo espacios.

---

## 12. Script de pruebas de integración

### `tests/test_integration.py`

```python
"""
Test de integración para verificar el flujo completo del MVP.

Prerrequisito: El stack Docker Compose debe estar corriendo.
              Colocar un volcado de prueba pequeño (< 500 MB) en tests/fixtures/

Ejecutar con: pytest tests/test_integration.py -v
"""

import pytest
import httpx
import time
from pathlib import Path

BASE_URL = "http://localhost:8000"
FIXTURE_DUMP = Path(__file__).parent / "fixtures" / "test.mem"

# Tests a implementar (en orden):

def test_health_check():
    """GET /health debe retornar 200 con status ok"""

def test_create_case():
    """POST /api/cases debe crear un caso y retornar 201"""

def test_upload_dump():
    """POST /api/cases/{id}/dumps debe subir el fixture y retornar 201"""

def test_upload_deduplication():
    """Subir el mismo archivo dos veces debe retornar 200 con X-Deduplicated: true"""

def test_os_detection_completes():
    """
    Esperar hasta 60 segundos que dump.status sea 'ready'.
    Polling cada 3 segundos.
    Fallar si no completa en tiempo.
    """

def test_execute_pslist():
    """POST /api/dumps/{id}/execute con plugin windows.pslist.PsList debe retornar 202"""

def test_pslist_completes():
    """
    Esperar hasta 120 segundos que la ejecución tenga status='completed'.
    Verificar que result_data es una lista no vacía.
    Verificar que cada row tiene al menos las claves: PID, PPID, ImageFileName.
    """

def test_results_persisted_in_db():
    """
    Ejecutar el mismo plugin de nuevo.
    Verificar que la API retorna la ejecución existente (X-Cached: true)
    sin crear una nueva tarea Celery.
    """

def test_delete_case_cleans_disk():
    """
    Eliminar el caso creado.
    Verificar que el archivo en /evidence ya no existe.
    Verificar que el registro en DB ya no existe (GET retorna 404).
    """
```

### `tests/fixtures/README_fixtures.md`

```markdown
# Cómo obtener volcados de prueba para los tests

El directorio `tests/fixtures/` requiere un archivo de volcado de memoria real para
que los tests de integración funcionen. Por razones de tamaño no se incluye en el repo.

## Opciones (ordenadas por facilidad):

### Opción 1: MemLabs (recomendado para CI)
Los autores de MemLabs proveen imágenes pequeñas para aprendizaje.
Descargar desde: https://github.com/stuxnet999/MemLabs
Colocar el archivo como: tests/fixtures/test.mem

### Opción 2: Volatility 3 sample images
El repositorio oficial de Volatility Foundation incluye imágenes de prueba.
https://github.com/volatilityfoundation/volatility3/wiki/Windows-Symbol-Tables

### Opción 3: Crear uno propio con WinPmem
Si tenés una VM Windows disponible, usar WinPmem para crear un volcado pequeño:
https://github.com/Velocidex/WinPmem
Colocar el archivo como: tests/fixtures/test.mem

## Nota sobre símbolos ISF
Para que Volatility 3 pueda analizar el volcado, necesitás las tablas de símbolos
correspondientes al kernel del Windows del volcado.
Ver README.md sección "Tablas de Símbolos" para instrucciones detalladas.
```

---

## 13. README.md requerido

El README debe incluir obligatoriamente las siguientes secciones:

### Sección 1: Requisitos previos

```markdown
- Docker Engine 24.x o superior
- Docker Compose v2 (incluido en Docker Desktop)
- 8 GB de RAM mínimo disponibles para Docker
- 50 GB de espacio en disco (para volcados y resultados)
```

### Sección 2: Instalación y primer arranque

```bash
git clone <repo>
cd volatiliweb
cp .env.example .env
# Editar .env con tu POSTGRES_PASSWORD y SECRET_KEY seguros
docker compose up --build
# Primera vez: la build del worker descarga Volatility 3 (~2 min)
# Acceder a: http://localhost:3000
```

### Sección 3: Cómo añadir tablas de símbolos ISF

```markdown
Las tablas de símbolos son necesarias para analizar volcados de Windows.
Sin ellas, Volatility 3 no puede resolver nombres de estructuras del kernel.

1. Descargar los ISF correspondientes a tu Windows desde:
   https://github.com/volatilityfoundation/volatility3/releases (ver sección "Symbols")
   
2. Montar el volumen symbols-data en tu sistema para escribir en él:
   docker run --rm -v volatiliweb_symbols-data:/symbols -v $(pwd)/mis_simbolos:/src \
     alpine cp -r /src/windows /symbols/

3. Verificar que Volatility los reconoce:
   docker exec volatiliweb-worker-1 \
     python -c "import volatility3.framework.constants as c; print(c.SYMBOL_BASEPATHS)"

4. La estructura esperada dentro del volumen es:
   /symbols/windows/{nombre.pdb}/{GUID}/{nombre.pdb}.json.xz
```

### Sección 4: Cómo añadir nuevos plugins

Documentar el proceso descrito en la sección 8.5 de este spec.

### Sección 5: Comandos útiles

```bash
# Ver logs del worker en tiempo real
docker compose logs -f worker

# Acceder a la DB directamente
docker compose exec db psql -U volatiliweb -d volatiliweb_db

# Reiniciar solo el worker sin tocar la DB
docker compose restart worker

# Ejecutar los tests de integración (requiere fixtures)
docker compose exec web-api pytest tests/test_integration.py -v

# Apagar todo y limpiar volúmenes (DESTRUYE TODOS LOS DATOS)
docker compose down -v
```

### Sección 6: Troubleshooting

```markdown
**El worker no detecta el OS del volcado**
→ Verificar que las tablas de símbolos ISF están en el volumen /symbols.
→ Ver logs: docker compose logs worker

**Error "Plugin not found" al ejecutar un análisis**
→ El plugin no está instalado en la versión de Volatility clonada.
→ Verificar con: docker compose exec worker python -m volatility3 --help

**El upload se cae en archivos grandes**
→ Ajustar MAX_UPLOAD_SIZE_MB en .env
→ Verificar que hay espacio en el volumen evidence-data

**La UI no se conecta a la API**
→ Verificar que VITE_API_URL en docker-compose.yml apunta al host correcto.
→ En macOS/Windows con Docker Desktop, usar http://host.docker.internal:8000
```

---

## 14. Checklist de entrega

El agente debe verificar que todos estos archivos existen y son funcionales antes de considerar el MVP completo:

### Archivos de infraestructura
- [ ] `docker-compose.yml` con los 5 servicios, healthchecks y volúmenes
- [ ] `.env.example` con todas las variables documentadas
- [ ] `.gitignore` (incluir `.env`, `*.mem`, `*.raw`, `*.dmp`, `__pycache__`, `node_modules`)

### Backend
- [ ] `backend/Dockerfile`
- [ ] `backend/requirements.txt` con versiones pinneadas
- [ ] `backend/alembic.ini` y `alembic/env.py` configurados
- [ ] `alembic/versions/0001_initial_schema.py` con las 3 tablas
- [ ] `app/main.py` con CORS, exception handlers, y health check
- [ ] `app/config.py` con Pydantic Settings
- [ ] `app/database.py` con engine async
- [ ] Los 3 modelos SQLAlchemy (`case.py`, `dump.py`, `plugin_execution.py`)
- [ ] Los schemas Pydantic de request y response
- [ ] Los 3 routers de la API (`cases.py`, `dumps.py`, `plugins.py`)
- [ ] `core/hashing.py` y `core/storage.py`

### Worker
- [ ] `worker/Dockerfile` (clona Volatility 3 en build)
- [ ] `worker/requirements.txt`
- [ ] `worker/app/celery_app.py` con la configuración especificada
- [ ] `worker/app/tasks/volatility_runner.py` con el patrón `multiprocessing`
- [ ] `worker/app/tasks/plugin_tasks.py` con `detect_os` y `run_plugin`
- [ ] El `PLUGIN_CATALOG` con los 7 plugins del MVP

### Frontend
- [ ] `frontend/Dockerfile`
- [ ] `frontend/package.json` con todas las dependencias
- [ ] `frontend/vite.config.js` con proxy a la API (para evitar CORS en dev)
- [ ] `src/api/client.js` con la instancia de Axios
- [ ] Todas las páginas: `HomePage`, `CasePage`, `AnalysisPage`
- [ ] Todos los componentes: `Layout`, `CaseList`, `CaseCreate`, `DumpUpload`, `PluginSelector`, `PluginResultTable`, `StatusBadge`, `LoadingSpinner`
- [ ] `src/hooks/usePolling.js`
- [ ] Tailwind configurado en dark mode (`darkMode: 'class'` o `'media'`)
- [ ] El tema dark aplicado globalmente en `index.html` o `App.jsx`

### Tests y documentación
- [ ] `tests/test_integration.py` con los 8 tests especificados
- [ ] `tests/conftest.py` con fixtures de pytest (BASE_URL, session de httpx)
- [ ] `tests/fixtures/README_fixtures.md`
- [ ] `README.md` con las 6 secciones especificadas

---

## Notas finales para el agente

1. **Orden de implementación recomendado:** DB schema → Backend models → Backend API → Worker → Frontend → Tests → README.

2. **No usar `subprocess.run()` para Volatility.** Siempre usar el patrón `multiprocessing.Process` descrito en la sección 8.2.

3. **No cargar volcados completos en RAM.** Todo streaming: upload por chunks, hashing por chunks, lectura por chunks.

4. **No exponer rutas absolutas de archivos en las respuestas HTTP.** El schema de `Dump` en la API expone `filename` (nombre original) pero no `file_path`.

5. **El worker debe tener sus propios modelos SQLAlchemy** (copiar del backend). No compartir código entre contenedores en el MVP para mantener independencia de build.

6. **Versiones en `requirements.txt`:** Usar versiones exactas (`paquete==X.Y.Z`), no rangos. Esto garantiza builds reproducibles.

7. **La migración de Alembic se ejecuta automáticamente** en el comando de startup del contenedor `web-api` (`alembic upgrade head && uvicorn ...`). El worker no ejecuta migraciones.