# Personal externo

En la ficha de Equipo, “Tipo de vínculo” permite elegir Staff o Externo. Está disponible en escritorio y celular para quienes ya pueden administrar Equipo. El filtro del directorio inicia en Staff y permite consultar Externos o Todos los vínculos.

Un externo conserva activo, sede, ficha, historial y acceso de usuario. Se excluye del conteo de staff, análisis de evaluaciones del staff, período de prueba, vacaciones, propuestas de cronogramas, selector operativo por sede e informes de dotación por sede. Continúa disponible como colaborador de proyectos y en el directorio de contactos. Esta clasificación no otorga ni revoca permisos.

La migración `20260929121804_personal_tipo_vinculo.sql` agrega `equipo.personas.tipo_vinculo` (`staff` o `externo`, obligatorio, predeterminado `staff`) y lo expone al final de `public.v_personas`. Conserva la definición previa de confidencialidad, opciones y permisos de la vista. No cambia RLS ni GRANT. Los nombres de puestos no determinan automáticamente el vínculo.

Para la asesora de Rosario: seleccionar Externo. No usar baja laboral ni cambiar su rol de acceso para resolver la clasificación. Volver a Staff revierte esta clasificación; no borra históricos ni encuadres previos. Los cronogramas ya exportados no se modifican: deben regenerarse.
