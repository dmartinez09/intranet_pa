# Especificación final para Claude: Inteligencia Comercial Beta

Este documento define el desarrollo completo del módulo **Inteligencia Comercial Beta** para la intranet de Point Andina. El módulo debe crearse como una entrada raíz del menú lateral principal, ubicada **debajo de Administración**, respetando exactamente el diseño, estructura, jerarquía visual, componentes, layout, estilos y comportamiento ya construidos en la intranet [image:1].

Claude no debe alterar ningún otro módulo ni rediseñar la intranet. Solo debe crear el módulo **Inteligencia Comercial Beta** y, dentro de él, únicamente dos vistas internas:

- **Inteligencia Comercial**
- **Mapa Interactivo**

La finalidad del módulo es consolidar información agrícola real de Perú, extraída desde fuentes peruanas oficiales o institucionales útiles para el equipo comercial, integrarla mediante procesos automáticos programados y almacenarla en **Azure SQL** para análisis histórico, tabular y geográfico [web:16][web:17][web:65][web:1].

## Ubicación exacta en la intranet

El módulo debe llamarse **Inteligencia Comercial Beta** y estar en la raíz del menú lateral principal, **debajo de Administración** [image:1]. No debe quedar dentro de Ventas Gerencia ni dentro de otro módulo existente [image:1].

## Estructura interna requerida

Dentro de **Inteligencia Comercial Beta** deben existir únicamente estos dos submódulos:

### Inteligencia Comercial

Vista analítica enfocada en filtros, KPIs, tablas, rankings, insights y trazabilidad de datos [web:16][web:17].

### Mapa Interactivo

Vista geográfica enfocada en regiones/departamentos del Perú, con filtros por cultivo, fuente y categoría comercial Point Andina [web:15][web:61].

## Alcance funcional del negocio

El módulo debe consolidar información útil para el equipo comercial sobre cultivos, hectáreas, superficie agrícola, estadísticas agrarias, resultados agropecuarios, indicadores territoriales y categorías asociadas al portafolio Point Andina [web:15][web:17][page:2]. La información debe provenir solo de fuentes peruanas y debe quedar almacenada con trazabilidad de origen, fecha de captura, fecha de publicación y fecha de carga [web:61][web:65].

## Cultivos objetivo iniciales

El modelo debe quedar preparado para múltiples cultivos, pero el MVP debe priorizar los siguientes, ya que fueron parte del requerimiento inicial y son comercialmente útiles para Point Andina:

- Papa [web:50]
- Tomate [web:50]
- Maíz [web:56]
- Arroz [web:56]
- Cebolla [web:50]
- Café [web:56]
- Palta [web:50]
- Cítricos [web:50]
- Uva [web:56]

## Categorías comerciales Point Andina

El módulo debe incorporar categorías alineadas al portafolio público de Point Andina, visible en su sitio web de productos [page:2]. Deben contemplarse como mínimo estas categorías:

- Fungicidas [page:2]
- Insecticidas [page:2]
- Herbicidas [page:2]
- Biológicos [page:2]
- Coadyuvantes [page:2]
- Certificación orgánica, cuando corresponda [page:2]

La estructura debe permitir extender categorías si el portafolio real publicado muestra más familias comerciales [page:2].

## Fuentes peruanas validadas para extracción

A continuación se detallan las fuentes revisadas, su utilidad, la URL exacta y el método de extracción recomendado tras validación técnica preliminar.

### 1. SIEA / MIDAGRI – Portal principal

- URL: `https://siea.midagri.gob.pe/portal/` [web:16]
- Utilidad: acceso general al ecosistema de estadísticas agrarias, dashboards e informativos [web:16][web:64]
- Tipo de fuente detectada: portal web institucional con páginas HTML y referencias a dashboards dinámicos [web:16]
- Método recomendado: usar como fuente de descubrimiento de recursos, no como única fuente tabular [web:16]
- Observación técnica: el portal expone navegación HTML y referencia a dashboards, pero en pruebas directas el host presentó tiempos de respuesta altos; por eso conviene usarlo como punto de entrada y combinarlo con páginas internas de descarga o documentos específicos [web:16]

### 2. SIEA / MIDAGRI – Datos y Estadísticas Agrarias

