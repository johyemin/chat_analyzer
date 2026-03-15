import {state} from "./state.js"
import {$, normalize, normalizeSearch, parseDateInput, topAuthors, tokenize, parseKoreanDate} from "./utils.js"
import {renderThread} from "./renderer.js"
import {loadSample} from "./sample.js"
import {groupRows} from "./grouping.js"

const els = {
  left: $("speakerLeft"),
  right: $("speakerRight"),
  days: $("groupDays"),
  sampleBtn: $("sampleBtn"),
  resetBtn: $("resetDbBtn"),
  fileInput: $("fileInput"),
  searchInput: $("searchInput"),
  fieldSelect: $("fieldSelect"),
  sortSelect: $("sortSelect"),
  viewSelect: $("viewSelect"),
  chkA: $("chkSuhyeok"),
  chkB: $("chkEunho"),
  chkPair: $("chkPairOnly"),
  summaryTag: $("summaryTag"),
  renderInfo: $("renderInfo"),
  statTotal: $("statTotal"),
  statFiltered: $("statFiltered"),
  statTokens: $("statTokens"),
  statSearchMs: $("statSearchMs"),
  statDbCount: $("statDbCount"),
  statSceneCount: $("statSceneCount"),
  statStatus: $("statStatus"),
  exportCsvBtn: $("exportCsvBtn"),
  exportXlsxBtn: $("exportXlsxBtn"),
  exportJsonBtn: $("exportJsonBtn"),
  pinModal: $("pinModal"),
  pinTitle: $("pinTitle"),
  pinDesc: $("pinDesc"),
  pinInput: $("pinInput"),
  pinConfirmInput: $("pinConfirmInput"),
  pinSubmitBtn: $("pinSubmitBtn"),
  pinResetAllBtn: $("pinResetAllBtn"),
  pinError: $("pinError"),
}

function setStatus(text){
  if (els.statStatus) els.statStatus.textContent = text
}

function buildTokenCount(rows){
  const set = new Set()
  rows.forEach((r) => tokenize(`${r.author} ${r.content}`).forEach((t) => set.add(t)))
  state.tokenCount = set.size
}

function removeDuplicateMessages(rows){
  const seen = new Set()
  const result = []
  for(const r of rows){
    const key = `${r.author}|${r.content}|${r.ts}`
    if(!seen.has(key)){
      seen.add(key)
      result.push(r)
    }
  }
  return result
}

function cleanContentPrefix(text){
  if(!text) return ""
  let content = text.trim()
  content = content.replace(/^(?:ㄴ\s*)?(?:@)?([가-힣A-Za-z0-9_]+)\s+/, (match) => {
    if(match.startsWith("ㄴ") || match.startsWith("@")) return ""
    return match
  })
  content = content.replace(/^[.\s]+/, "")
  return content.trim()
}

function normalizeRow(row, idx){
  const mapper = window.CsvMapper?.detect?.(row) || {}
  const rawAuthor = normalize(row.author ?? row[mapper.author] ?? row.name ?? row.이름 ?? row.작성자)
  const author = rawAuthor.replace(/^[ㄴ>\-@\s]+/, "")
  const content = cleanContentPrefix(row.content ?? row.message ?? row.text ?? row.body ?? row["댓글 내용"] ?? row[mapper.content])
  const ts = parseDateInput(row.ts ?? row.timestamp ?? row["작성 시간"] ?? row.date ?? row.datetime ?? row.created_at ?? "") || parseKoreanDate(row["작성 시간"] ?? "")

  if (!author || !content || !ts) return null

  return {
    id: normalize(row.id ?? row[mapper.message_id] ?? `${author}-${ts}-${idx + 1}`),
    author,
    content,
    ts,
    len: content.length,
    raw: row,
  }
}

async function saveRowsToDb(rows){
  if(!window.ChatDB) return
  try{
    const db = await window.ChatDB.open()
    await window.ChatDB.clearMessages(db)
    await window.ChatDB.putMany(db, rows)
    const count = await window.ChatDB.count(db)
    if(els.statDbCount) els.statDbCount.textContent = String(count)
  }catch(e){
    console.error(e)
  }
}

async function loadRowsFromDb(){
  if(!window.ChatDB) return
  try{
    const db = await window.ChatDB.open()
    const rows = await window.ChatDB.getAllMessages(db)
    if(rows && rows.length) applyRows(rows, "IndexedDB 저장 데이터")
    if(els.statDbCount) els.statDbCount.textContent = String(rows.length || 0)
  }catch(e){
    console.error(e)
  }
}

