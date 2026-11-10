/**
 * Minimal bidirectional (bidi) text support for PDFKit documents.
 *
 * PDFKit lays out text strictly left-to-right and performs no bidi or
 * shaping, so a Persian sentence such as "قرارداد اجاره" renders with its
 * letters mirrored. This helper compensates at the string level:
 *
 *   1. The text is split into runs of (a) Persian/Arabic letters and
 *      (b) everything else (digits, Latin, punctuation, whitespace).
 *   2. The run order is reversed (so the first logical run becomes the
 *      right-most visual run).
 *   3. The character order inside letter runs is reversed.
 *
 * Digit and Latin runs are left untouched, which keeps numbers and IDs
 * readable inside RTL sentences. This is a simplified bidi pass — it does
 * not implement the full Unicode Bidi Algorithm — and is sufficient for
 * the contract document whose content is predictable.
 */

// Arabic-Indic (\u0660-\u0669) and extended Arabic-Indic (\u06F0-\u06F9)
// digits are read left-to-right even inside RTL text, so they must not be
// treated as letters.
const ARABIC_DIGIT = /[\u0660-\u0669\u06F0-\u06F9]/

function isRtlLetter(ch: string): boolean {
  const code = ch.codePointAt(0) as number
  if (ARABIC_DIGIT.test(ch)) return false
  // Arabic decimal (\u066B) and thousands (\u066C) separators keep natural order
  if (code === 0x066b || code === 0x066c) return false
  // ZWNJ / ZWJ glue Persian words together and belong to the letter run
  if (code === 0x200c || code === 0x200d) return true
  return (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  )
}

function reverseChars(text: string): string {
  return Array.from(text).reverse().join('')
}

/**
 * Reorder a mixed Persian/Latin string so that it renders correctly inside
 * PDFKit's left-to-right layout engine.
 */
export function faLine(text: string): string {
  const runs: string[] = []
  let run = ''
  let runIsRtl: boolean | null = null
  for (const ch of text) {
    const rtl = isRtlLetter(ch)
    if (runIsRtl === null || runIsRtl === rtl) {
      run += ch
      runIsRtl = rtl
    } else {
      runs.push(runIsRtl ? reverseChars(run) : run)
      run = ch
      runIsRtl = rtl
    }
  }
  if (run) runs.push(runIsRtl ? reverseChars(run) : run)
  return runs.reverse().join('')
}