- URL: `https://siea.midagri.gob.pe/portal/publicaciones/informacion-estadistica` [web:17]
- Utilidad: acceso a boletines diarios, mensuales y anuales [web:17]
- Tipo de fuente detectada: HTML institucional con navegación clara a publicaciones [page:1]
- Método recomendado: scraping controlado de HTML para detección de enlaces a publicaciones y documentos; luego descarga de archivos asociados si existen [page:1]
- Qué extraer:
  - tipo de boletín
  - periodicidad
  - título del documento
  - URL del recurso asociado
  - fecha de captura
  - fecha de publicación, si aparece
- Observación técnica: la página contiene texto navegable de categorías de boletines, lo que la hace útil como índice de extracción [page:1]

### 3. SIEA / MIDAGRI – Superficie Agrícola Oficial

- URL: `https://siea.midagri.gob.pe/portal/informativos/superficie-agricola-peruana` [web:15]
- Utilidad: superficie agrícola del Perú, información tabular y referencia a mapa vectorial actualizado al 2024 [web:15]
- Tipo de fuente detectada: página HTML con enlaces de descarga temática, incluyendo shape y recursos tabulares [page:2]
- Método recomendado: scraping de HTML para identificar enlaces de descarga; descarga de archivos geográficos o tabulares; carga posterior a staging [page:2]
- Qué extraer:
  - nombre del recurso temático
  - cobertura geográfica
  - año o rango temporal
  - tipo de archivo
  - URL de descarga
  - metadata de actualización
- Observación técnica: la página anuncia explícitamente “Superficie Agrícola Tabular” y “Mapa Vectorial”, además de descargas SHAPE, lo cual la convierte en una fuente estratégica para el submódulo Mapa Interactivo [web:15][page:2]

### 4. MIDAGRI – Anuarios de estadísticas de producción agropecuaria

- URL: `https://www.gob.pe/institucion/midagri/colecciones/5149-anuarios-estadisticas-de-produccion-agropecuaria` [web:19]
- Utilidad: series históricas, producción agropecuaria y documentos de referencia sectorial [web:19]
- Tipo de fuente detectada: página de colección en Gob.pe con publicaciones enlazadas [web:19]
- Método recomendado: scraping estructurado de HTML para listar publicaciones y descargar archivos PDF asociados [web:19]
- Qué extraer:
  - año del anuario
  - título
  - URL del documento
  - tipo de archivo
  - fecha de captura
- Observación técnica: ideal para carga semanal o mensual, no necesariamente diaria [web:19]

### 5. INEI – Resultados de la Encuesta Nacional Agropecuaria (ENA)

- URL de página: `https://www.gob.pe/institucion/inei/informes-publicaciones/6879473-productores-agropecuarios-principales-resultados-de-la-encuesta-nacional-agropecuaria-ena-2018-2019-y-2022-2024` [web:67]
- PDF detectado en la página: `https://cdn.www.gob.pe/uploads/document/file/8237929/6879473-productores-agropecuarios-principales-resultados-de-la-encuesta-nacional-agropecuaria-ena-2018-2019-y-2022-2024%282%29.pdf?v=1750438114` [web:67]
- Utilidad: resultados agregados de la ENA, caracterización de productores y unidades agropecuarias [web:67]
- Tipo de fuente detectada: HTML institucional con archivo PDF descargable incrustado/referenciado en enlaces [web:67]
- Método recomendado: extracción desde HTML para detectar el PDF oficial y luego parsing del PDF con pipeline documental [web:67]
- Qué extraer:
  - título del informe
  - período cubierto
  - enlace del PDF
  - tablas o cifras clave de productores y superficie
  - fecha de publicación
- Validación técnica: en pruebas de inspección HTML se detectó un enlace PDF directo alojado en `cdn.www.gob.pe`, por lo que sí existe una ruta descargable verificable [web:67]

### 6. Datos Abiertos Perú – ENA 2024

- URL: `https://datosabiertos.gob.pe/dataset/encuesta-nacional-agropecuaria-ena-2024-instituto-nacional-de-estad%C3%ADstica-e-inform%C3%A1tica-inei` [web:73]
- Utilidad: potencial fuente estructurada para conjuntos de datos abiertos vinculados a la ENA [web:73]
- Tipo de fuente detectada: portal nacional de datos abiertos con metadatos dataset [web:73]
- Método recomendado: revisar dataset y recursos internos; priorizar descarga directa de archivos estructurados si están expuestos; usar API CKAN si está disponible en el portal [web:73]
- Qué extraer:
  - nombre del dataset
  - recursos asociados
  - formato de cada recurso
  - URL de descarga
  - fecha de actualización del dataset
