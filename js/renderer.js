import {state} from "./state.js"
import {formatDate, formatDateTime, escapeHtml} from "./utils.js"
import {groupRows, mergeSpeaker} from "./grouping.js"
import {renderTimeline} from "./timeline.js"

const list = () => document.getElementById("viewRoot")

function createBubble(item){
  const row = document.createElement("div")
  const isRight = item.author === state.speakerRight

  row.className = isRight ? "bubbleRow user" : "bubbleRow"
  row.dataset.itemTs = String(item.ts)
  row.id = `msg-${item.rowIds[0]}`

  const bubble = document.createElement("div")
  bubble.className = "bubble"

  const meta = document.createElement("div")
  meta.className = "bubbleMeta"
  meta.innerHTML = `
    <span class="bubbleAuthor">${escapeHtml(item.author)}</span>
    <span class="bubbleDate">${escapeHtml(formatDateTime(item.ts))}</span>
  `
  bubble.appendChild(meta)

  item.messages.forEach((t) => {
    const div = document.createElement("div")
    div.className = "bubbleText"
    div.textContent = t
    bubble.appendChild(div)
  })

  row.appendChild(bubble)
  return row
}

function renderThreadView(rows){
  const groups = groupRows(rows)
  const frag = document.createDocumentFragment()

  groups.forEach((group, idx) => {
    const merged = mergeSpeaker(group)
    const wrap = document.createElement("div")
    wrap.className = "threadGroup"
    wrap.dataset.groupIndex = String(idx)

    const start = new Date(group[0].ts)
    const end = new Date(group[group.length - 1].ts)

    const header = document.createElement("div")
    header.className = "weekHeader"
    header.innerHTML = `
      <div class="weekTitle">${escapeHtml(formatDate(start))} ~ ${escapeHtml(formatDate(end))}</div>
      <div class="weekCount">메시지 ${group.length}개</div>
    `
    wrap.appendChild(header)

    const bubbleWrap = document.createElement("div")
    bubbleWrap.className = "bubbleWrap"
    merged.forEach((m) => bubbleWrap.appendChild(createBubble(m)))
    wrap.appendChild(bubbleWrap)

    frag.appendChild(wrap)
  })

  return frag
}

function renderListView(rows){
  const frag = document.createDocumentFragment()
  rows.forEach((r) => {
    const msg = document.createElement("div")
    msg.className = "msg"
    msg.id = `msg-${r.id}`
    msg.dataset.itemTs = String(r.ts)
    msg.innerHTML = `
      <div class="msgRow">
        <div class="msgAuthor">${escapeHtml(r.author)}</div>
        <div class="msgDate">${escapeHtml(formatDateTime(r.ts))}</div>
      </div>
      <div class="msgContent">${escapeHtml(r.content)}</div>
    `
    frag.appendChild(msg)
  })
  return frag
}

function renderAnalysisView(rows){
  const root = document.createElement("div")
  root.className = "analysisBox"

  const authorMap = new Map()
  rows.forEach((r) => authorMap.set(r.author, (authorMap.get(r.author) || 0) + 1))
  const authors = [...authorMap.entries()].sort((a, b) => b[1] - a[1])

  const card1 = document.createElement("div")
  card1.className = "analysisItem"
  card1.innerHTML = `<h3>작성자 분포</h3><div class="listMini">${authors.map(([name, count]) => `<div>${escapeHtml(name)} · ${count}개</div>`).join("")}</div>`

  const card2 = document.createElement("div")
  card2.className = "analysisItem"
  const avgLen = rows.length ? Math.round(rows.reduce((acc, r) => acc + (r.content?.length || 0), 0) / rows.length) : 0
  const first = rows[0]?.ts ? formatDateTime(rows[0].ts) : "-"
  const last = rows.at(-1)?.ts ? formatDateTime(rows.at(-1).ts) : "-"
  card2.innerHTML = `
    <h3>기본 통계</h3>
    <div class="listMini">
      <div>평균 길이 · ${avgLen}자</div>
      <div>첫 메시지 · ${escapeHtml(first)}</div>
      <div>마지막 메시지 · ${escapeHtml(last)}</div>
    </div>
  `

  root.appendChild(card1)
  root.appendChild(card2)
  return root
}

function renderGraphView(rows){
  const wrap = document.createElement("div")
  wrap.className = "chartWrap"
  wrap.innerHTML = `<div class="chartBox"><canvas id="msgChart"></canvas></div>`

  queueMicrotask(() => {
    const canvas = document.getElementById("msgChart")
    if (!canvas || typeof Chart === "undefined") return

    const counts = new Map()
    rows.forEach((r) => {
      const key = formatDate(r.ts)
      counts.set(key, (counts.get(key) || 0) + 1)
    })

    const labels = [...counts.keys()]
    const data = [...counts.values()]

    new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{label: "메시지 수", data}]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {labels: {color: "#edf2fb"}}},
        scales: {
          x: {ticks: {color: "#93a0b8"}, grid: {color: "rgba(255,255,255,.08)"}},
          y: {ticks: {color: "#93a0b8"}, grid: {color: "rgba(255,255,255,.08)"}}
        }
      }
    })
  })

  return wrap
}

export function renderThread(){
  const root = list()
  if (!root) return

  root.innerHTML = ""
  const rows = state.filteredRows?.length ? state.filteredRows : state.rows

  if (!rows || !rows.length) {
    root.innerHTML = '<div class="empty">표시할 데이터가 없습니다.</div>'
    renderTimeline()
    return
  }

  if (state.view === "list") root.appendChild(renderListView(rows))
  else if (state.view === "analysis") root.appendChild(renderAnalysisView(rows))
  else if (state.view === "graph") root.appendChild(renderGraphView(rows))
  else root.appendChild(renderThreadView(rows))

  renderTimeline()
}
