# Proyecto para Claude: Inteligencia Comercial Beta

Este documento define de forma integral el proyecto que debe desarrollar Claude dentro de la intranet de Point Andina. Antes de construir el módulo, Claude debe analizar y dejar implementada la mejor estrategia de conexión, extracción, normalización, almacenamiento y exposición de datos para asegurar que la solución sea estable, trazable y útil para el equipo comercial. La interfaz final debe integrarse a la intranet existente sin alterar su diseño, estructura ni módulos actuales [image:1].

## Objetivo general

Claude debe crear un nuevo módulo raíz llamado **Inteligencia Comercial Beta**, ubicado en el menú lateral principal **debajo de Administración**, respetando al 100% la arquitectura, componentes, estilos, layout, navegación y comportamiento ya construidos en la intranet [image:1]. Dentro de ese módulo deben existir únicamente dos submódulos internos:

- **Inteligencia Comercial**
- **Mapa Interactivo**

El propósito del módulo es consolidar información agrícola real de Perú desde fuentes oficiales e institucionales, extraerla con el método técnicamente más adecuado en cada caso, almacenarla en **Azure SQL**, y presentarla en la intranet para apoyar decisiones comerciales por cultivo, región y categoría asociada al portafolio de Point Andina [web:16][web:17][web:67][web:62].

## Regla principal de alcance

Claude debe trabajar **solo** dentro del módulo **Inteligencia Comercial Beta**. No debe modificar otros módulos, no debe rediseñar la intranet, no debe cambiar la paleta de colores, no debe tocar componentes globales y no debe alterar flujos ya existentes [image:1]. Todo debe verse y comportarse como parte nativa del sistema actual [image:1].

## Paso obligatorio previo: análisis técnico de conexión y extracción

Antes de escribir el módulo final, Claude debe revisar las fuentes priorizadas y decidir el método de conexión y extracción más estable para cada una. No debe asumir un método único para todas las webs. Debe validar si cada fuente ofrece HTML navegable, enlaces a PDF, datasets, archivos descargables, consultas web, endpoints JSON o estructuras de datos reutilizables [web:17][web:15][web:67][web:73][web:62].

La regla es simple: **la mejor fuente no es la más visible, sino la más estable, estructurada y automatizable** [web:96].

## Fuentes prioritarias a integrar

Claude debe considerar como fuentes principales únicamente sitios de Perú y privilegiar fuentes oficiales o institucionales útiles para el análisis comercial:

### SIEA / MIDAGRI

- Portal principal: `https://siea.midagri.gob.pe/portal/` [web:16]
- Datos y estadísticas agrarias: `https://siea.midagri.gob.pe/portal/publicaciones/informacion-estadistica` [web:17]
- Superficie agrícola oficial: `https://siea.midagri.gob.pe/portal/informativos/superficie-agricola-peruana` [web:15]
- Qué aporta: superficie agrícola, boletines, publicaciones, informativos, recursos tabulares y geográficos [web:15][web:17]
- Método preferido: scraping HTML controlado como índice + descarga de recursos asociados [page:1][page:2]
- Riesgo detectado: tiempos de respuesta altos en algunas solicitudes directas, por lo que conviene desacoplar descubrimiento y procesamiento [web:16]

### MIDAGRI / Gob.pe

- Anuarios: `https://www.gob.pe/institucion/midagri/colecciones/5149-anuarios-estadisticas-de-produccion-agropecuaria` [web:19]
- Qué aporta: documentos históricos, anuarios y publicaciones estadísticas [web:19]
- Método preferido: scraping de colección HTML + descarga documental [web:19]
- Frecuencia sugerida: semanal o mensual [web:19]

### INEI

