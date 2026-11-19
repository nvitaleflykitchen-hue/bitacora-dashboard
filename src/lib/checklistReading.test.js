import {expect,it} from 'vitest'
import {previousChecklistReading} from './checklistReading'
it('precarga la lectura cronológicamente más reciente, incluyendo cero',()=>{
 expect(previousChecklistReading([{fecha:'2026-11-01',km:600000},{fecha:'2026-11-03',km:0},{fecha:'2026-11-04',km:null}])).toBe('0')
 expect(previousChecklistReading([])).toBe('')
 expect(previousChecklistReading([{fecha:'2026-11-03',km:600005},{fecha:'2026-11-02',km:600000}])).toBe('600005')
})