- Observación técnica: esta fuente puede ser superior al PDF cuando tenga recursos tabulares; Claude debe verificar en la implementación si hay CSV/XLS/JSON descargables y priorizarlos sobre el PDF [web:73]

### 7. SENASA – Portal institucional

- URL: `https://www.gob.pe/senasa` [web:1]
- Utilidad: puerta de entrada a registros, trámites y contenidos sanitarios del sector agrario [web:1]
- Tipo de fuente detectada: HTML institucional en Gob.pe [web:1]
- Método recomendado: usar como fuente raíz para descubrir secciones especializadas, no como origen tabular primario [web:1]

### 8. SENASA – Reportes o registros

- URL: `https://www.gob.pe/institucion/senasa/tema/reportes-o-registros` [web:62]
- Utilidad: acceso a reportes, servicios y registros administrativos o técnicos [web:62]
- Tipo de fuente detectada: HTML institucional con múltiples enlaces internos [web:62]
- Método recomendado: scraping de HTML y catalogación de enlaces relevantes; clasificación por tipo de servicio o registro [web:62]
- Validación técnica: en pruebas HTML se encontraron más de 250 enlaces y referencias internas, además de al menos un archivo PDF en Active Storage, lo que demuestra que la página puede ser recorrida automáticamente para detectar recursos descargables [web:62]
- Qué extraer:
  - nombre del registro/reporte
  - URL
  - tipo de recurso
  - categoría sanitaria o administrativa
  - fecha de captura

### 9. SENASA – SIGIA consulta cultivo

- URL: `https://servicios.senasa.gob.pe/SIGIAWeb/sigia_consulta_cultivo.html` [web:66]
- Utilidad: consulta vinculada a cultivos dentro de la plataforma SIGIA [web:66]
- Tipo de fuente detectada: servicio web especializado orientado a consulta [web:66]
- Método recomendado: inspección técnica del frontend para determinar si consume parámetros, JSON interno o formularios HTTP; si no expone API pública, automatizar la consulta vía navegador o scraping controlado [web:66]
- Qué extraer potencialmente:
  - cultivos disponibles en consulta
  - catálogos relacionados
  - identificadores o parámetros de búsqueda
- Observación técnica: esta fuente merece validación adicional dentro del proyecto porque puede exponer catálogos de alto valor para homologación de cultivos [web:66]

### 10. Point Andina – Productos

- URL: `https://pointandina.pe/productos/` [web:44]
- Utilidad: catálogo público para clasificar categorías comerciales alineadas a la empresa [web:44][page:2]
- Tipo de fuente detectada: sitio web público con protección `Mod_Security` frente a ciertas solicitudes automatizadas [web:44]
- Método recomendado: si el sitio bloquea scraping directo con `406 Not Acceptable`, usar una de estas vías:
  - extracción desde el navegador real del usuario o desde el frontend autorizado,
  - carga manual inicial de categorías base desde catálogo público validado,
  - mantenimiento interno de una tabla maestra de categorías Point Andina sincronizada manualmente o con proceso controlado.
- Validación técnica: las pruebas HTTP directas devolvieron error 406 por protección del servidor, por lo que **no debe dependerse** de scraping automatizado frágil como mecanismo principal de producción para esta fuente.
- Recomendación final: usar el sitio como referencia de negocio, pero mantener las categorías Point Andina en una tabla maestra interna de Azure SQL para estabilidad operativa [web:44][page:2]

## Método de extracción recomendado por tipo de fuente

La estrategia no debe ser única para todas las fuentes. Debe elegirse el mejor método según la disponibilidad real detectada en cada web.

