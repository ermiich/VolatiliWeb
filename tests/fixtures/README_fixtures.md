# Como obtener volcados de prueba para los tests

El directorio tests/fixtures/ requiere un archivo de volcado de memoria real para
que los tests de integracion funcionen. Por razones de tamano no se incluye en el repo.

## Opciones (ordenadas por facilidad)

### Opcion 1: MemLabs (recomendado para CI)
Los autores de MemLabs proveen imagenes pequenas para aprendizaje.
Descargar desde: https://github.com/stuxnet999/MemLabs
Colocar el archivo como: tests/fixtures/test.mem

### Opcion 2: Volatility 3 sample images
El repositorio oficial de Volatility Foundation incluye imagenes de prueba.
https://github.com/volatilityfoundation/volatility3/wiki/Windows-Symbol-Tables

### Opcion 3: Crear uno propio con WinPmem
Si tenes una VM Windows disponible, usar WinPmem para crear un volcado pequeno:
https://github.com/Velocidex/WinPmem
Colocar el archivo como: tests/fixtures/test.mem

## Nota sobre simbolos ISF
Para que Volatility 3 pueda analizar el volcado, necesitas las tablas de simbolos
correspondientes al kernel del Windows del volcado.
Ver README.md seccion "Tablas de Simbolos" para instrucciones detalladas.
