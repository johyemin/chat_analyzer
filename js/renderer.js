import {state} from "./state.js"
import {formatDate, formatDateTime, escapeHtml, normalizeSearch} from "./utils.js"
import {groupRows, mergeSpeaker} from "./grouping.js"
import {renderTimeline} from "./timeline.js"

const list = () => document.getElementById("viewRoot")
let currentChart = null

const EMOTION_ORDER = ["애정","애증","갈등","집착","증오","의존"]
const EMOTION_SCORE = {
  "애정": {keywords:["좋아","사랑","고마","감사","보고싶","반칙","소중","안심","따뜻","괜찮"], score: 1},
  "애증": {keywords:["그래도","하지만","그런데","밉","미워","복잡","이상해","반칙"], score: 2},
  "갈등": {keywords:["왜","아니","그만","하지마","싫어","짜증","싸우","곤란","화나"], score: 3},
  "집착": {keywords:["놓고 싶지","놓지","내 거","못 보내","계속","붙잡","가지마","원해"], score: 4},
  "증오": {keywords:["꺼져","죽","없어져","혐오","망해","미친","증오","최악"], score: 5},
  "의존": {keywords:["필요해","없으면","너밖에","혼자 못","의지","기대","곁에","있어줘"], score: 6},
}

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

  const author = document.createElement("span")
  author.className = "bubbleAuthor"
  author.textContent = item.author

  const date = document.createElement("span")
  date.className = "bubbleDate"
  date.textContent = formatDateTime(item.ts)

  meta.append(author, date)
  bubble.appendChild(meta)

  item.messages.forEach((text) => {
    const div = document.createElement("div")
    div.className = "bubbleText"
    div.textContent = text

    if (text.length > 500) {
      div.classList.add("is-truncated")
      const btn = document.createElement("button")
      btn.className = "msg-toggle"
      btn.type = "button"
      btn.textContent = "전체 보기"
      btn.addEventListener("click", () => {
        const expanded = !div.classList.contains("is-truncated")
        if (expanded) {
          div.classList.add("is-truncated")
          btn.textContent = "전체 보기"
        } else {
          div.classList.remove("is-truncated")
          btn.textContent = "접기"
        }
      })
      bubble.append(div, btn)
    } else {
      bubble.appendChild(div)
    }
  })

  row.appendChild(bubble)
  return row
}

function renderThreadView(rows){
  const ordered = [...rows].sort((a, b) => a.ts - b.ts)
  const groups = groupRows(ordered)

  if (state.sort === "date_desc") groups.reverse()

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

function destroyChart(){
  if(currentChart){
    currentChart.destroy()
    currentChart = null
  }
}

function renderGraphView(rows){
  const wrap = document.createElement("div")
  wrap.className = "chartWrap"
  wrap.innerHTML = `<div class="chartBox"><canvas id="msgChart"></canvas></div>`

  queueMicrotask(() => {
    const canvas = document.getElementById("msgChart")
    if (!canvas || typeof Chart === "undefined") return
    destroyChart()

    const counts = new Map()
    rows.forEach((r) => {
      const key = formatDate(r.ts)
      counts.set(key, (counts.get(key) || 0) + 1)
    })

    currentChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: [...counts.keys()],
        datasets: [{label: "메시지 수", data: [...counts.values()]}]
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

function detectEmotion(text){
  const src = normalizeSearch(text)
  const hitCounts = new Map(EMOTION_ORDER.map(name => [name, 0]))

  for(const name of EMOTION_ORDER){
    for(const keyword of EMOTION_SCORE[name].keywords){
      if(src.includes(normalizeSearch(keyword))){
        hitCounts.set(name, hitCounts.get(name) + 1)
      }
    }
  }

  const best = [...hitCounts.entries()].sort((a,b)=> b[1]-a[1] || EMOTION_ORDER.indexOf(a[0]) - EMOTION_ORDER.indexOf(b[0]))[0]
  return best && best[1] > 0 ? best[0] : null
}

function buildEmotionSeries(rows){
  const relevant = [...rows]
    .filter(r => [state.speakerLeft, state.speakerRight].includes(r.author))
    .sort((a,b)=>a.ts-b.ts)

  const buckets = new Map()
  for(const row of relevant){
    const date = formatDate(row.ts)
    const emotion = detectEmotion(`${row.author} ${row.content}`)
    if(!buckets.has(date)) buckets.set(date, [])
    if(emotion) buckets.get(date).push(emotion)
  }

  const points = []
  for(const [date, emotions] of buckets.entries()){
    if(!emotions.length) continue
    const counts = new Map(EMOTION_ORDER.map(name => [name, 0]))
    emotions.forEach(name => counts.set(name, (counts.get(name) || 0) + 1))
    const bestEmotion = [...counts.entries()].sort((a,b)=> b[1]-a[1] || EMOTION_ORDER.indexOf(a[0]) - EMOTION_ORDER.indexOf(b[0]))[0][0]
    points.push({ date, emotion: bestEmotion, y: EMOTION_ORDER.indexOf(bestEmotion) + 1 })
  }
  return points
}

function renderEmotionView(rows){
  const wrap = document.createElement("div")
  wrap.className = "chartWrap"
  wrap.innerHTML = `
    <div class="analysisItem emotion-legend">
      <h3>${escapeHtml(state.speakerLeft)} ↔ ${escapeHtml(state.speakerRight)} 관계 감정</h3>
      <div class="listMini"><div>애정 · 애증 · 갈등 · 집착 · 증오 · 의존</div></div>
    </div>
    <div class="chartBox"><canvas id="emotionChart"></canvas></div>
  `

  queueMicrotask(() => {
    const canvas = document.getElementById("emotionChart")
    if (!canvas || typeof Chart === "undefined") return
    destroyChart()

    const series = buildEmotionSeries(rows)

    currentChart = new Chart(canvas, {
      type: "scatter",
      data: {
        datasets: [{
          label: "관계 감정",
          data: series.map((item, idx) => ({x: idx + 1, y: item.y, label: item.date, emotion: item.emotion})),
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {labels: {color: "#edf2fb"}},
          tooltip: {
            callbacks: {
              label(ctx){
                const raw = ctx.raw || {}
                return `${raw.label || "-"} · ${raw.emotion || "분석 없음"}`
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: "#93a0b8",
              callback(value){
                const idx = Number(value) - 1
                return series[idx]?.date || ""
              }
            },
            grid: {color: "rgba(255,255,255,.08)"}
          },
          y: {
            min: 1,
            max: 6,
            ticks: {
              stepSize: 1,
              color: "#93a0b8",
              callback(value){
                return EMOTION_ORDER[value - 1] || ""
              }
            },
            grid: {color: "rgba(255,255,255,.08)"}
          }
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
    destroyChart()
    root.innerHTML = '<div class="empty">표시할 데이터가 없습니다.</div>'
    renderTimeline()
    return
  }

  if (state.view === "list") root.appendChild(renderListView(rows))
  else if (state.view === "analysis") root.appendChild(renderAnalysisView(rows))
  else if (state.view === "graph") root.appendChild(renderGraphView(rows))
  else if (state.view === "emotion") root.appendChild(renderEmotionView(rows))
  else {
    destroyChart()
    root.appendChild(renderThreadView(rows))
  }

  renderTimeline()
}
