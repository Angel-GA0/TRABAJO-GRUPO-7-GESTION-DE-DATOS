# Sistema de análisis, proyección y alerta de matrícula escolar en Junín

Aplicación web local orientada a analizar la evolución 2021–2024, comparar territorios y niveles, generar una proyección tendencial referencial 2025–2026 y priorizar señales para revisión.

## Ejecución en Windows

1. Descomprima la carpeta completa.
2. Abra `iniciar_app.bat`.
3. La primera ejecución instalará las dependencias de Python dentro de `.venv`.
4. El sistema se abrirá en `http://127.0.0.1:8000`.

No requiere Node.js porque la interfaz React ya está compilada.

## Módulos

- Resumen general.
- Evolución histórica y comparación entre cualquier par de años.
- Proyección tendencial referencial 2025–2026 con validación retrospectiva.
- Alertas y priorización territorial explicables.
- Metodología, trazabilidad y controles de calidad.

## Arquitectura

- Interfaz: React + TypeScript.
- Visualización: Apache ECharts.
- API y servidor local: FastAPI.
- Procesamiento: Pandas y NumPy.
- Exportación: Excel mediante openpyxl.

## Interpretación

Las proyecciones y alertas son referenciales. Deben contrastarse con información cualitativa y territorial de la UGEL o autoridad educativa.
