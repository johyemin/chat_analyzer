import {applyRows} from "./main.js"

export function loadSample(){
  const rows = []
  const base = new Date("2025-07-21T08:00:00").getTime()

  const convo = [
    ["김아무", "창문 조금 열어도 될까."],
    ["아무개", "열어. 오늘 공기가 괜찮네."],
    ["김아무", "조용하다."],
    ["아무개", "이 시간 좋아하잖아."],
    ["김아무", "네가 있어서 더 그런 것 같아."],
    ["아무개", "그 말은 조금 반칙이다."],
  ]

  for (let i = 0; i < 80; i++) {
    const [author, text] = convo[i % convo.length]
    rows.push({
      id: `sample-${i + 1}`,
      author,
      content: text,
      ts: base + i * 3600000,
      len: text.length,
    })
  }

  applyRows(rows, "샘플 데이터")
}