- Página ENA: `https://www.gob.pe/institucion/inei/informes-publicaciones/6879473-productores-agropecuarios-principales-resultados-de-la-encuesta-nacional-agropecuaria-ena-2018-2019-y-2022-2024` [web:67]
- Dataset abierto ENA 2024: `https://datosabiertos.gob.pe/dataset/encuesta-nacional-agropecuaria-ena-2024-instituto-nacional-de-estad%C3%ADstica-e-inform%C3%A1tica-inei` [web:73]
- Qué aporta: resultados de encuesta agropecuaria, estructura del agro, productores, superficie y datos potencialmente tabulares [web:67][web:73]
- Método preferido: priorizar recursos estructurados del portal de datos abiertos si existen; usar PDF oficial como respaldo documental [web:73][web:67]
- Validación realizada: la página de INEI contiene un PDF oficial descargable enlazado desde Gob.pe [web:67]

### SENASA

- Portal principal: `https://www.gob.pe/senasa` [web:1]
- Reportes o registros: `https://www.gob.pe/institucion/senasa/tema/reportes-o-registros` [web:62]
- SIGIA consulta cultivo: `https://servicios.senasa.gob.pe/SIGIAWeb/sigia_consulta_cultivo.html` [web:66]
- Qué aporta: registros, servicios, catálogos de consulta, información sanitaria y referencias útiles para homologación o validación agraria [web:62][web:66]
- Método preferido: HTML crawling dirigido para catálogos y registros; validación técnica del frontend SIGIA para determinar si consume parámetros o recursos estructurados [web:62][web:66]
- Validación realizada: la página de reportes/registros posee estructura HTML navegable con múltiples enlaces útiles para catalogación automática [web:62]

### Plataforma Nacional de Datos Abiertos

- Portal: `https://www.gob.pe/datosabiertos` [web:96]
- Qué aporta: datasets gubernamentales estandarizados, generalmente en formatos como CSV [web:96]
- Método preferido: priorizar datasets abiertos estructurados frente a scraping de páginas narrativas [web:96]
- Uso esperado: fuente auxiliar para encontrar recursos más robustos que PDF o HTML de solo lectura [web:96]

### Point Andina

- Productos: `https://pointandina.pe/productos/` [web:44]
- Qué aporta: referencia comercial para categorías del portafolio [web:44][page:2]
- Método preferido: **no usar scraping automatizado como dependencia crítica**, porque las pruebas técnicas detectaron bloqueo 406 por protección del servidor [web:44]
- Estrategia final: cargar y mantener categorías Point Andina en una tabla maestra interna en Azure SQL [web:44][page:2]

## Decisión técnica por método de conexión y extracción

Claude debe tomar estas decisiones de implementación como base del proyecto.

### Método 1: HTML indexado

Usar cuando la página funciona como catálogo de enlaces o índice de publicaciones. Aplica bien a SIEA, MIDAGRI y SENASA [web:17][web:19][web:62].

#### Qué hacer

- Leer el HTML.
- Detectar enlaces relevantes.
- Clasificar recursos por tipo.
- Registrar nuevas URLs detectadas.
- Encolar descarga o procesamiento posterior.

#### Cuándo usarlo

- Cuando no exista API pública clara.
- Cuando la página organice documentos o recursos descargables.
- Cuando el valor principal sea descubrir fuentes secundarias.

### Método 2: Descarga de PDF y parsing documental

Usar cuando la información oficial se publique en informes o boletines PDF, como sucede en INEI y algunas publicaciones del Estado [web:67][web:19].

#### Qué hacer

- Descargar el PDF oficial.
- Guardar el archivo bruto o referencia de almacenamiento.
- Extraer tablas, cifras y metadata relevante.
- Registrar el origen exacto del documento.

#### Cuándo usarlo

- Cuando no haya dataset estructurado.
- Cuando el PDF sea el soporte oficial de publicación.
- Cuando el documento tenga valor analítico o histórico.

### Método 3: Dataset estructurado o datos abiertos

Usar cuando el portal exponga archivos CSV, XLSX, JSON o datasets consultables, como sugiere la Plataforma Nacional de Datos Abiertos [web:96].

#### Qué hacer

- Priorizar el recurso estructurado frente al PDF.
- Consumirlo directamente.
- Versionarlo por fecha de captura.
- Homologar columnas y cargarlo a staging.

