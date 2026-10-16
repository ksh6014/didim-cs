const emptyEntry = () => ({ serviceRequestId: '', siteId: '', siteName: '', workType: '방문A/S', requestContent: '', assignees: [], workContent: '', result: '진행 중', followUp: '', materialNote: '' })

export function WorkEntriesEditor({ entries, onChange, sites, services, error }) {
  const update = (index, values) => onChange(entries.map((entry, i) => i === index ? { ...entry, ...values } : entry))
  return <div className="form-field full work-entry-list">
    <div className="panel-header"><div><h2>현장별 업무 기록</h2><p>하루에 방문한 현장을 각각 추가하세요. 설치·원격 A/S도 함께 기록할 수 있습니다.</p></div><button type="button" className="secondary-button" disabled={entries.length >= 50} onClick={() => onChange([...entries, emptyEntry()])}>+ 방문 업무 추가</button></div>
    {error && <p role="alert">{error}</p>}
    {!entries.length && <p className="memo-box">방문 업무를 추가하거나, 아래 공통 업무란에 기존 방식으로 작성하세요.</p>}
    {entries.map((entry, index) => <section className="work-entry-card" key={index}>
      <div className="panel-header"><strong>{index + 1}. {entry.siteName || '현장을 선택하세요'} · {entry.workType}</strong><button type="button" className="secondary-button" onClick={() => {
        if ((entry.workContent || entry.followUp || entry.materialNote) && !window.confirm('이 현장의 작성 내용을 일지에서 제거할까요? A/S 원본은 삭제되지 않습니다.')) return
        onChange(entries.filter((_, i) => i !== index))
      }}>업무 제거</button></div>
      <div className="form-grid">
        <label className="form-field full">연결할 A/S 접수 건
          <select value={entry.serviceRequestId || ''} onChange={(e) => {
            const service = services.find((row) => row.id === Number(e.target.value))
            update(index, service ? { serviceRequestId: service.id, siteId: service.siteId, siteName: service.site?.name || '', workType: service.requestType, requestContent: service.requestContent, assignees: (service.assignees || []).map((row) => row.user?.name).filter(Boolean) } : { serviceRequestId: '', requestContent: '', assignees: [] })
          }}>
            <option value="">접수 건 없이 현장 선택 (설치·기타 업무 등)</option>
            {entry.serviceRequestId && !services.some((row) => row.id === Number(entry.serviceRequestId)) && <option value={entry.serviceRequestId}>기존 연결 #{entry.serviceRequestId} · {entry.siteName}</option>}
            {services.map((row) => <option key={row.id} value={row.id} disabled={entries.some((other, i) => i !== index && Number(other.serviceRequestId) === row.id)}>#{row.id} · {row.site?.name} · {row.requestType} · {row.status} · {row.requestContent}</option>)}
          </select>
          <small>A/S 조회 결과 최대 500건에서 선택합니다.</small>
        </label>
        {!entry.serviceRequestId && <>
          <label className="form-field">현장<select required value={entry.siteId} onChange={(e) => { const site = sites.find((row) => row.id === Number(e.target.value)); update(index, { siteId: e.target.value, siteName: site?.name || '' }) }}><option value="">현장 선택</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label className="form-field">업무 유형<select value={entry.workType} onChange={(e) => update(index, { workType: e.target.value })}>{['방문A/S', '원격A/S', '상담', '설치', '기타'].map((type) => <option key={type}>{type}</option>)}</select></label>
        </>}
        {!!entry.serviceRequestId && <div className="form-field full"><small>접수 증상: {entry.requestContent || '-'}<br />담당자: {(entry.assignees || []).join(', ') || '미배정'}</small></div>}
        <label className="form-field full">작업 내용<textarea value={entry.workContent} onChange={(e) => update(index, { workContent: e.target.value })} placeholder="이 현장에서 실제로 한 작업" /></label>
        <label className="form-field">업무 결과<select value={entry.result} onChange={(e) => update(index, { result: e.target.value })}>{['진행 중', '완료', '재방문 필요', '보류'].map((result) => <option key={result}>{result}</option>)}</select></label>
        <label className="form-field full">후속 조치 / 전달사항<textarea value={entry.followUp} onChange={(e) => update(index, { followUp: e.target.value })} placeholder="이 현장의 남은 업무와 재방문 계획" /></label>
        <label className="form-field full">사용 자재 메모 (재고 차감 없음)<textarea value={entry.materialNote} onChange={(e) => update(index, { materialNote: e.target.value })} placeholder="예: A/S 상세에서 카메라 1개 사용 처리함" /></label>
      </div>
    </section>)}
    {!!entries.length && <p className="memo-box">업무 결과는 일지 기록용입니다. 실제 A/S 완료·사진 첨부·자재 차감은 해당 A/S 상세에서 처리하세요. 이미 차감한 자재를 아래 공통 사용 자재에 중복 입력하지 마세요.</p>}
  </div>
}

export function WorkEntriesRead({ entries = [], onOpen }) {
  return <div className="work-entry-list">{entries.map((entry, index) => <section className="work-entry-card" key={index}>
    <div className="panel-header"><strong>{index + 1}. {entry.siteName} · {entry.workType}</strong><span className="badge">{entry.result}</span></div>
    {entry.requestContent && <p>접수 내용: {entry.requestContent}</p>}
    {entry.assignees?.length > 0 && <p>담당자: {entry.assignees.join(', ')}</p>}
    {[['작업 내용', entry.workContent], ['후속 조치', entry.followUp], ['사용 자재 메모', entry.materialNote]].filter(([, value]) => value).map(([label, value]) => <p key={label} style={{ whiteSpace: 'pre-wrap' }}><strong>{label}</strong><br />{value}</p>)}
    {entry.serviceRequestId && <button type="button" className="text-button" onClick={() => onOpen(entry.serviceRequestId)}>A/S #{entry.serviceRequestId} 상세 · 사진 보기 →</button>}
  </section>)}</div>
}
