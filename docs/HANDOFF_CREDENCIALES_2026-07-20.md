# Traspaso para continuar el trabajo — Credenciales de personal

Fecha del traspaso: 2026-07-20
Proyecto: Fly Gestión / Fly Kitchen
Repositorio local: `C:\Users\nicol\OneDrive\Desktop\Mantenimiento\bitacora-dashboard`

## 1. Reglas operativas críticas

- Leer primero `AGENTS.md` y respetarlo completo.
- El proyecto Supabase correcto es exclusivamente `mixyhfdlzjarvszinytk` (`cerdova-db`).
- No ejecutar absolutamente nada sobre `hmyzuuujyurvyuusvyzp` (`OCTOPUS COQUINARIA`).
- No existe staging: la aplicación local trabaja contra la base productiva.
- No modificar `GRANT`, RLS ni políticas de seguridad sin mostrar antes el SQL al usuario y obtener confirmación explícita.
- No borrar registros de `bitacora.registros`.
- El proyecto no tiene repositorio Git; no hay un mecanismo automático de reversión.
- Después de modificar `src/`, ejecutar siempre `npm run build`.

## 2. Intención y decisiones del usuario

La aplicación debe generar credenciales laborales tipo aeroportuarias desde la ficha de cada persona.

Decisiones confirmadas:

- Solamente un administrador puede emitir, reemitir, modificar o descargar credenciales.
- El empleado no necesita ver ni descargar su propia credencial.
- No se imprime número de legajo.
- La vigencia es de dos años desde la emisión.
- El QR valida autenticidad y puede compartir únicamente el contacto laboral expresamente autorizado.
- Nunca se debe exponer por QR el DNI, la fotografía ni información no autorizada.
- El teléfono laboral y el correo laboral se habilitan mediante casillas independientes.
- El diseño debe parecer una credencial aeroportuaria, no una tarjeta corporativa genérica.
- El frente debe priorizar una fotografía grande, nombre, DNI, empresa, función, sede, categoría y vencimiento muy visible.
- La categoría aparece en una banda naranja vertical (`OPS`, `MNT`, `CAL`, `ADM` o `HYS`).
- El grupo sanguíneo es opcional. Cuando se usa, debe aparecer solamente el valor, por ejemplo `A+`, pequeño y sutil, sin etiqueta ni recuadro.
- El usuario pidió específicamente más espacio para la foto y la posibilidad de centrarla manualmente.

## 3. Funcionalidad ya implementada

### Emisión y seguridad

- Tabla: `equipo.credenciales_personal`.
- La credencial tiene estados y permite emisión, reemisión, anulación y registro de extravío.
- La reemisión invalida la credencial anterior y su QR.
- RPC pública de verificación: `public.verificar_credencial(uuid)`.
- La verificación pública devuelve solamente los datos permitidos.
- Las políticas existentes mantienen la administración de credenciales limitada a administradores.

### Diseño

- Frente y dorso en formato CR80.
- Frente con logotipo, fotografía amplia, banda de categoría, nombre, DNI, empresa, puesto, sede, grupo sanguíneo opcional y franja naranja de vencimiento.
- Dorso con logotipo, QR, texto de validación/contacto, propiedad de Fly Kitchen y mensaje de extravío.
- Descarga PDF frente/dorso con el mismo diseño.

### Encuadre de fotografía

La última versión publicada incluye:

- Un área de fotografía más alta en la credencial.
- Control de posición horizontal de 0 a 100.
- Control de posición vertical de 0 a 100.
- Zoom desde 100% hasta 180%.
- Botón `Centrar automáticamente`.
- Vista previa en tiempo real.
- Persistencia del encuadre en la base.
- Uso del mismo encuadre en el PDF.

Los controles están en el panel `ENCUADRE DE LA FOTO`. Para una credencial ya emitida se guardan con `Guardar datos y encuadre`; al emitir o reemitir también quedan guardados.

## 4. Archivos principales modificados

- `src/components/CredencialPersonalModal.jsx`
  - Modal administrativo.
  - Vista previa frente/dorso.
  - Controles de encuadre.
  - Grupo sanguíneo y permisos de contacto.
- `src/lib/credenciales.js`
  - Consultas a Supabase.
  - Emisión, actualización y anulación.
  - Generación del PDF.
  - Recorte de la foto con posición y zoom.
- `supabase/migrations/20260720200000_credenciales_grupo_sanguineo.sql`
  - Agrega `grupo_sanguineo` con valores ABO/Rh permitidos.
- `supabase/migrations/20260720213000_credencial_encuadre_foto.sql`
  - Agrega `foto_pos_x`, `foto_pos_y` y `foto_zoom`.

