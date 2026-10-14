const SHEET_SYNC_MAX_ROWS = 500
const SHEET_SYNC_MAX_COLUMNS = 100

function doPost(event) {
  try {
    const body = JSON.parse(
      (event && event.postData && event.postData.contents) || '{}',
    )
    assertSyncSecret(body.secret)

    if (body.action === 'listSheets') {
      return jsonResponse({ ok: true, data: listExpenseSheets(body) })
    }
    if (body.action === 'previewSheet') {
      return jsonResponse({ ok: true, data: previewExpenseSheet(body) })
    }
    throw new Error('Unknown sheet sync action.')
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || 'Sheet sync failed.',
    })
  }
}

function assertSyncSecret(secret) {
  const expected =
    PropertiesService.getScriptProperties().getProperty('SHEET_SYNC_SECRET')
  if (expected && String(secret || '') !== expected) {
    throw new Error('This sheet sync request is not authorized.')
  }
}

function openExpenseSpreadsheet(spreadsheetId) {
  const id = String(spreadsheetId || '').trim()
  if (!id) throw new Error('Spreadsheet ID is missing.')
  return SpreadsheetApp.openById(id)
}

function isGridSheet(sheet) {
  return sheet.getType() === SpreadsheetApp.SheetType.GRID
}

function listExpenseSheets(body) {
  const spreadsheet = openExpenseSpreadsheet(body.spreadsheetId)
  const page = Math.max(1, Number(body.page) || 1)
  const pageSize = Math.min(5, Math.max(1, Number(body.pageSize) || 5))
  const search = normalizeText(body.search)
  const sheets = spreadsheet
    .getSheets()
    .filter(function (sheet) {
      return (
        isGridSheet(sheet) &&
        (!search || normalizeText(sheet.getName()).indexOf(search) !== -1)
      )
    })
    .map(function (sheet) {
      return {
        sheetId: String(sheet.getSheetId()),
        title: sheet.getName(),
        rowCount: sheet.getLastRow(),
        columnCount: sheet.getLastColumn(),
      }
    })
  const totalPages = Math.max(1, Math.ceil(sheets.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize

  return {
    sheets: sheets.slice(start, start + pageSize),
    pagination: {
      page: safePage,
      pageSize: pageSize,
      total: sheets.length,
      totalPages: totalPages,
    },
  }
}

function previewExpenseSheet(body) {
  const spreadsheet = openExpenseSpreadsheet(body.spreadsheetId)
  const wantedId = String(body.sheetId || '')
  const sheet = spreadsheet.getSheets().find(function (candidate) {
    return String(candidate.getSheetId()) === wantedId
  })
  if (!sheet) throw new Error('That sheet no longer exists. Refresh the list.')
  if (!isGridSheet(sheet)) {
    throw new Error('Only regular spreadsheet tabs can be imported.')
  }

  const rowCount = sheet.getLastRow()
  const columnCount = sheet.getLastColumn()
  if (!rowCount || !columnCount) throw new Error('This sheet is empty.')
  if (rowCount > SHEET_SYNC_MAX_ROWS || columnCount > SHEET_SYNC_MAX_COLUMNS) {
    throw new Error(
      'This sheet is too large to import safely. Keep it under ' +
        SHEET_SYNC_MAX_ROWS +
        ' rows and ' +
        SHEET_SYNC_MAX_COLUMNS +
        ' columns.',
    )
  }

  const range = sheet.getRange(1, 1, rowCount, columnCount)
  const values = range.getDisplayValues()
  const headerRowIndex = findHeaderRow(values)
  if (headerRowIndex === -1) {
    throw new Error('Expected a header row containing items and total.')
  }

  const header = values[headerRowIndex].map(normalizeText)
  const itemsColumn = header.indexOf('items')
  const totalColumn = header.indexOf('total')
  const priceColumn = header.indexOf('price')
  if (itemsColumn === -1 || totalColumn <= itemsColumn + 1) {
    throw new Error('Expected person columns between items and total.')
  }

  const labelRows = findSummaryRows(values, headerRowIndex, itemsColumn)
  const issues = []
  ;['total', 'given', 'pending'].forEach(function (label) {
    if (labelRows[label].length !== 1) {
      issues.push({
        code: 'summary_' + label,
        severity: 'error',
        message:
          labelRows[label].length === 0
            ? 'Missing the ' + label.toUpperCase() + ' summary row.'
            : 'Found more than one ' + label.toUpperCase() + ' summary row.',
      })
    }
  })

  const formulaError = values.some(function (row) {
    return row.some(function (value) {
      return /^#(REF!|VALUE!|N\/A|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)/i.test(
        String(value).trim(),
      )
    })
  })
  if (formulaError) {
    issues.push({
      code: 'formula_error',
      severity: 'error',
      message: 'The sheet contains a formula error. Fix it before syncing.',
    })
  }

  const hasSummaryRows =
    labelRows.total.length === 1 &&
    labelRows.given.length === 1 &&
    labelRows.pending.length === 1
  const people = []
  const seenHeaders = {}

  for (let column = itemsColumn + 1; column < totalColumn; column += 1) {
    const rawName = String(values[headerRowIndex][column] || '').trim()
    const normalizedName = normalizeText(rawName)
    if (!rawName) {
      issues.push({
        code: 'blank_person',
        severity: 'error',
        message: 'A person column has no name.',
      })
      continue
    }
    if (seenHeaders[normalizedName]) {
      issues.push({
        code: 'duplicate_person',
        severity: 'error',
        message: rawName + ' appears in more than one person column.',
      })
    }
    seenHeaders[normalizedName] = true

    if (!hasSummaryRows) continue
    const total = parseMoney(values[labelRows.total[0]][column])
    const given = parseMoney(values[labelRows.given[0]][column])
    const pending = parseMoney(values[labelRows.pending[0]][column])
    if (total === null || given === null || pending === null) {
      issues.push({
        code: 'invalid_amount',
        severity: 'error',
        message: rawName + ' has a non-numeric TOTAL, GIVEN, or pending value.',
      })
      continue
    }
    if (Math.abs(total - given - pending) > 0.01) {
      issues.push({
        code: 'person_reconciliation',
        severity: 'error',
        message: rawName + ' does not satisfy pending = TOTAL - GIVEN.',
      })
    }
    people.push({
      rawName: rawName,
      total: total,
      given: given,
      pending: pending,
      requiresReview: /[+&/,]/.test(rawName),
    })
  }

  let totalAmount = 0
  let givenAmount = 0
  let pendingAmount = 0
  people.forEach(function (person) {
    totalAmount += person.total
    givenAmount += person.given
    pendingAmount += person.pending
  })
  if (Math.abs(pendingAmount) > 0.01) {
    issues.push({
      code: 'unbalanced_pending',
      severity: 'error',
      message: 'All pending balances must add up to ₹0.',
    })
  }
  if (Math.abs(totalAmount - givenAmount) > 0.01) {
    issues.push({
      code: 'unbalanced_given',
      severity: 'error',
      message: 'TOTAL and GIVEN do not reconcile.',
    })
  }

  let priceAmount = null
  if (hasSummaryRows && priceColumn !== -1) {
    priceAmount = parseMoney(values[labelRows.total[0]][priceColumn])
    if (priceAmount !== null && Math.abs(priceAmount - totalAmount) > 0.01) {
      issues.push({
        code: 'price_mismatch',
        severity: 'warning',
        message:
          'Price total (' +
          formatAmount(priceAmount) +
          ') differs from the people total (' +
          formatAmount(totalAmount) +
          '). Pending balances will be used.',
      })
    }
  }

  return {
    spreadsheetId: String(body.spreadsheetId),
    sheetId: wantedId,
    sheetTitle: sheet.getName(),
    fingerprint: fingerprint(values),
    people: people,
    issues: issues,
    totals: {
      total: roundMoney(totalAmount),
      given: roundMoney(givenAmount),
      pending: roundMoney(pendingAmount),
      price: priceAmount === null ? null : roundMoney(priceAmount),
    },
  }
}

function findHeaderRow(values) {
  const limit = Math.min(values.length, 10)
  for (let row = 0; row < limit; row += 1) {
    const normalized = values[row].map(normalizeText)
    if (
      normalized.indexOf('items') !== -1 &&
      normalized.indexOf('total') !== -1
    ) {
      return row
    }
  }
  return -1
}

function findSummaryRows(values, headerRowIndex, itemsColumn) {
  const result = { total: [], given: [], pending: [] }
  for (let row = headerRowIndex + 1; row < values.length; row += 1) {
    const label = normalizeText(values[row][itemsColumn])
    if (Object.prototype.hasOwnProperty.call(result, label)) {
      result[label].push(row)
    }
  }
  return result
}

function parseMoney(value) {
  const raw = String(value === undefined || value === null ? '' : value).trim()
  if (!raw) return 0
  const negativeParentheses = /^\(.*\)$/.test(raw)
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/[()]/g, '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const parsed = Number(cleaned)
  return roundMoney(negativeParentheses ? -parsed : parsed)
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function formatAmount(value) {
  return '₹' + roundMoney(value).toLocaleString('en-IN')
}

function fingerprint(values) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(values),
    Utilities.Charset.UTF_8,
  )
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '')
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
