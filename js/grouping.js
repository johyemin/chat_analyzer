import {state} from "./state.js"

export function mergeSpeaker(rows){
  const merged = []

  rows.forEach((r) => {
    const last = merged[merged.length - 1]
    if (last && last.author === r.author) {
      last.messages.push(r.content)
      last.ts = r.ts
      last.rowIds.push(r.id)
    } else {
      merged.push({
        author: r.author,
        ts: r.ts,
        messages: [r.content],
        rowIds: [r.id],
      })
    }
  })

  return merged
}

export function groupRows(rows){
  if (!rows.length) return []

  const groups = []
  let start = rows[0].ts
  let current = []

  rows.forEach((r) => {
    if (current.length && (r.ts - start) >= state.groupDays * 86400000) {
      groups.push(current)
      current = []
      start = r.ts
    }
    current.push(r)
  })

  if (current.length) groups.push(current)
  return groups
}
