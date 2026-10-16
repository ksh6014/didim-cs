import { useState } from 'react'

export default function SidebarNavigation({ workspace, page, onNavigate, role, unreadCount = 0, serviceType }) {
  const [collapsed, setCollapsed] = useState({})
  const admin = ['MASTER', 'ADMIN'].includes(role)
  const groups = workspace === 'AS' ? [
    { id: 'intake', label: '접수 업무', items: [
      ['as-center', 'A/S 접수센터', '☎', ['as-process']],
      ['alerts', '알림센터', '!'],
      ['notices', '공지사항', '●'],
    ] },
  ] : [
    { id: 'overview', label: '업무 현황', items: [
      ['dashboard', '대시보드', '⌂'], ['remote-as', '원격 A/S 현황', '◉'], ['alerts', '알림센터', '!'],
    ] },
    { id: 'field', label: '현장 업무', items: [
      ['sites', '현장 목록', '▦', ['site-detail', 'register']], ['installations', '설치 관리', '▦'],
      ['service', '방문 A/S 관리', '⚒'], ['schedule', '월간 일정', '▣'], ['dispatch', '팀 배차', '⇄'],
    ] },
    { id: 'records', label: '업무 기록·자료', items: [
      ['worklogs', '업무일지', '✎'], ['manuals', '업무 매뉴얼', '▧'], ['files', '자료실', '▤'], ['notices', '공지사항', '●'],
    ] },
    { id: 'equipment', label: '장비·재고', items: [
      ['assets', '장비 대장', '▦'], ['inventory', '재고 관리', '▥'], ['qr-lookup', 'QR 조회', '⌗'],
      ...(admin ? [['checklist-templates', '체크리스트', '✓']] : []),
    ] },
    { id: 'management', label: '관리', items: [
      ['leave', '연차 관리', '▣'],
      ...(admin ? [['users', '직원 관리', '♟'], ['kpi', '통계/KPI', '▥']] : []),
      ...(role === 'MASTER' ? [['option-admin', '관리자 설정', '⚙']] : []),
    ] },
  ]
  const activePage = page === 'service-detail'
    ? (serviceType === '원격A/S' ? 'remote-as' : 'service') : page
  return (
    <nav className="menu grouped-menu" aria-label="업무 메뉴">
      {groups.map((group) => {
        const active = group.items.some(([id, , , children = []]) => id === activePage || children.includes(activePage))
        const closed = collapsed[group.id] ?? !(active || ['overview', 'field', 'intake'].includes(group.id))
        return (
          <section className="nav-group" key={group.id}>
            <button type="button" className={`nav-group-toggle ${active ? 'has-active' : ''}`} aria-expanded={!closed} aria-controls={`nav-${group.id}`} onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !closed }))}>
              <span>{group.label}</span>
              {closed && active && <span className="nav-current-dot" aria-label="현재 메뉴" />}
              {group.items.some(([id]) => id === 'alerts') && closed && unreadCount > 0 && <span className="nav-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              <span className="nav-chevron" aria-hidden="true">{closed ? '⌄' : '⌃'}</span>
            </button>
            <div id={`nav-${group.id}`} hidden={closed}>
              {group.items.map(([id, label, icon, children = []]) => (
                <button type="button" key={id} className={`menu-item ${id === activePage || children.includes(activePage) ? 'active' : ''}`} aria-current={id === activePage || children.includes(activePage) ? 'page' : undefined} onClick={() => onNavigate(id)}>
                  <span className="menu-icon" aria-hidden="true">{icon}</span>{label}
                  {id === 'alerts' && unreadCount > 0 && <span className="nav-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
              ))}
            </div>
          </section>
        )
      })}
      <button type="button" className={`menu-item nav-profile ${page === 'profile' ? 'active' : ''}`} onClick={() => onNavigate('profile')}><span className="menu-icon">○</span>내 정보</button>
    </nav>
  )
}
