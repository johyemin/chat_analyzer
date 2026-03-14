export const $ = (id) => document.getElementById(id)

export function normalize(v){
  return String(v ?? "").trim()
}

export function normalizeSearch(v){
  return normalize(v)
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export function formatDate(ts){
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return "-"
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

export function formatDateTime(ts){
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return "-"
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${formatDate(d)} ${hh}:${mm}`
}

export function parseDateInput(v){
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.getTime()
  }

  const s = normalize(v)
  if (!s) return null

  const direct = new Date(s)
  if (!Number.isNaN(direct.getTime())) return direct.getTime()

  const ko = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*(오전|오후)?\s*(\d{1,2})?[:시\s]?(\d{1,2})?/) 
  if (ko) {
    let [, y, m, d, ap, hh = "0", mm = "0"] = ko
    let hour = Number(hh)
    if (ap === "오후" && hour < 12) hour += 12
    if (ap === "오전" && hour === 12) hour = 0
    return new Date(Number(y), Number(m) - 1, Number(d), hour, Number(mm || 0), 0, 0).getTime()
  }

  const slash = s.replace(/\./g, "-").replace(/\//g, "-")
  const d2 = new Date(slash)
  if (!Number.isNaN(d2.getTime())) return d2.getTime()

  return null
}

export function escapeHtml(v){
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function tokenize(v){
  return normalizeSearch(v)
    .split(/[^0-9a-zA-Z가-힣_]+/)
    .filter((x) => x && x.length >= 1)
}

export function topAuthors(rows, max = 2){
  const map = new Map()
  rows.forEach((r) => {
    const key = normalize(r.author)
    if (!key) return
    map.set(key, (map.get(key) || 0) + 1)
  })
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name]) => name)
}


export function cleanContentPrefix(text){
  if(!text) return ""
  return text
    .replace(/^((?:ㄴ|>>?|-)??\s*@?[가-힣A-Za-z0-9_]+(?:,\s*)?)+/u,"")
    .replace(/^[\s,\u00A0\u200B]+/,"")
    .trim()
}

export function parseKoreanDate(str){
  if(!str) return null
  const m=str.match(/(\d+)년\s*(\d+)월\s*(\d+)일\s*(오전|오후)\s*(\d+):(\d+)/)
  if(!m) return null
  let[,y,mo,d,ap,h,mi]=m
  y=Number(y)
  mo=Number(mo)-1
  d=Number(d)
  h=Number(h)
  mi=Number(mi)
  if(ap==="오후" && h!==12) h+=12
  if(ap==="오전" && h===12) h=0
  return new Date(y,mo,d,h,mi).getTime()
}
