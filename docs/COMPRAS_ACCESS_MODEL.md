# Modelo de acceso y gestión de Compras

Estado: propuesta para revisión. No aplicada en Supabase.

## Objetivo

Convertir Requerimientos en una bandeja operativa para Compras sin dar acceso de `editor` al resto de la aplicación.

## Perfiles funcionales

Los seis valores existentes de `bitacora.perfiles.rol` no cambian. El acceso específico se agrega mediante permisos de módulo:

- `compras.request`: crear y seguir requerimientos propios.
- `compras.manage`: tomar requerimientos sin asignar y gestionar los asignados al usuario.
- `compras.supervise`: ver, asignar y reasignar toda la bandeja de Compras.
- `compras.invoice`: gestionar la etapa documental y de facturación.

Los integrantes de Compras pueden conservar `rol = 'consultor'` y recibir únicamente el permiso de módulo correspondiente.

## Responsabilidades propuestas

| Persona | Permiso | Alcance inicial |
|---|---|---|
| Ignacio Oyarzabal Indaburu | `compras.supervise` | Dirección, excepciones y reasignaciones |
| Leandro Villaruel | `compras.supervise` | Supervisión operativa y compras centrales/planta |
| Diego Ferrarassi | `compras.manage` | Interior: comedores, hospitales, educación y escalas |
| Analía Roberto | `compras.manage` | Proveedor Arcor para cocinas in situ |
| Martina Figueroa | `compras.invoice` | Facturas y documentación |

Los emails de Leandro, Analía, Diego y Martina deben confirmarse antes de crear sus cuentas.

## Flujo

1. La sede crea el requerimiento.
2. Un aprobador lo aprueba, observa o rechaza.
3. Al pasar a `Enviado`, aparece en la bandeja `Sin asignar` de Compras.
4. Un supervisor asigna comprador o el comprador lo toma según las reglas de ruteo.
5. El comprador registra proveedor, cotización, OC, compromiso y notas de gestión.
6. `Recibido` indica recepción física.
7. La sede solicitante confirma `Cumplido`.

## Tablero por usuario

- Comprador: Sin asignar, Mis gestiones, Esperando cotización, En compra, Próximas entregas y Vencidas.
- Supervisor: carga por comprador, reasignaciones, SLA, antigüedad y excepciones.
- Facturación: recibidos sin documentación, facturas pendientes y cierres.
- Solicitante: seguimiento de sus pedidos, sin editar la gestión de Compras.

## Seguridad

- El frontend no será la única barrera: los mismos permisos deben existir en RLS.
- Nadie de Compras recibe acceso general de `editor` por pertenecer al departamento.
- Una vez enviado, los datos originales quedan inmutables; Compras solo modifica campos de gestión.
- No se concede `DELETE` sobre requerimientos desde la aplicación.
- El SQL de revisión reemplaza las políticas actuales de `bitacora.requerimientos`; debe probarse con los seis roles antes de confirmar el `COMMIT`.

