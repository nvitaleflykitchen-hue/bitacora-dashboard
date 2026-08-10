export const TRIAL_OPINIONS = [
  { value:'Aprobado', label:'Aprobar' },
  { value:'Aprobado con ajustes', label:'Aprobar con ajustes' },
  { value:'Repetir prueba', label:'Repetir la prueba' },
  { value:'Rechazado', label:'Rechazar' },
]

const SEVERITY = {
  Aprobado:1,
  'Aprobado con ajustes':2,
  'Repetir prueba':3,
  Rechazado:4,
}

export function deriveTrialResult(participants = []) {
  const votes = participants
    .map(participant => typeof participant === 'object' ? participant?.opinion : null)
    .filter(opinion => Object.hasOwn(SEVERITY, opinion))

  if (!votes.length) return 'Repetir prueba'

  const counts = votes.reduce((result, opinion) => {
    result[opinion] = (result[opinion] || 0) + 1
    return result
  }, {})

  return Object.entries(counts)
    .sort(([opinionA, countA], [opinionB, countB]) =>
      countB - countA || SEVERITY[opinionB] - SEVERITY[opinionA]
    )[0][0]
}

export function trialParticipantId(participant) {
  if (typeof participant === 'string') return participant
  return participant?.persona_id || participant?.perfil_id || participant?.key || null
}
