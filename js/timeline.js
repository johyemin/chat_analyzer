import {state} from "./state.js"

export function renderTimeline(){
  const root = document.getElementById("timelineTree")
  if (!root) return

  const rows = state.filteredRows?.length ? state.filteredRows : state.rows
  if (!rows || !rows.length) {
    root.innerHTML = '<div class="muted">데이터 없음</div>'
    return
  }

  const map = new Map()

  rows.forEach((r) => {
    const d = new Date(r.ts)
    if (Number.isNaN(d.getTime())) return
    const key = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
    if (!map.has(key)) map.set(key, {count: 0, rowId: r.id})
    map.get(key).count += 1
  })

  root.innerHTML = [...map.entries()].map(([date, info]) => `
    <button class="timelineItem" type="button" data-row-id="${info.rowId}">
      <span class="timelineDot"></span>
      <span class="timelineDate">${date}</span>
      <span class="timelineCount">${info.count}</span>
    </button>
  `).join("")

  root.querySelectorAll(".timelineItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(`msg-${btn.dataset.rowId}`)
      if (target) target.scrollIntoView({behavior: "smooth", block: "center"})
    })
  })
}
