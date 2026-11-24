# Entrega individual de credenciales

Usuarios ofrece una herramienta exclusiva de administración para importar un relevamiento revisado y descargar credenciales cifradas por sede. No envía mensajes ni correos.

El archivo de preparación contiene project_id, batch_id, audited_at, public_key (JWK RSA pública) y people. Cada persona incluye persona_id, action (create/reset), nombre, email, auth_id para restablecimientos, rol y sedes. El relevamiento vence a las 24 horas. Antes de prepararlo, consultar personas activas sin baja ni duplicación, perfiles, auth.users y actividad de auth.sessions. Excluir cuentas con actividad en los últimos 90 días, identidades ambiguas y cuentas protegidas por instrucciones del administrador.

Las altas invocan create-user-direct con rol operario. La herramienta verifica que la ficha siga activa y conserve email y sedes. Los restablecimientos invocan prepare-temporary-password, que autentica al administrador, comprueba identidad y actividad del perfil, rechaza administradores/editores y accesos recientes, usa Auth Admin updateUserById y exige must_change_password. No modifica rol, correo de acceso ni sedes. Si Auth falla, restaura el indicador anterior.

Las contraseñas nunca se registran en consola ni se descargan en claro. Se cifran con RSA-OAEP (SHA-1 para interoperabilidad con el visor Windows existente). Solo el archivo cifrado y su metadato de entrega se conservan en localStorage; cada resultado se guarda antes de continuar con la siguiente persona. Los restablecimientos guardan el ciphertext pendiente antes de invocar Auth. Si hay un error de red, revisar estado real antes de reintentar. Las altas exitosas de un mismo lote no se repiten.

Importar el resultado al visor fuera de OneDrive/repositorio; conservar la clave privada protegida con DPAPI CurrentUser. Verificar cada perfil_id, rol, sede_ids y must_change_password mediante consulta administrativa antes de habilitar la entrega. No entregar registros con error o pendientes de verificación. Conservar el archivo cifrado anterior como respaldo y retirar de la lista entregable las claves históricas reemplazadas o ya utilizadas.

Verificación: pruebas de cifrado/descifrado real, no persistencia de texto plano, ausencia de cambios de rol en reset, rechazo de cambios de sede, exclusión de no administradores y comprobación HTTP 401 de la función sin sesión. No hay cambios de RLS o GRANT.
