import { useState } from 'react'
import './LeaveCalendar.css'

// Display only: date membership and leave permissions remain owned by App.
export default function LeaveCalendarDays({ cells, getLeavesForDate, year, month, status = 'ready', onRetry }) {
  const today = new Date()
  const [selectedDay, setSelectedDay] = useState(
    today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : 1,
  )
  const selectedDate = new Date(year, month - 1, selectedDay)
  const selectedLeaves = status === 'ready' ? getLeavesForDate(selectedDate) : []
  return (
    <div className="leave-calendar-view">
      {status !== 'ready' && <div role="status">
        <p>{status === 'error' ? '연차 정보를 불러오지 못했습니다.' : '연차 정보를 불러오는 중입니다.'}</p>
        {status === 'error' && <button type="button" onClick={onRetry}>다시 조회</button>}
      </div>}
      <div className="leave-calendar" aria-label={`${year}년 ${month}월 연차 일정`}>
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div className="leave-calendar-head" key={day}>{day}</div>
        ))}
        {cells.map((date, index) => {
          if (!date) return <div className="leave-calendar-cell empty" key={`empty-${index}`} aria-hidden="true" />
          const leaves = status === 'ready' ? getLeavesForDate(date) : []
          const day = date.getDate()
          const count = new Set(leaves.map(item => item.userId ?? item.user?.id ?? item.user?.name ?? item.id)).size
          const isToday = today.toDateString() === date.toDateString()
          return (
            <div className="leave-calendar-cell" key={day}>
              <button type="button" className="leave-calendar-day-button"
                aria-label={`${month}월 ${day}일, ${status === 'ready' ? `휴가 ${count}명` : '조회 미완료'}`}
                aria-pressed={selectedDay === day} aria-current={isToday ? 'date' : undefined}
                aria-controls="leave-selected-day" onClick={() => setSelectedDay(day)}>
                <span className="leave-calendar-date">{day}</span>
                <span className="leave-calendar-count">{status !== 'ready' ? '…' : count ? `${count}명` : '—'}</span>
              </button>
              <div className="leave-calendar-items">
                {leaves.map(item => (
                  <div className="leave-calendar-item" key={item.id}>
                    <strong>{item.user?.name || '직원'}</strong><span>{item.leaveType}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <section id="leave-selected-day" className="leave-calendar-detail" aria-live="polite" aria-atomic="true">
        <h3>{month}월 {selectedDay}일 연차 내역</h3>
        {status !== 'ready' ? <p>조회 완료 후 내역을 확인할 수 있습니다.</p> : selectedLeaves.length ? <ul>{selectedLeaves.map(item => (
          <li key={item.id}><strong>{item.user?.name || '직원'}</strong>
            <span>{item.leaveType}</span>
            <span>{item.startDate?.slice(0, 10)} ~ {item.endDate?.slice(0, 10)}</span>
          </li>
        ))}</ul> : <p>등록된 연차가 없습니다.</p>}
      </section>
    </div>
  )
}