function syncStateFromInputs(){
  state.speakerLeft = normalize(els.left?.value) || "User1"
  state.speakerRight = normalize(els.right?.value) || "User2"
  state.groupDays = Number(els.days?.value) || 15
  state.sort = els.sortSelect?.value || state.sort
}

function refreshSpeakerLabels(){
  const leftName = state.speakerLeft || "User1"
  const rightName = state.speakerRight || "User2"
  document.querySelectorAll(".tabs .tab").forEach((tab) => {
    const q = tab.dataset.quick
    if (q === "speaker-left") tab.textContent = leftName
    if (q === "speaker-right") tab.textContent = rightName
    if (q === "speaker-both") tab.textContent = `${leftName} + ${rightName}`
  })
  const labelA = els.chkA?.closest("label")?.querySelector("span")
  const labelB = els.chkB?.closest("label")?.querySelector("span")
  const labelPair = els.chkPair?.closest("label")?.querySelector("span")
  if (labelA) labelA.textContent = `${leftName}`
  if (labelB) labelB.textContent = `${rightName}`
  if (labelPair) labelPair.textContent = `함께`
  if (els.renderInfo) els.renderInfo.textContent = `${leftName} / ${rightName}`
}

function assignSpeakersFromRows(rows){
  const names = topAuthors(rows, 2)
  state.speakerLeft = names[0] || state.speakerLeft || "User1"
  state.speakerRight = names[1] || state.speakerRight || "User2"
  if (els.left) els.left.value = state.speakerLeft
  if (els.right) els.right.value = state.speakerRight
  refreshSpeakerLabels()
}

function rowHasSpeaker(row, name){
  const key = normalize(name)
  if (!key) return false
  return normalize(row.author) === key || normalizeSearch(row.content).includes(normalizeSearch(key))
}

function matchQuickFilter(row){
  if (state.quickFilter === "speaker-left") return normalize(row.author) === normalize(state.speakerLeft)
  if (state.quickFilter === "speaker-right") return normalize(row.author) === normalize(state.speakerRight)
  if (state.quickFilter === "speaker-both") return rowHasSpeaker(row, state.speakerLeft) && rowHasSpeaker(row, state.speakerRight)
  return true
}

function matchCharacterFilter(row){
  const leftOn = !!els.chkA?.checked
  const rightOn = !!els.chkB?.checked
  const pairOnly = !!els.chkPair?.checked
  const hasLeft = rowHasSpeaker(row, state.speakerLeft)
  const hasRight = rowHasSpeaker(row, state.speakerRight)

  if (pairOnly) return hasLeft && hasRight
  if (!leftOn && !rightOn) return true
  if (leftOn && rightOn) return hasLeft || hasRight
  if (leftOn) return hasLeft
  if (rightOn) return hasRight
  return true
}

function sortRows(rows){
  const cloned = [...rows]
  cloned.sort((a,b)=>{
    switch(state.sort){
      case "date_desc": return b.ts - a.ts
      case "date_asc": return a.ts - b.ts
      case "author_asc": return a.author.localeCompare(b.author,"ko")
      case "length_desc": return b.len - a.len
      default: return b.ts - a.ts
    }
  })
  return cloned
}

function applyFilters(){
  const started = performance.now()
  const terms = normalizeSearch(state.query).split(/\s+/).filter(Boolean)

  let rows = state.rows.filter((row) => {
    if (!matchQuickFilter(row)) return false
    if (!matchCharacterFilter(row)) return false

    const base = state.field === "author"
      ? normalizeSearch(row.author)
      : state.field === "content"
        ? normalizeSearch(row.content)
        : normalizeSearch(`${row.author} ${row.content}`)

    return terms.every((term) => base.includes(term))
  })

  rows = sortRows(rows)
  state.filteredRows = rows
  state.searchMs = Math.round((performance.now() - started) * 10) / 10

  if (els.statFiltered) els.statFiltered.textContent = String(rows.length)
  if (els.statSearchMs) els.statSearchMs.textContent = `${state.searchMs}ms`
  if (els.statSceneCount) els.statSceneCount.textContent = String(groupRows(rows).length)
  if (els.summaryTag) els.summaryTag.textContent = rows.length ? `${rows.length}개 메시지 표시 중` : "검색 결과 없음"

  renderThread()
}