#### Cuándo usarlo

- Siempre que exista una alternativa oficial descargable y estructurada.
- Especialmente para cargas periódicas y escalables.

### Método 4: Consulta web especializada

Usar cuando la fuente expone formularios o páginas especializadas, como SIGIA de SENASA [web:66].

#### Qué hacer

- Inspeccionar requests del frontend.
- Validar si existen parámetros GET/POST o archivos JSON auxiliares.
- Si no existe API pública, automatizar la consulta de forma controlada.

#### Cuándo usarlo

- Para catálogos, listas de cultivos o validaciones específicas.
- Nunca como primera opción si existe dataset estructurado equivalente.

### Método 5: Tabla maestra interna

Usar cuando la fuente es comercial, de consulta poco estable o protegida contra automatización, como el catálogo de Point Andina [web:44].

#### Qué hacer

- Crear tabla maestra en Azure SQL.
- Cargar categorías comerciales validadas.
- Mantener proceso manual o asistido de actualización.

#### Cuándo usarlo

- Cuando scraping productivo no sea fiable.
- Cuando la data cambie poco y deba tener estabilidad operativa.

## Regla de prioridad entre métodos

Claude debe seguir esta prioridad:

1. Dataset estructurado oficial [web:96][web:73]
2. Recurso tabular descargable oficial [web:15]
3. HTML índice con enlaces a recursos [web:17][web:62]
4. PDF oficial [web:67][web:19]
5. Automatización de consultas web [web:66]
6. Tabla maestra interna para fuentes no estables o comerciales [web:44]

## Arquitectura funcional del proyecto

Claude debe construir el proyecto con dos capas claras:

### Capa 1: Integración y almacenamiento

Responsable de conectar fuentes, extraer información, normalizarla y cargarla a Azure SQL [web:95].

### Capa 2: Exposición en intranet

Responsable de mostrar los datos en el módulo **Inteligencia Comercial Beta** mediante las dos vistas solicitadas, respetando el diseño actual de la intranet [image:1].

## Diseño mínimo del backend o capa de servicios

Claude debe crear o dejar listo un conjunto de componentes equivalentes a los siguientes:

- `source_registry` o catálogo de fuentes
- `collectors` por fuente
- `parsers` por tipo de archivo
- `normalizers` para cultivos y regiones
- `category_mapper` para categorías Point Andina
- `sql_loaders` para Azure SQL
- `job_scheduler` o integración con el programador ya existente
- `etl_run_log` o servicio de auditoría

Claude debe adaptar estos nombres al stack real del proyecto, pero debe mantener este diseño conceptual.

## Azure SQL como destino

Toda la data validada debe almacenarse en **Azure SQL**. Claude debe crear tablas de staging, dimensiones, hechos y logs. El diseño debe permitir histórico y trazabilidad, no solo la última foto [web:95].

### Tablas mínimas sugeridas

- `dim_source`
- `dim_crop`
- `dim_region`
- `dim_point_category`
- `stg_raw_document`
- `stg_raw_record`
- `fact_agri_market_snapshot`
- `fact_geo_resource`
- `etl_run_log`

## Datos mínimos a persistir

### Metadata de extracción

- fuente
- url_origen
- método_extracción
- fecha_captura
- fecha_publicación
- estado_proceso
- mensaje_error

### Datos agrícolas

- cultivo
- cultivo_normalizado
- región
- provincia, si existe
- hectáreas
- indicador_productivo, si existe
- campaña
- año
- mes, si aplica

### Datos comerciales derivados

- categoría_point
- score_oportunidad
- prioridad_comercial
- insight_comercial

### Datos geográficos

- código_región
- tipo_recurso_geo
- url_recurso_geo
- latitud
- longitud
- metadata_geográfica

## Lógica de negocio para Point Andina

El módulo debe enfocarse en cultivos relevantes para el negocio, incluyendo como base inicial:

