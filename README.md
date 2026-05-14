
# VolatiliWeb

[!IMPORTANT]
> **VolatiliWeb** es una plataforma web para el análisis de memoria RAM forense usando [Volatility 3](https://github.com/volatilityfoundation/volatility3). Permite cargar volcados de memoria, ejecutar plugins de análisis y visualizar resultados de forma colaborativa y centralizada.

---

## Tabla de Contenidos

- [VolatiliWeb](#volatiliweb)
  - [Tabla de Contenidos](#tabla-de-contenidos)
  - [¿Para qué sirve?](#para-qué-sirve)
  - [Tecnologías utilizadas](#tecnologías-utilizadas)
  - [Arquitectura](#arquitectura)
  - [Requisitos previos](#requisitos-previos)
  - [Despliegue y primer arranque](#despliegue-y-primer-arranque)
  - [Configuración de entorno](#configuración-de-entorno)
  - [Gestión de tablas de símbolos ISF](#gestión-de-tablas-de-símbolos-isf)
  - [Añadir nuevos plugins](#añadir-nuevos-plugins)
  - [Comandos útiles](#comandos-útiles)
  - [Solución de problemas](#solución-de-problemas)

---

## ¿Para qué sirve?

VolatiliWeb facilita el análisis forense de volcados de memoria RAM, permitiendo:

- Subir volcados de memoria de sistemas Windows y Linux.
- Ejecutar plugins de Volatility 3 desde una interfaz web.
- Visualizar y exportar resultados de análisis.
- Gestionar casos y evidencias de forma centralizada.
- Automatizar análisis con un worker asíncrono.

[!NOTE]
> Ideal para laboratorios de análisis forense, equipos de respuesta a incidentes y formación en ciberseguridad.

## Tecnologías utilizadas

- **Backend:** FastAPI (Python), SQLAlchemy, Alembic, PostgreSQL
- **Frontend:** React, Vite, TailwindCSS
- **Worker:** Celery, Volatility 3
- **Infraestructura:** Docker, Docker Compose, Redis

## Arquitectura

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Frontend  │<--->│  Web API   │<--->│   Worker   │
└────────────┘     └────────────┘     └────────────┘
      │                │                  │
      ▼                ▼                  ▼
   Usuario         Base de datos      Volatility 3
```

- **Frontend:** Interfaz web para usuarios (React + Vite + Tailwind CSS 4 en modo CSS-first).
- **Web API:** Expone endpoints REST para gestión de casos, volcados y plugins.
- **Worker:** Ejecuta análisis de memoria de forma asíncrona usando Volatility 3.
- **DB/Redis:** Persistencia y colas de tareas.

## Requisitos previos

- Docker Engine 24.x o superior
- Docker Compose v2 (incluido en Docker Desktop)
- 8 GB de RAM mínimo disponibles para Docker
- 50 GB de espacio en disco (para volcados y resultados)

[!WARNING]
> El análisis de volcados grandes puede requerir más recursos según el caso.

## Despliegue y primer arranque

```bash
git clone <repo>
cd volatiliweb
cp .env.example .env
# Edita .env con tus valores seguros (POSTGRES_PASSWORD, SECRET_KEY, etc)
docker compose up --build
# Primera vez: la build del worker descarga Volatility 3 (~2 min)
# Accede a: http://127.0.0.1:3000
```

[!TIP]
> Puedes personalizar la URL de la API para el frontend editando `VITE_API_URL` en `.env` y `docker-compose.yml`. En esta configuración local usamos `127.0.0.1` para evitar problemas de resolución de `localhost` en Windows.

## Configuración de entorno

El archivo `.env.example` contiene todas las variables necesarias. Copia y renombra como `.env` y edítalo según tus necesidades:

```env
POSTGRES_USER=volatiliweb
POSTGRES_PASSWORD=changeme
POSTGRES_DB=volatiliweb_db
SECRET_KEY=changeme
VITE_API_URL=http://127.0.0.1:8000
MAX_UPLOAD_SIZE_MB=2048
```

[!NOTE]
> No compartas tu archivo `.env` real. Usa `.env.example` como plantilla.

## Gestión de tablas de símbolos ISF

Las tablas de símbolos son necesarias para analizar volcados de Windows. Sin ellas, Volatility 3 no puede resolver nombres de estructuras del kernel.

1. Descarga los ISF correspondientes a tu Windows desde:
   https://github.com/volatilityfoundation/volatility3/releases (ver sección "Symbols")
2. Monta el volumen symbols-data en tu sistema para escribir en él:
   ```bash
   docker run --rm -v volatiliweb_symbols-data:/symbols -v $(pwd)/mis_simbolos:/src \
     alpine cp -r /src/windows /symbols/
   ```
3. Verifica que Volatility los reconoce:
   ```bash
   docker exec volatiliweb-worker-1 \
     python -c "import volatility3.framework.constants as c; print(c.SYMBOL_BASEPATHS)"
   ```
4. La estructura esperada dentro del volumen es:
   `/symbols/windows/{nombre.pdb}/{GUID}/{nombre.pdb}.json.xz`

## Añadir nuevos plugins

1. Verifica que el plugin existe en la instalación de Volatility 3 con:
   ```bash
   python -m volatility3 -f <dump> <plugin.Name> --help
   ```
2. Añade una entrada al diccionario `PLUGIN_CATALOG` en `worker/app/tasks/plugin_tasks.py` con los campos: `name`, `display_name`, `description`, `class_path`, `os`
3. El sistema no requiere reinicio para detectar el nuevo plugin; el frontend obtiene el catálogo en tiempo real desde `GET /api/plugins`

## Comandos útiles

```bash
# Ver logs del worker en tiempo real
docker compose logs -f worker

# Acceder a la base de datos directamente
docker compose exec db psql -U volatiliweb -d volatiliweb_db

# Reiniciar solo el worker sin tocar la DB
docker compose restart worker

# Ejecutar los tests de integración (requiere fixtures)
docker compose exec web-api pytest tests/test_integration.py -v

# Apagar todo y limpiar volúmenes (DESTRUYE TODOS LOS DATOS)
docker compose down -v
```

## Solución de problemas

**El worker no detecta el OS del volcado**
> Verifica que las tablas de símbolos ISF están en el volumen `/symbols`.
> Consulta logs: `docker compose logs worker`

**Error "Plugin not found" al ejecutar un análisis**
> El plugin no está instalado en la versión de Volatility clonada.
> Verifica con: `docker compose exec worker python -m volatility3 --help`

**El upload falla en archivos grandes**
> Ajusta `MAX_UPLOAD_SIZE_MB` en `.env`.
> Verifica que hay espacio en el volumen `evidence-data`.

**La UI no se conecta a la API**
> Verifica que `VITE_API_URL` en `docker-compose.yml` apunta al host correcto.
> En macOS/Windows con Docker Desktop, usa `http://host.docker.internal:8000`.

[!IMPORTANT]
> Para soporte, revisa los issues del repositorio o abre uno nuevo con logs y detalles del entorno.
