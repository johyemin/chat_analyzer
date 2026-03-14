import {applyRows} from "./main.js"

export function loadSample(){
  const rows = []
  const base = new Date("2025-07-21T08:00:00").getTime()

  const convo = [
    ["사용자1", "창문 조금 열어도 될까."],
    ["사용자2", "열어. 오늘 공기가 괜찮네."],
    ["사용자1", "조용하다."],
    ["사용자2", "이 시간 좋아하잖아."],
    ["사용자1", "네가 있어서 더 그런 것 같아."],
    ["사용자2", "그 말은 조금 반칙이다."],
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
