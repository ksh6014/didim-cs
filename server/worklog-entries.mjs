export class WorkLogEntryError extends Error {}

// References only: report saving never completes a case or deducts its stock.
export async function normalizeWorkEntries(input, db) {
  if (!Array.isArray(input) || input.length > 50) throw new WorkLogEntryError('방문 업무는 최대 50개까지 등록할 수 있습니다.')
  const seen = new Set()
  const entries = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') throw new WorkLogEntryError('방문 업무 형식을 확인해주세요.')
    const serviceRequestId = raw.serviceRequestId ? Number(raw.serviceRequestId) : null
    let site, service
    if (serviceRequestId !== null) {
      if (!Number.isSafeInteger(serviceRequestId) || serviceRequestId <= 0 || seen.has(serviceRequestId)) throw new WorkLogEntryError('A/S 접수번호가 잘못되었거나 중복 선택되었습니다.')
      seen.add(serviceRequestId)
      service = await db.serviceRequest.findUnique({ where: { id: serviceRequestId }, include: { site: true, assignees: { include: { user: { select: { name: true } } } } } })
      if (!service) throw new WorkLogEntryError('선택한 A/S 건이 없습니다. 다시 선택해주세요.')
      site = service.site
    } else {
      const siteId = Number(raw.siteId)
      if (!Number.isSafeInteger(siteId) || siteId <= 0) throw new WorkLogEntryError('각 업무의 현장을 선택해주세요.')
      site = await db.site.findUnique({ where: { id: siteId } })
      if (!site) throw new WorkLogEntryError('선택한 현장을 찾을 수 없습니다.')
    }
    const workType = service?.requestType || raw.workType || '방문A/S'
    if (!['방문A/S', '원격A/S', '상담', '설치', '기타'].includes(workType)) throw new WorkLogEntryError('업무 유형을 확인해주세요.')
    const result = raw.result || '진행 중'
    if (!['진행 중', '완료', '재방문 필요', '보류'].includes(result)) throw new WorkLogEntryError('업무 결과를 확인해주세요.')
    const fields = {}
    for (const key of ['workContent', 'followUp', 'materialNote']) {
      if (raw[key] != null && typeof raw[key] !== 'string') throw new WorkLogEntryError('업무 내용은 문자열로 입력해주세요.')
      fields[key] = (raw[key] || '').trim()
      if (fields[key].length > 10000) throw new WorkLogEntryError('업무 내용은 항목당 10,000자 이하로 입력해주세요.')
    }
    entries.push({ serviceRequestId, siteId: site.id, siteName: site.name, workType,
      requestContent: service?.requestContent || '', assignees: service?.assignees.map((row) => row.user.name) || [], result, ...fields })
  }
  return entries
}
