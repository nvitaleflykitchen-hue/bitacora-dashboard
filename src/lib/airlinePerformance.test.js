import { describe, expect, it } from 'vitest'
import { latestPublishedReports, parseCopaScorecard } from './airlinePerformance'

describe('Copa scorecard extraction', () => {
  it('keeps the reported cumulative score and excludes months without a TOTAL', () => {
    const tokens = [
      ['TOTAL', 1444, 228], ['84.8%', 1440, 263],
      ['Jan-26', 88, 401], ['72%', 1451, 402], ['16%', 306, 402], ['SU DESEMPEÑO DEBE', 1545, 393],
      ['Feb-26', 87, 432], ['100%', 1451, 433],
      ['Sep-26', 87, 640], ['0', 177, 641],
    ].map(([text, x, y]) => ({ text, x, y }))
    const result = parseCopaScorecard(tokens, 1832.73, 'ROS.pdf')
    expect(result).toMatchObject({ siteCode:'ROS', year:2026, cumulative_score:84.8 })
    expect(result.months.map(month => month.total_score)).toEqual([72, 100])
    expect(result.months[0].metrics.complaints.awarded).toBe('16%')
  })

  it('uses only the latest published version for a site and year', () => {
    const reports = [
      { id:'old', site_id:1, airline:'Copa Airlines', report_year:2026, status:'published', published_at:'2026-09-01' },
      { id:'draft', site_id:1, airline:'Copa Airlines', report_year:2026, status:'draft', created_at:'2026-09-25' },
      { id:'new', site_id:1, airline:'Copa Airlines', report_year:2026, status:'published', published_at:'2026-09-24' },
      { id:'other', site_id:2, airline:'Copa Airlines', report_year:2026, status:'published', published_at:'2026-09-02' },
    ]
    expect(latestPublishedReports(reports).map(report => report.id)).toEqual(['new', 'other'])
  })
})