- papa [web:50]
- tomate [web:50]
- maíz [web:56]
- arroz [web:56]
- cebolla [web:50]
- café [web:56]
- palta [web:50]
- cítricos [web:50]
- uva [web:56]

Las categorías comerciales de Point Andina deben partir, como mínimo, de:

- fungicidas [page:2]
- insecticidas [page:2]
- herbicidas [page:2]
- biológicos [page:2]
- coadyuvantes [page:2]
- certificación orgánica [page:2]

Claude debe mapear cultivos a categorías comerciales sugeridas de forma configurable, nunca quemando lógica rígida en el frontend.

## Procesamiento programado

Claude debe dejar implementado o preparado un proceso automático con dos ritmos de ejecución:

- **Nocturno diario** para discovery de nuevas URLs, validación de cambios y revisión de fuentes HTML [web:17][web:62]
- **Semanal** para procesamiento pesado de PDFs, datasets y refresco de agregaciones [web:19][web:67][web:73]

Cada ejecución debe registrar logs, cantidad de registros procesados, errores y resultados.

## Submódulo 1: Inteligencia Comercial

Esta vista debe servir como panel analítico para el equipo comercial.

### Debe incluir

- filtros por cultivo, región, período, fuente y categoría Point Andina,
- KPIs,
- tabla analítica principal,
- ranking de cultivos o regiones,
- fecha de última actualización,
- fuente visible por registro o por bloque analítico,
- exportación si el patrón ya existe en la intranet.

### Debe mostrar como mínimo

- región,
- cultivo,
- hectáreas,
- fuente,
- fecha,
- categoría Point,
- score,
- prioridad,
- observación comercial.

## Submódulo 2: Mapa Interactivo

Esta vista debe permitir explorar el Perú por región o departamento con filtros y capas temáticas [web:15].

### Debe incluir

- mapa integrado al layout actual,
- filtros por cultivo, fuente, período y categoría,
- tooltips o panel lateral,
- visualización por score, superficie o prioridad,
- trazabilidad de origen del dato.

### Debe conectarse a

- tablas geográficas,
- snapshots cargados en Azure SQL,
- recursos espaciales provenientes de SIEA o fuentes equivalentes [web:15][page:2].

## Criterios de calidad del proyecto

Claude debe garantizar que:

- el módulo se integre sin romper la intranet [image:1],
- la extracción sea trazable por fuente [web:61][web:65],
- el método de conexión sea el adecuado para cada sitio [web:17][web:67][web:62][web:44],
- Azure SQL conserve histórico,
- la interfaz permita confiar en la vigencia y origen del dato,
- las categorías de Point Andina no dependan de scraping inestable [web:44],
- los dos submódulos sean los únicos visibles dentro de Inteligencia Comercial Beta [image:1].

## Qué no debe hacer Claude

- No crear más módulos o páginas.
- No tocar Ventas Gerencia ni otros menús.
- No cambiar colores o diseño global [image:1].
- No depender exclusivamente de scraping frágil para fuentes bloqueadas [web:44].
- No dejar datos sin trazabilidad.
- No usar fuentes no peruanas para el núcleo de información.

## Instrucción final para Claude

Antes de desarrollar la interfaz, analiza técnicamente cada fuente priorizada y selecciona el mejor método de conexión y extracción para cada una. Luego construye el módulo raíz **Inteligencia Comercial Beta** debajo de **Administración**, con solo dos submódulos: **Inteligencia Comercial** y **Mapa Interactivo** [image:1]. Integra datos reales de Perú desde SIEA/MIDAGRI, MIDAGRI, INEI, Datos Abiertos Perú y SENASA [web:16][web:17][web:19][web:67][web:73][web:62]. Prioriza datasets estructurados, luego recursos tabulares oficiales, luego HTML índice y finalmente PDF o consultas especializadas según disponibilidad real [web:96][web:15][web:17][web:67][web:66]. Almacena todo en Azure SQL con histórico, logs y trazabilidad, y expón la información dentro de la intranet respetando totalmente su diseño y arquitectura actuales [web:95][image:1].
