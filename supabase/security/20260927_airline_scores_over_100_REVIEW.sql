-- SQL mostrado al usuario y aplicado en mixyhfdlzjarvszinytk el 2026-09-27.
-- Los informes Copa COR y MDZ de marzo 2026 publican 108%.
-- Se conserva el puntaje original; el límite evita valores claramente erróneos.
begin;

alter table bitacora.airline_performance_months
  drop constraint airline_performance_months_total_score_check;
alter table bitacora.airline_performance_months
  add constraint airline_performance_months_total_score_check
  check (total_score between 0 and 200);

commit;