| Fuente | Método preferido | Método alternativo | Uso principal |
|---|---|---|---|
| SIEA índice de estadísticas [web:17] | Scraping HTML controlado | Navegación por sitemap/manual seed | Descubrir boletines y recursos |
| SIEA superficie agrícola [web:15] | Scraping + descarga de archivos | Ingesta manual inicial si cambia estructura | Tabular + geoespacial |
| MIDAGRI anuarios [web:19] | Scraping HTML + descarga PDF | Carga documental manual asistida | Histórico anual |
| INEI ENA página [web:67] | Parseo HTML para detectar PDF | Datos Abiertos Perú [web:73] | Estadística estructural |
| Datos Abiertos Perú [web:73] | Recursos dataset / CKAN si existe | PDF/HTML complementario | Dataset estructurado |
| SENASA registros [web:62] | Catálogo HTML de enlaces | Automatización navegador | Registros sanitarios / apoyo |
| SENASA SIGIA [web:66] | Inspección técnica de consultas | Browser automation | Catálogos o validación de cultivos |
| Point Andina catálogo [web:44] | Tabla maestra interna | Extracción manual controlada | Categorías comerciales |

## Datos que deben extraerse y almacenarse

Claude debe definir el pipeline para extraer y persistir como mínimo los siguientes tipos de datos, cuando la fuente los provea:

### Metadata de fuente

- source_name
- source_url
- source_type
- extraction_method
- extraction_status
- last_checked_at
- last_success_at

### Metadata documental

- document_title
- document_url
- document_type
- publication_date
- capture_date
- coverage_level
- period_label

### Datos agrícolas y territoriales

- country
- department
- province, si existe
- district, si existe
- crop_name
- crop_standard_name
- crop_group
- agricultural_surface_hectares
- production_indicator
- campaign_period
- year
- month, si aplica

### Datos comerciales derivados

- point_category
- opportunity_score
- opportunity_level
- recommended_focus
- business_note

### Datos geográficos

- region_code
- geometry_type
- geometry_source
- shapefile_url o vector_url
- centroid_lat
- centroid_lon

## Diseño de almacenamiento en Azure SQL

La solución debe almacenar la información integrada en **Azure SQL** usando tablas normalizadas y trazables. Se recomienda como mínimo este modelo lógico:

### Tabla: `dim_source`

- source_id
- source_name
- source_url
- source_owner
- source_country
- source_type
- extraction_method
- active_flag

### Tabla: `dim_crop`

- crop_id
- crop_name_raw
- crop_name_standard
- crop_group
- active_flag

### Tabla: `dim_region`

- region_id
- country_name
- department_name
- province_name
- district_name
- region_code
- latitude
- longitude

### Tabla: `dim_point_category`

- category_id
- category_name
- category_group
- source_reference
- active_flag

### Tabla: `fact_agri_market_snapshot`

- snapshot_id
- source_id
- crop_id
- region_id
- category_id
- document_title
- document_url
- publication_date
- capture_date
- period_label
- year
- month
- hectares
- production_value
- opportunity_score
- opportunity_level
- business_note
- record_hash
- created_at

### Tabla: `fact_geo_resource`

- geo_id
- source_id
- region_id
- resource_name
- resource_url
- resource_type
- reference_year
- capture_date
- geometry_metadata

### Tabla: `etl_run_log`

- run_id
- pipeline_name
- source_id
- started_at
- finished_at
- status
- records_read
- records_inserted
- records_updated
- error_message

### Tabla: `stg_raw_document`

- raw_id
- source_id
- source_url
- file_url
- file_type
- raw_payload_location
- checksum
- captured_at

## Frecuencia operativa recomendada

La solución debe programar actualizaciones automáticas en la noche o semanalmente, según la naturaleza de cada fuente [web:17][web:19]. La recomendación operativa es la siguiente:

- **Diario nocturno** para páginas índice, detección de nuevos boletines y cambios en recursos HTML [web:17][web:62]
- **Semanal** para descargas de documentos, datasets y reprocesamiento de fuentes de menor frecuencia [web:19][web:67][web:73]
- **Bajo demanda** para catálogos internos como categorías Point Andina [web:44]

## Orquestación recomendada

Claude debe implementar o dejar preparado un mecanismo de orquestación compatible con el stack actual de la intranet para:

1. consultar fuentes,
2. identificar nuevos recursos,
3. descargar archivos,
4. parsear HTML/PDF/datasets,
5. normalizar cultivos y regiones,
6. clasificar categorías Point Andina,
7. calcular score,
8. cargar a Azure SQL,
9. registrar logs y auditoría.

Si el stack lo permite, se recomienda separar estas capas:

