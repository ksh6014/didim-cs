import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeWorkEntries, WorkLogEntryError } from './worklog-entries.mjs'

const db = {
  serviceRequest: { findUnique: async ({ where }) => where.id <= 3 ? {
    id: where.id, requestType: '방문A/S', requestContent: `증상 ${where.id}`,
    site: { id: where.id + 10, name: `현장 ${where.id}` },
    assignees: [{ user: { name: '테스트 담당자' } }],
  } : null },
  site: { findUnique: async ({ where }) => where.id === 20 ? { id: 20, name: '설치 현장' } : null },
}

test('three visits retain separate work, result, service and site references', async () => {
  const rows = await normalizeWorkEntries([1, 2, 3].map((id) => ({ serviceRequestId: id, siteId: 999, siteName: '변조', workContent: `작업 ${id}`, result: id === 2 ? '재방문 필요' : '완료' })), db)
  assert.deepEqual(rows.map((row) => row.siteId), [11, 12, 13])
  assert.deepEqual(rows.map((row) => row.workContent), ['작업 1', '작업 2', '작업 3'])
  assert.equal(rows[1].result, '재방문 필요')
  assert.equal(rows[0].siteName, '현장 1')
  assert.deepEqual(rows[0].assignees, ['테스트 담당자'])
  assert.deepEqual(await normalizeWorkEntries(JSON.parse(JSON.stringify(rows)), db), rows)
})
test('standalone installation can accompany a service visit', async () => {
  const rows = await normalizeWorkEntries([{ serviceRequestId: 1 }, { siteId: 20, workType: '설치', workContent: '설치 완료', materialNote: '참고용 자재 메모' }], db)
  assert.equal(rows[1].serviceRequestId, null)
  assert.equal(rows[1].workType, '설치')
})
test('duplicate or missing service and missing site are rejected', async () => {
  for (const input of [[{ serviceRequestId: 1 }, { serviceRequestId: 1 }], [{ serviceRequestId: 99 }], [{ siteId: 99 }], [{ serviceRequestId: -1 }]]) {
    await assert.rejects(() => normalizeWorkEntries(input, db), WorkLogEntryError)
  }
})
test('malformed payloads and unsupported values are rejected', async () => {
  for (const input of [null, {}, [null], Array(51).fill({}), [{ siteId: 20, result: '잘못된 결과' }], [{ siteId: 20, workContent: {} }], [{ siteId: 20, workContent: 'a'.repeat(10001) }]]) {
    await assert.rejects(() => normalizeWorkEntries(input, db), WorkLogEntryError)
  }
})
test('empty list supports legacy reports and removing entries', async () => {
  assert.deepEqual(await normalizeWorkEntries([], db), [])
})
