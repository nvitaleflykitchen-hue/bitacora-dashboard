# Sectores internos de credenciales

Catálogo aprobado el 16/10/2026. Disponible sólo para las sedes asignadas a la persona: Aeropuerto de Córdoba y Planta de Producción Córdoba. No sustituye permisos PSA.

| Letra | Sector | Sedes | ZRA |
|---|---|---|---|
| A | Administración y oficinas | Ambas | No |
| B | Cocina y producción primaria | Ambas | No |
| C | Depósitos de materias primas | Ambas | No |
| D | Armado de catering aeroportuario, cámaras de producto terminado y trolleys | Ambas | Sí |
| G | Despacho aeroportuario y dársena | Ambas | Sí |
| H | Lavado, retornos y residuos | Ambas | No |
| I | Área técnica y mantenimiento | Ambas | No |
| J | Armado fábricas | Planta | No |
| K | Cocina caliente | Planta | No |
| L | Carnicería | Planta | No |
| M | Pastelería | Planta | No |
| Z | Acceso total a los sectores de esa sede, incluido ZRA | Ambas | Sí |

E y F no se utilizan. Z se imprime en rojo y requiere autorización individual expresa. Al seleccionarla se retiran las demás letras de la misma sede; elegir una letra individual retira Z. La selección de otra sede no cambia. El servidor rechaza Z junto con otras letras de la misma sede.

Las 179 credenciales existentes quedaron intactas al aplicar la migración: se comparó su contenido completo antes y después. Los registros numéricos permanecen activos únicamente para la validación de emisiones históricas; no se ofrecen ni se aceptan para nuevas emisiones. No hay conversión automática de 04/05 a D ni asignación automática de Z. Para pasar a letras, el administrador retira la selección anterior, selecciona los accesos aprobados, confirma y reemite. La reemisión invalida la credencial anterior mediante el flujo existente.

La migración modifica el catálogo y la validación de negocio; no cambia GRANT, RLS ni políticas de seguridad. El catálogo se mantiene versionado mediante migraciones, no mediante un editor libre de sectores.