## 5. Esquema agregado en producción

En el proyecto correcto `mixyhfdlzjarvszinytk` se agregaron:

```sql
alter table equipo.credenciales_personal
  add column if not exists grupo_sanguineo text null
  check (grupo_sanguineo is null or grupo_sanguineo in ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

alter table equipo.credenciales_personal
  add column if not exists foto_pos_x numeric(5,2) not null default 50
    check (foto_pos_x between 0 and 100),
  add column if not exists foto_pos_y numeric(5,2) not null default 50
    check (foto_pos_y between 0 and 100),
  add column if not exists foto_zoom numeric(4,2) not null default 1
    check (foto_zoom between 1 and 1.8);
```

No se cambiaron permisos, RLS ni políticas en la última modificación.

## 6. Verificaciones realizadas

- `npm run build` pasó correctamente después de implementar el editor de encuadre.
- La migración de encuadre se aplicó correctamente en `mixyhfdlzjarvszinytk`.
- Se verificó en `information_schema.columns` que existen:
  - `foto_pos_x`, tipo `numeric`, default `50`.
  - `foto_pos_y`, tipo `numeric`, default `50`.
  - `foto_zoom`, tipo `numeric`, default `1`.
- Antes se realizó una prueba transaccional de emisión con grupo `A+` y vencimiento a dos años; se hizo `ROLLBACK` y no quedaron datos de prueba.
- El último despliegue de Vercel quedó `Ready`.

## 7. Producción

- URL de uso: `https://bitacora-dashboard.vercel.app/?view=equipo`
- Último deployment de esta mejora:
  - ID: `dpl_EWoWvdPhnQPKU5yiLX2m58EwPzDb`
  - URL inmutable: `https://bitacora-dashboard-aibvvchkf-nvitaleflykitchen-3071s-projects.vercel.app`
  - Estado verificado: `Ready`
  - Alias verificado: `https://bitacora-dashboard.vercel.app`

## 8. Próxima comprobación recomendada

La implementación está publicada, pero conviene hacer una comprobación visual autenticada con una persona real:

1. Abrir `Equipo` como administrador.
2. Abrir la ficha de una persona que tenga fotografía.
3. Abrir `Credencial aeroportuaria`.
4. Probar horizontal, vertical y zoom.
5. Guardar el encuadre.
6. Cerrar y volver a abrir para confirmar persistencia.
7. Descargar el PDF y comprobar que el recorte coincide con la vista previa.

No emitir ni reemitir una credencial real solo para probar sin aprobación del usuario, porque eso modifica producción e invalida el QR anterior.

## 9. Observaciones técnicas para quien continúe

- La vista previa usa `object-fit: cover`, `object-position` y `transform: scale(...)`.
- El PDF usa `addCoverImage(...)`, calcula el recorte con `foto_pos_x`, `foto_pos_y` y `foto_zoom`, y aplica clipping antes de insertar la imagen.
- Si la vista previa y el PDF difieren, el punto a revisar es la equivalencia entre el `transform-origin` CSS y el cálculo de desplazamiento de `addCoverImage`.
- El componente fue reescrito en UTF-8 limpio durante el último cambio. En `src/lib/credenciales.js` pueden existir cadenas antiguas con mojibake heredado (`AdministraciÃ³n`, etc.); no confundir ese problema previo con el editor de encuadre.
- No hay cambio mobile específico para esta función: la emisión es administrativa y está en el flujo de escritorio.

## 10. Contexto funcional más amplio conversado

Además de credenciales, durante la misma línea de trabajo el usuario planteó mejoras en compras, inventario, proyectos de gestión y seguimiento de responsables. Esas conversaciones no deben mezclarse automáticamente con esta implementación. Para credenciales, las decisiones vinculantes son las documentadas arriba.

## 11. Corrección posterior de impresión

El usuario informó que la vista de creación era correcta pero el PDF permitía que la fotografía invadiera el bloque de datos. Se reemplazó el clipping vectorial de jsPDF por un recorte previo en canvas y se alinearon las alturas del PDF con las proporciones exactas de la vista previa: cabecera, fotografía, datos y vencimiento. La fotografía insertada en el PDF ahora es un JPEG ya recortado, por lo que no puede desbordarse.

El logotipo de Fly Kitchen debe conservar siempre su relación de aspecto original. En el PDF se inserta con ajuste `contain`, centrado dentro de su área; puede reducirse para entrar, pero nunca estirarse horizontal o verticalmente.

El logotipo debe quedar centrado respecto del ancho total de la credencial, tanto en el frente como en el dorso y en la vista previa.
