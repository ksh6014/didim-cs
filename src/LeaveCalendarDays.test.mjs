import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const { default: Calendar } = await vite.ssrLoadModule('/src/LeaveCalendarDays.jsx')
function render(year, month, leaves = [], status = 'ready') {
  const cells = Array(new Date(year, month - 1, 1).getDay()).fill(null)
  for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) cells.push(new Date(year, month - 1, d))
  return renderToStaticMarkup(React.createElement(Calendar, {
    year, month, cells, getLeavesForDate: () => leaves, status,
  }))
}
try {
  for (const [year, month, days] of [[2025, 2, 28], [2024, 2, 29], [2026, 4, 30], [2026, 1, 31], [2026, 12, 31], [2027, 1, 31]]) {
    await test(`${year}-${month}: ${days} selectable dates`, () => {
      const html = render(year, month)
      assert.equal((html.match(/class="leave-calendar-day-button"/g) || []).length, days)
      assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
      assert.ok(html.includes(`${month}월 ${days}일`))
    })
  }
  const leaves = ['노한솔', '김동호', '안석현', '이름이아주긴직원'].map((name, i) => ({
    id: i, userId: i, user: { name }, leaveType: '연차', startDate: '2024-02-01', endDate: '2024-02-29',
  }))
  await test('overlapping employees remain in detail and desktop cells', () => {
    const html = render(2024, 2, leaves)
    assert.ok(html.includes('휴가 4명'))
    assert.equal((html.match(/<li>/g) || []).length, 4)
    for (const item of leaves) assert.ok(html.includes(item.user.name))
  })
  await test('failed/loading fetch never renders stale leave data or an empty-success message', () => {
    for (const status of ['error', 'loading']) {
      const html = render(2024, 2, leaves, status)
      assert.ok(!html.includes('노한솔'))
      assert.ok(!html.includes('등록된 연차가 없습니다.'))
      assert.ok(html.includes('조회 미완료'))
    }
    assert.ok(render(2024, 2, leaves, 'error').includes('다시 조회'))
  })
  await test('empty successful response is distinct from failure', () => {
    assert.ok(render(2024, 2).includes('등록된 연차가 없습니다.'))
  })
} finally {
  await vite.close()
}
