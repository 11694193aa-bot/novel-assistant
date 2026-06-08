import React, { useState, useMemo } from 'react';
import useStore from '../store';

export default function CalendarView() {
  const { dailyCounts } = useStore();
  const [expandedYear, setExpandedYear] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  // 按年/月/日组织数据
  const tree = useMemo(() => {
    const years = {};
    Object.entries(dailyCounts).forEach(([date, count]) => {
      const [y, m, d] = date.split('-');
      if (!years[y]) years[y] = {};
      if (!years[y][m]) years[y][m] = {};
      years[y][m][d] = count;
    });
    // 排序
    const sorted = {};
    Object.keys(years).sort((a,b) => b.localeCompare(a)).forEach(y => {
      sorted[y] = {};
      Object.keys(years[y]).sort((a,b) => b.localeCompare(a)).forEach(m => {
        sorted[y][m] = years[y][m];
      });
    });
    return sorted;
  }, [dailyCounts]);

  const years = Object.keys(tree);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = dailyCounts[today] || 0;

  const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  // 获取某月的总字数
  const monthTotal = (year, month) => {
    const days = tree[year]?.[month] || {};
    return Object.values(days).reduce((s, c) => s + c, 0);
  };

  // 获取某年的总字数
  const yearTotal = (year) => {
    const months = tree[year] || {};
    return Object.values(months).reduce((s, days) =>
      s + Object.values(days).reduce((a, c) => a + c, 0), 0);
  };

  if (years.length === 0) {
    return (
      <div className="calendar-view">
        <div className="cal-header">
          <h2>📅 字数日历</h2>
          <span className="cal-today">今日: {todayCount} 字</span>
        </div>
        <div className="empty-view" style={{height:200}}>
          <span style={{fontSize:36}}>📝</span>
          <p>( ;´д`) 还没有写作记录呢~</p>
          <p className="hint">✧ 开始写作后会自动记录每日字数 ✧</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-view">
      <div className="cal-header">
        <h2>📅 字数日历</h2>
        <span className="cal-today">今日: <strong>{todayCount}</strong> 字</span>
      </div>

      <div className="cal-tree">
        {years.map(year => {
          const yTotal = yearTotal(year);
          const isYearOpen = expandedYear === year;
          return (
            <div key={year} className="cal-year">
              <div
                className={`cal-year-header ${isYearOpen ? 'open' : ''}`}
                onClick={() => setExpandedYear(isYearOpen ? null : year)}
              >
                <span className="cal-arrow">{isYearOpen ? '▼' : '▶'}</span>
                <span className="cal-year-label">{year}年</span>
                <span className="cal-year-total">{yTotal.toLocaleString()} 字</span>
              </div>

              {isYearOpen && Object.keys(tree[year]).sort((a,b) => b.localeCompare(a)).map(month => {
                const mTotal = monthTotal(year, month);
                const isMonthOpen = expandedMonth === `${year}-${month}`;
                const days = Object.keys(tree[year][month]).sort((a,b) => b.localeCompare(a));
                return (
                  <div key={month} className="cal-month">
                    <div
                      className={`cal-month-header ${isMonthOpen ? 'open' : ''}`}
                      onClick={() => setExpandedMonth(isMonthOpen ? null : `${year}-${month}`)}
                    >
                      <span className="cal-arrow">{isMonthOpen ? '▼' : '▶'}</span>
                      <span className="cal-month-label">{monthNames[parseInt(month)-1]}</span>
                      <span className="cal-month-total">{mTotal.toLocaleString()} 字</span>
                    </div>

                    {isMonthOpen && (
                      <div className="cal-days">
                        {/* 日历格子 */}
                        <div className="cal-grid">
                          {['日','一','二','三','四','五','六'].map(d => (
                            <span key={d} className="cal-weekday">{d}</span>
                          ))}
                          {(() => {
                            const firstDay = new Date(parseInt(year), parseInt(month)-1, 1).getDay();
                            const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
                            const cells = [];
                            for (let i = 0; i < firstDay; i++) cells.push(<span key={`e${i}`} className="cal-day empty" />);
                            for (let d = 1; d <= daysInMonth; d++) {
                              const ds = `${year}-${month.padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                              const count = dailyCounts[ds] || 0;
                              const isToday = ds === today;
                              const isSel = ds === selectedDay;
                              cells.push(
                                <span
                                  key={d}
                                  className={`cal-day ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''} ${count > 0 ? 'has-words' : ''}`}
                                  onClick={() => setSelectedDay(isSel ? null : ds)}
                                  title={`${ds}: ${count} 字`}
                                >
                                  <span className="cal-day-num">{d}</span>
                                  {count > 0 && <span className="cal-day-dot" style={{opacity: Math.min(1, count / 2000)}} />}
                                </span>
                              );
                            }
                            return cells;
                          })()}
                        </div>
                        {/* 每日列表 */}
                        <div className="cal-day-list">
                          {days.map(day => {
                            const ds = `${year}-${month}-${day}`;
                            const count = dailyCounts[ds] || 0;
                            const weekDay = ['日','一','二','三','四','五','六'][new Date(parseInt(year), parseInt(month)-1, parseInt(day)).getDay()];
                            return (
                              <div
                                key={day}
                                className={`cal-day-item ${selectedDay === ds ? 'selected' : ''}`}
                                onClick={() => setSelectedDay(selectedDay === ds ? null : ds)}
                              >
                                <span>{parseInt(day)}日 周{weekDay}</span>
                                <span className="cal-day-count">{count.toLocaleString()} 字</span>
                                {count >= 2000 && <span>🔥</span>}
                                {count >= 5000 && <span>⭐</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
