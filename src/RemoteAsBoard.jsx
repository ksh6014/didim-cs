export default function RemoteAsBoard({ rows, pendingCount, onCreate, onDetail, formatDateTime, getBadgeClass }) {
  return (
            <section className="panel remote-as-live-board dashboard-first-board" style={{ marginBottom: '18px' }}>
              <div className="panel-header">
                <div>
                  <div className="dashboard-live-title"><span className="dashboard-live-dot" /><h2>원격 A/S 실시간 현황판</h2></div>
                  <p>CS 업무에서 등록한 원격 A/S 요청을 한눈에 확인합니다. 10초마다 자동 갱신됩니다.</p>
                </div>
                <div className="dashboard-quick-actions">
                  <span className="remote-as-live-count">처리대기 {pendingCount}건</span>
                  <button type="button" className="primary-button" onClick={onCreate}>+ 원격 A/S 요청</button>
                </div>
              </div>
              <div className="table-wrap remote-as-table-wrap">
                <table className="remote-as-table">
                  <thead><tr><th>접수시간</th><th>현장</th><th>고객 / 연락처</th><th>원격 요청내용</th><th>요청자</th><th>긴급도</th><th>상태</th><th>상세</th></tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className={row.priority === '긴급' && row.status !== '완료' ? 'dashboard-as-urgent-row' : ''}>
                        <td>{formatDateTime(row.createdAt)}</td>
                        <td><strong>#{row.id} · {row.site?.name || '-'}</strong></td>
                        <td>{row.customerName || '-'}<small>{row.contact || '-'}</small></td>
                        <td className="remote-as-request-content">{row.requestContent || '-'}</td>
                        <td>{row.createdBy?.name || '-'}</td>
                        <td>{row.priority === '긴급' ? <span className="remote-as-urgent">긴급</span> : '일반'}</td>
                        <td><span className={`badge ${getBadgeClass(row.status)}`}>{row.status}</span></td>
                        <td><button type="button" className="secondary-button" onClick={() => onDetail(row)}>상세보기</button></td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan="8" className="dashboard-as-empty">등록된 원격 A/S 요청이 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
  )
}
