# VolatiliWeb

## Requisitos previos

- Docker Engine 24.x o superior
- Docker Compose v2 (incluido en Docker Desktop)
- 8 GB de RAM minimo disponibles para Docker
- 50 GB de espacio en disco (para volcados y resultados)

## Instalacion y primer arranque

```bash
git clone <repo>
cd volatiliweb
cp .env.example .env
# Editar .env con tu POSTGRES_PASSWORD y SECRET_KEY seguros
docker compose up --build
# Primera vez: la build del worker descarga Volatility 3 (~2 min)
# Acceder a: http://localhost:3000
```

## Como anadir tablas de simbolos ISF

Las tablas de simbolos son necesarias para analizar volcados de Windows.
Sin ellas, Volatility 3 no puede resolver nombres de estructuras del kernel.

1. Descargar los ISF correspondientes a tu Windows desde:
   https://github.com/volatilityfoundation/volatility3/releases (ver seccion "Symbols")

2. Montar el volumen symbols-data en tu sistema para escribir en el:
   docker run --rm -v volatiliweb_symbols-data:/symbols -v $(pwd)/mis_simbolos:/src \
     alpine cp -r /src/windows /symbols/

3. Verificar que Volatility los reconoce:
   docker exec volatiliweb-worker-1 \
     python -c "import volatility3.framework.constants as c; print(c.SYMBOL_BASEPATHS)"

4. La estructura esperada dentro del volumen es:
   /symbols/windows/{nombre.pdb}/{GUID}/{nombre.pdb}.json.xz

## Como anadir nuevos plugins

1. Verificar que el plugin existe en la instalacion de Volatility 3 con:
   python -m volatility3 -f <dump> <plugin.Name> --help
2. Anadir una entrada al diccionario PLUGIN_CATALOG en worker/app/tasks/plugin_tasks.py
   con los campos: name, display_name, description, class_path, os
3. El sistema no requiere reinicio para detectar el nuevo plugin; el frontend
   obtiene el catalogo en tiempo real desde GET /api/plugins

## Comandos utiles

```bash
# Ver logs del worker en tiempo real
docker compose logs -f worker

# Acceder a la DB directamente
docker compose exec db psql -U volatiliweb -d volatiliweb_db

# Reiniciar solo el worker sin tocar la DB
docker compose restart worker

# Ejecutar los tests de integracion (requiere fixtures)
docker compose exec web-api pytest tests/test_integration.py -v

# Apagar todo y limpiar volumenes (DESTRUYE TODOS LOS DATOS)
docker compose down -v
```

## Troubleshooting

**El worker no detecta el OS del volcado**
-> Verificar que las tablas de simbolos ISF estan en el volumen /symbols.
-> Ver logs: docker compose logs worker

**Error "Plugin not found" al ejecutar un analisis**
-> El plugin no esta instalado en la version de Volatility clonada.
-> Verificar con: docker compose exec worker python -m volatility3 --help

**El upload se cae en archivos grandes**
-> Ajustar MAX_UPLOAD_SIZE_MB en .env
-> Verificar que hay espacio en el volumen evidence-data

**La UI no se conecta a la API**
-> Verificar que VITE_API_URL en docker-compose.yml apunta al host correcto.
-> En macOS/Windows con Docker Desktop, usar http://host.docker.internal:8000