- **Collectors** por fuente
- **Parsers** por tipo de recurso
- **Normalizers** de cultivo/región
- **Loaders** hacia Azure SQL
- **Jobs programados** nocturnos y semanales

## Reglas de decisión para extracción

Claude debe aplicar estas reglas al implementar el pipeline:

1. Si existe recurso tabular descargable oficial, priorizarlo sobre PDF [web:73][web:15].
2. Si solo existe PDF oficial, descargarlo y extraer tablas o cifras relevantes con parser documental [web:67].
3. Si existe HTML con enlaces a recursos, usarlo como índice de descubrimiento [page:1][web:62].
4. Si una fuente bloquea scraping automatizado, no construir una dependencia crítica de producción sobre esa fuente; reemplazarla por tabla maestra interna o proceso manual controlado [web:44].
5. Registrar siempre fuente exacta, URL exacta, fecha de captura y resultado del proceso [web:61][web:65].

## Validación de método por fuente

Con base en la revisión técnica preliminar, la mejor estrategia es esta:

- **SIEA**: usar HTML como índice y consumir documentos/recursos descargables asociados cuando aparezcan [web:17][web:15].
- **MIDAGRI anuarios**: usar scraping de colección y procesamiento documental periódico [web:19].
- **INEI ENA**: usar enlace PDF oficial detectado y, si el dataset de Datos Abiertos expone archivos estructurados, priorizarlos [web:67][web:73].
- **SENASA**: usar catálogo HTML y exploración dirigida de secciones de consulta/registro [web:62][web:66].
- **Point Andina**: usar tabla maestra interna, no scraping automático como dependencia principal, por el bloqueo 406 observado en pruebas HTTP [web:44].

## Requisitos de interfaz para trazabilidad

En las vistas **Inteligencia Comercial** y **Mapa Interactivo**, la interfaz debe mostrar de forma visible:

- fuente del dato,
- fecha de publicación,
- fecha de última captura,
- fecha de última actualización en Azure SQL,
- método de extracción o tipo de origen, cuando sea relevante.

Esto es importante para que el equipo comercial confíe en la trazabilidad y vigencia de la información [web:61][web:65].

## Qué debe hacer Claude

Claude debe entregar una solución que:

- cree el módulo raíz **Inteligencia Comercial Beta** debajo de Administración [image:1],
- respete al 100% el diseño actual de la intranet [image:1],
- implemente solo los submódulos **Inteligencia Comercial** y **Mapa Interactivo**,
- integre fuentes reales de Perú [web:16][web:17][web:65][web:1],
- use el mejor método de extracción según la fuente,
- almacene los datos en Azure SQL,
- programe cargas nocturnas o semanales,
- registre logs de extracción y auditoría,
- deje el sistema preparado para crecimiento futuro.

## Qué no debe hacer Claude

Claude no debe:

- rediseñar la intranet,
- mover módulos existentes,
- usar fuentes no peruanas para la data principal,
- depender de scraping frágil para Point Andina si hay bloqueo del servidor [web:44],
- dejar la solución sin persistencia en base de datos,
- construir más pantallas que las solicitadas.

## Instrucción final para Claude

Implementa un nuevo módulo raíz llamado **Inteligencia Comercial Beta** debajo de **Administración** en la intranet, respetando totalmente el diseño y arquitectura existentes [image:1]. Dentro del módulo crea solo dos submódulos: **Inteligencia Comercial** y **Mapa Interactivo**. Integra únicamente fuentes reales de Perú para construir una base de inteligencia comercial agrícola, priorizando SIEA/MIDAGRI, MIDAGRI publicaciones, INEI, Datos Abiertos Perú y SENASA [web:16][web:17][web:19][web:67][web:73][web:62]. Valida el mejor método de extracción por fuente, prefiriendo archivos tabulares oficiales cuando existan, HTML como índice de descubrimiento, PDF como respaldo documental y tablas maestras internas cuando la fuente no sea técnicamente estable para scraping de producción [web:15][page:1][web:67][web:44]. Toda la información extraída debe almacenarse en Azure SQL con histórico, logs de ejecución, trazabilidad de origen y fechas de actualización, y debe poder actualizarse automáticamente mediante procesos nocturnos o semanales [web:61][web:65][web:17].