function getExportRows(){
  return state.rows.map(r => ({
    date: new Date(r.ts).toISOString(),
    author: r.author,
    content: r.content,
  }))
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportJSON(filename = "chat_export.json"){
  downloadBlob(new Blob([JSON.stringify(state.rows, null, 2)], {type: "application/json"}), filename)
}

function exportCSV(){
  const rows = getExportRows()
  const lines = ["date,author,content"]
  rows.forEach(row => {
    const cells = [row.date, row.author, row.content].map(v => `"${String(v).replace(/"/g, '""')}"`)
    lines.push(cells.join(","))
  })
  downloadBlob(new Blob(["\uFEFF" + lines.join("\n")], {type: "text/csv;charset=utf-8"}), "chat_export.csv")
}

function exportXLSX(){
  const ws = window.XLSX.utils.json_to_sheet(getExportRows())
  const wb = window.XLSX.utils.book_new()
  window.XLSX.utils.book_append_sheet(wb, ws, "chat")
  window.XLSX.writeFile(wb, "chat_export.xlsx")
}

// function triggerAutoBackup(){
//   if(!state.rows.length) return
//   exportJSON("chat_backup.json")
// }

export function applyRows(rows, sourceName = "업로드 데이터"){
  const clean = removeDuplicateMessages(rows
    .map((row, idx) => row.id && row.author && row.content && row.ts ? row : normalizeRow(row, idx))
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts))

  state.rows = clean
  state.sourceName = sourceName

  buildTokenCount(clean)
  assignSpeakersFromRows(clean)

  if (els.statTotal) els.statTotal.textContent = String(clean.length)
  if (els.statTokens) els.statTokens.textContent = String(state.tokenCount)
  if (els.summaryTag) els.summaryTag.textContent = `${sourceName} · ${clean.length}개 메시지`
  setStatus(clean.length ? "로딩 완료" : "데이터 없음")

  saveRowsToDb(clean)
  applyFilters()
}

async function parseCsv(file){
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const parseLine = (line) => {
    const out = []
    let cur = ""
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++ }
        else q = !q
      } else if (ch === ',' && !q) {
        out.push(cur)
        cur = ""
      } else cur += ch
    }
    out.push(cur)
    return out.map((v) => v.trim())
  }
  const headers = parseLine(lines[0])
  return lines.slice(1).map((line) => {
    const cols = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = cols[i] ?? "" })
    return row
  })
}

async function parseJson(file){
  const json = JSON.parse(await file.text())
  if (Array.isArray(json)) return json
  if (Array.isArray(json.rows)) return json.rows
  if (Array.isArray(json.messages)) return json.messages
  return []
}

async function parseXlsx(file){
  const buf = await file.arrayBuffer()
  const wb = window.XLSX.read(buf, {type: "array"})
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  return window.XLSX.utils.sheet_to_json(sheet, {defval: ""})
}

async function askUploadMode(){
  return new Promise(resolve=>{
    const modal = document.getElementById("uploadChoiceModal")
    modal.classList.remove("hidden")
    const addBtn = document.getElementById("btnUploadAdd")
    const replaceBtn = document.getElementById("btnUploadReplace")
    const cancelBtn = document.getElementById("btnUploadCancel")
    const close = (value)=>{
      modal.classList.add("hidden")
      resolve(value)
    }
    addBtn.onclick = ()=>close("add")
    replaceBtn.onclick = ()=>close("replace")
    cancelBtn.onclick = ()=>close("cancel")
  })
}

async function handleFiles(files){
  const merged = []
  for (const file of files) {
    const name = file.name.toLowerCase()
    let rows = []
    if (name.endsWith(".csv")) rows = await parseCsv(file)
    else if (name.endsWith(".json")) rows = await parseJson(file)
    else if (name.endsWith(".xlsx")) rows = await parseXlsx(file)
    merged.push(...rows)
  }

  if(!merged.length) return
  const hasExisting = state.rows.length > 0
  const mode = hasExisting ? await askUploadMode() : "replace"
  if(mode === "cancel") return

  const normalized = merged.map((row,idx)=>normalizeRow(row,idx)).filter(Boolean)
  let finalRows = []
  if(mode === "replace"){
    finalRows = removeDuplicateMessages(normalized)
  }else{
    finalRows = removeDuplicateMessages([...state.rows, ...normalized])
  }

  applyRows(finalRows, files.length === 1 ? files[0].name : `파일 ${files.length}개 병합`)
  if(els.fileInput) els.fileInput.value = ""
}

function initTabs(){
  const tabs = document.querySelectorAll(".tabs .tab")
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"))
      tab.classList.add("active")
      state.quickFilter = tab.dataset.quick || "all"
      applyFilters()
    })
  })
}

async function hashPin(pin){
  const buf = new TextEncoder().encode(pin)
  const hash = await crypto.subtle.digest("SHA-256", buf)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("")
}

