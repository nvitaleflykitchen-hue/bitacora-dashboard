export function enrichAuditRowsWithReporters(rows = [], registros = []) {
  const byId = new Map(
    registros.map((registro) => [String(registro.id), registro]),
  );

  return rows.map((row) => {
    if (row.usuario_nombre || row.usuario_email) return row;
    if (!["registros", "bitacora.registros"].includes(row.tabla)) return row;

    const registro = byId.get(String(row.registro_id));
    if (!registro?.reportante && !registro?.email_reportante) return row;

    return {
      ...row,
      usuario_nombre: registro.reportante || null,
      usuario_email: registro.email_reportante || null,
      usuario_origen: "reportante_formulario",
    };
  });
}
