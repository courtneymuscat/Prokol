export function isMarkdown(s: string) {
  return !/<[a-z][\s\S]*>/i.test(s.trim())
}

export function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  let html = ''
  let inUl = false
  let inOl = false

  function closeList() {
    if (inUl) { html += '</ul>'; inUl = false }
    if (inOl) { html += '</ol>'; inOl = false }
  }

  function inline(t: string) {
    return t
      .replace(/&/g, '&amp;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
  }

  for (const raw of lines) {
    const isUlItem = /^- /.test(raw)
    const isOlItem = /^\d+\. /.test(raw)

    if (!isUlItem && inUl) { html += '</ul>'; inUl = false }
    if (!isOlItem && inOl) { html += '</ol>'; inOl = false }

    if (/^## /.test(raw)) {
      closeList()
      html += `<h3>${inline(raw.slice(3).trim())}</h3>`
    } else if (/^### /.test(raw)) {
      closeList()
      html += `<h4>${inline(raw.slice(4).trim())}</h4>`
    } else if (isUlItem) {
      if (!inUl) { html += '<ul>'; inUl = true }
      html += `<li>${inline(raw.slice(2).trim()) || '<br>'}</li>`
    } else if (isOlItem) {
      if (!inOl) { html += '<ol>'; inOl = true }
      html += `<li>${inline(raw.replace(/^\d+\. /, '').trim()) || '<br>'}</li>`
    } else if (raw.trim() === '') {
      // skip blank lines
    } else {
      html += `<p>${inline(raw.trim()) || '<br>'}</p>`
    }
  }

  closeList()
  return html || '<p><br></p>'
}

export function noteBodyToHtml(body: string): string {
  return isMarkdown(body) ? markdownToHtml(body) : body
}