async function openPinGate(){
  const db = await window.ChatDB.open()
  const savedPinHash = await window.ChatDB.getMeta(db, "pinHash")

  els.pinError.textContent = ""
  els.pinInput.value = ""
  els.pinConfirmInput.value = ""

  if(savedPinHash){
    els.pinTitle.textContent = "PIN 확인"
    els.pinDesc.textContent = "저장된 데이터를 열려면 PIN을 입력하세요."
    els.pinConfirmInput.classList.add("hidden")
  }else{
    els.pinTitle.textContent = "PIN 생성"
    els.pinDesc.textContent = "처음 사용하는 경우 PIN을 생성합니다."
    els.pinConfirmInput.classList.remove("hidden")
  }

  els.pinModal.classList.remove("hidden")

  return new Promise(resolve => {
    const onSubmit = async () => {
      const pin = normalize(els.pinInput.value)
      const confirmPin = normalize(els.pinConfirmInput.value)
      if(!pin || pin.length < 4){
        els.pinError.textContent = "PIN은 4자리 이상으로 입력해 주세요."
        return
      }

      if(!savedPinHash){
        if(pin !== confirmPin){
          els.pinError.textContent = "PIN 확인값이 일치하지 않습니다."
          return
        }
        await window.ChatDB.setMeta(db, "pinHash", await hashPin(pin))
        els.pinModal.classList.add("hidden")
        resolve(true)
        return
      }

      const enteredHash = await hashPin(pin)
      if(enteredHash !== savedPinHash){
        els.pinError.textContent = "PIN이 올바르지 않습니다."
        return
      }

      els.pinModal.classList.add("hidden")
      resolve(true)
    }

    const onReset = async () => {
      await window.ChatDB.clearAll(db)
      state.rows = []
      state.filteredRows = []
      els.pinModal.classList.add("hidden")
      resolve(false)
      location.reload()
    }

    els.pinSubmitBtn.onclick = onSubmit
    els.pinResetAllBtn.onclick = onReset
  })
}

function initEvents(){
  els.left?.addEventListener("input", () => { syncStateFromInputs(); refreshSpeakerLabels(); applyFilters() })
  els.right?.addEventListener("input", () => { syncStateFromInputs(); refreshSpeakerLabels(); applyFilters() })
  els.days?.addEventListener("change", () => { syncStateFromInputs(); applyFilters() })
  els.sampleBtn?.addEventListener("click", loadSample)
  els.fileInput?.addEventListener("change", (e) => handleFiles([...e.target.files]))
  els.searchInput?.addEventListener("input", (e) => { state.query = e.target.value; applyFilters() })
  els.fieldSelect?.addEventListener("change", (e) => { state.field = e.target.value; applyFilters() })
  els.sortSelect?.addEventListener("change", (e) => { state.sort = e.target.value; applyFilters() })
  els.viewSelect?.addEventListener("change", (e) => {
    const val = e.target.value
    state.view = ["thread", "list", "graph", "analysis", "emotion"].includes(val) ? val : "thread"
    renderThread()
  })
  ;[els.chkA, els.chkB, els.chkPair].forEach((el) => el?.addEventListener("change", applyFilters))
  els.resetBtn?.addEventListener("click", async () => {
    state.rows = []
    state.filteredRows = []
    renderThread()
    if (window.ChatDB) {
      const db = await window.ChatDB.open()
      await window.ChatDB.clearMessages(db)
      if (els.statDbCount) els.statDbCount.textContent = "0"
    }
    if (els.summaryTag) els.summaryTag.textContent = "데이터 없음"
    if (els.statTotal) els.statTotal.textContent = "0"
    if (els.statFiltered) els.statFiltered.textContent = "0"
    if (els.statSceneCount) els.statSceneCount.textContent = "0"
    setStatus("DB 초기화 완료")
  })

  els.exportCsvBtn?.addEventListener("click", exportCSV)
  els.exportXlsxBtn?.addEventListener("click", exportXLSX)
  els.exportJsonBtn?.addEventListener("click", () => exportJSON())

  window.addEventListener("beforeunload", () => {
    if(state.rows.length) triggerAutoBackup()
  })
  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "hidden" && state.rows.length) triggerAutoBackup()
  })
}

window.ChatViewer = {
  setRows(rows){
    applyRows(rows, "외부 주입 데이터")
  }
}

syncStateFromInputs()
refreshSpeakerLabels()
initTabs()
initEvents()
renderThread()
setStatus("대기")
await openPinGate()
loadRowsFromDb()
