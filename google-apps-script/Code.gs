/**
 * Expense Tracker - Google Sheets API
 *
 * Setup:
 * 1. Open your "Expence Tracker Live" spreadsheet
 * 2. Extensions > Apps Script
 * 3. Paste this file and save
 * 4. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL into your React .env as VITE_SHEETS_API_URL
 */

const MASTER_SHEET_NAME = 'MASTER'
const SPREADSHEET_ID = '1nRWaLjQCPJ8bzD5biPzn354v25GJSgqGrKXJwr7-J0Q'
const RESERVED_SHEET_NAMES = [MASTER_SHEET_NAME]
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 20

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet()
  if (active) {
    return active
  }

  return SpreadsheetApp.openById(SPREADSHEET_ID)
}

function getSheet_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName)

  if (!sheet) {
    throw new Error(sheetName + ' sheet not found')
  }

  return sheet
}

function getMasterSheet_() {
  return getSheet_(MASTER_SHEET_NAME)
}

function isReservedSheetName_(name) {
  return RESERVED_SHEET_NAMES.indexOf(String(name).trim().toUpperCase()) !== -1
}

function normalizePageSize_(pageSize) {
  const size = Number(pageSize) || DEFAULT_PAGE_SIZE
  return Math.min(Math.max(1, size), MAX_PAGE_SIZE)
}

function normalizePage_(page) {
  return Math.max(1, Number(page) || 1)
}

function getPaginatedItems_(items, page, pageSize) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    pagination: {
      page: safePage,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
    },
  }
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  )
}

function doGet() {
  return jsonResponse_({
    success: true,
    message: 'Expense Tracker Sheets API is running',
  })
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const action = body.action

    switch (action) {
      case 'login':
        return handleLogin_(body.email, body.password)
      case 'getProfile':
        return handleGetProfile_(body.email)
      case 'updateProfile':
        return handleUpdateProfile_(body.email, body.profile)
      case 'listSheets':
        return handleListSheets_(body.page, body.pageSize)
      case 'listMasterUserOptions':
        return handleListMasterUserOptions_(body.requesterEmail)
      case 'createSheet':
        return handleCreateSheet_(
          body.name,
          body.users,
          body.items,
          body.requesterEmail,
        )
      case 'getExpenseSheet':
        return handleGetExpenseSheet_(body.sheetId, body.requesterEmail)
      case 'updateExpenseSheet':
        return handleUpdateExpenseSheet_(
          body.sheetId,
          body.requesterEmail,
          body.payload,
        )
      case 'listUsers':
        return handleListUsers_(body.requesterEmail, body.page, body.pageSize)
      case 'createUser':
        return handleCreateUser_(body.requesterEmail, body.user)
      case 'updateUser':
        return handleUpdateUser_(body.requesterEmail, body.rowId, body.user)
      case 'deleteUser':
        return handleDeleteUser_(body.requesterEmail, body.rowId)
      default:
        return jsonResponse_({ success: false, message: 'Unknown action' })
    }
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message || 'Server error',
    })
  }
}

function parseNumber_(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const num = Number(value)
  return isNaN(num) ? null : num
}

function buildUserFromRow_(row) {
  const user = buildMasterUserFromRow_(row, null)
  delete user.rowId
  delete user.password
  return user
}

function buildMasterUserFromRow_(row, rowId) {
  const [name, rowEmail, password, type, age, score] = row

  return {
    rowId: rowId,
    name: String(name || '').trim(),
    email: String(rowEmail || '').trim(),
    password: String(password || '').trim(),
    type: String(type || '').trim(),
    age: parseNumber_(age),
    score: parseNumber_(score),
  }
}

function normalizeEmail_(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function findUserRowIndexByEmail_(rows, email, excludeRowId) {
  const normalizedEmail = normalizeEmail_(email)

  for (var i = 1; i < rows.length; i++) {
    var rowId = i + 1

    if (excludeRowId && rowId === excludeRowId) {
      continue
    }

    var rowEmail = normalizeEmail_(rows[i][1])

    if (rowEmail === normalizedEmail) {
      return rowId
    }
  }

  return null
}

var ALLOWED_USER_TYPES = ['SUPER ADMIN', 'User']

function isValidUserType_(type) {
  return ALLOWED_USER_TYPES.indexOf(String(type || '').trim()) !== -1
}

function validateUserInput_(user, isUpdate) {
  var name = String((user && user.name) || '').trim()
  var email = String((user && user.email) || '').trim()
  var password = String((user && user.password) || '').trim()
  var type = String((user && user.type) || 'User').trim()
  var age = parseNumber_(user && user.age)
  var score = parseNumber_(user && user.score)

  if (!name) {
    throw new Error('Name is required')
  }

  if (!email) {
    throw new Error('Email is required')
  }

  if (!isUpdate && !password) {
    throw new Error('Password is required')
  }

  if (!isValidUserType_(type)) {
    throw new Error('Type must be SUPER ADMIN or User')
  }

  return {
    name: name,
    email: email,
    password: password,
    type: type,
    age: age,
    score: score,
  }
}

function userInputToRow_(userInput) {
  return [
    userInput.name,
    userInput.email,
    userInput.password,
    userInput.type,
    userInput.age === null ? '' : userInput.age,
    userInput.score === null ? '' : userInput.score,
  ]
}

function handleGetProfile_(email) {
  if (!email) {
    return jsonResponse_({
      success: false,
      message: 'Email is required',
    })
  }

  var sheet = getMasterSheet_()
  var rows = sheet.getDataRange().getValues()
  var normalizedEmail = normalizeEmail_(email)

  for (var i = 1; i < rows.length; i++) {
    if (normalizeEmail_(rows[i][1]) === normalizedEmail) {
      return jsonResponse_({
        success: true,
        user: buildUserFromRow_(rows[i]),
      })
    }
  }

  return jsonResponse_({
    success: false,
    message: 'User not found',
  })
}

function handleUpdateProfile_(email, profile) {
  if (!email) {
    return jsonResponse_({
      success: false,
      message: 'Email is required',
    })
  }

  var name = String((profile && profile.name) || '').trim()
  var age = parseNumber_(profile && profile.age)

  if (!name) {
    return jsonResponse_({
      success: false,
      message: 'Name is required',
    })
  }

  var sheet = getMasterSheet_()
  var rows = sheet.getDataRange().getValues()
  var normalizedEmail = normalizeEmail_(email)

  for (var i = 1; i < rows.length; i++) {
    if (normalizeEmail_(rows[i][1]) === normalizedEmail) {
      var rowId = i + 1
      var existing = rows[i]
      var updatedRow = [
        name,
        existing[1],
        existing[2],
        existing[3],
        age === null ? '' : age,
        existing[5],
      ]

      sheet.getRange(rowId, 1, 1, 6).setValues([updatedRow])

      return jsonResponse_({
        success: true,
        user: buildUserFromRow_(updatedRow),
      })
    }
  }

  return jsonResponse_({
    success: false,
    message: 'User not found',
  })
}

function handleLogin_(email, password) {
  if (!email || !password) {
    return jsonResponse_({
      success: false,
      message: 'Email and password are required',
    })
  }

  const sheet = getMasterSheet_()
  const rows = sheet.getDataRange().getValues()
  const normalizedEmail = String(email).trim().toLowerCase()
  const normalizedPassword = String(password).trim()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowEmail = String(row[1] || '')
      .trim()
      .toLowerCase()
    const rowPassword = String(row[2] || '').trim()

    if (rowEmail === normalizedEmail && rowPassword === normalizedPassword) {
      return jsonResponse_({
        success: true,
        user: buildUserFromRow_(row),
      })
    }
  }

  return jsonResponse_({
    success: false,
    message: 'Invalid email or password',
  })
}

function handleListSheets_(page, pageSize) {
  const spreadsheet = getSpreadsheet_()
  const size = normalizePageSize_(pageSize)
  const currentPage = normalizePage_(page)

  const allSheets = spreadsheet
    .getSheets()
    .filter(function (sheet) {
      return !isReservedSheetName_(sheet.getName())
    })
    .map(function (sheet) {
      return {
        id: String(sheet.getSheetId()),
        name: sheet.getName(),
      }
    })

  const result = getPaginatedItems_(allSheets, currentPage, size)

  return jsonResponse_({
    success: true,
    sheets: result.items,
    pagination: result.pagination,
  })
}

function normalizeStringList_(values) {
  if (!values || !values.length) {
    return []
  }

  var seen = {}
  var result = []

  for (var i = 0; i < values.length; i++) {
    var value = String(values[i] || '').trim()

    if (!value || seen[value.toLowerCase()]) {
      continue
    }

    seen[value.toLowerCase()] = true
    result.push(value)
  }

  return result
}

function columnToLetter_(column) {
  var temp = ''
  var letter = ''
  var col = Number(column)

  while (col > 0) {
    temp = (col - 1) % 26
    letter = String.fromCharCode(temp + 65) + letter
    col = (col - temp - 1) / 26
  }

  return letter
}

function verifyMasterUser_(email) {
  if (!email) {
    throw new Error('Unauthorized')
  }

  var sheet = getMasterSheet_()
  var rows = sheet.getDataRange().getValues()
  var normalizedEmail = normalizeEmail_(email)

  for (var i = 1; i < rows.length; i++) {
    if (normalizeEmail_(rows[i][1]) === normalizedEmail) {
      return buildUserFromRow_(rows[i])
    }
  }

  throw new Error('Unauthorized')
}

function getMasterUserNames_() {
  var rows = getMasterSheet_().getDataRange().getValues()
  var names = []

  for (var i = 1; i < rows.length; i++) {
    var name = String(rows[i][0] || '').trim()

    if (name) {
      names.push(name)
    }
  }

  return names
}

function handleListMasterUserOptions_(requesterEmail) {
  try {
    verifyMasterUser_(requesterEmail)

    var rows = getMasterSheet_().getDataRange().getValues()
    var users = []

    for (var i = 1; i < rows.length; i++) {
      var name = String(rows[i][0] || '').trim()

      if (!name) {
        continue
      }

      users.push({
        name: name,
        email: String(rows[i][1] || '').trim(),
      })
    }

    return jsonResponse_({
      success: true,
      users: users,
    })
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message || 'Unauthorized',
    })
  }
}

function formatExpenseSheet_(sheet, numUsers, numItems) {
  var firstUserCol = 2
  var lastUserCol = 1 + numUsers
  var totalCol = numUsers + 2
  var priceCol = numUsers + 3
  var firstItemRow = 2
  var lastItemRow = firstItemRow + numItems - 1
  var totalRow = lastItemRow + 1
  var givenRow = totalRow + 1
  var pendingRow = givenRow + 1
  var lastCol = numUsers + 5

  sheet
    .getRange(1, 1, 1, lastCol)
    .setBackground('#d9d9d9')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')

  if (numItems > 0) {
    sheet
      .getRange(firstItemRow, 1, lastItemRow, lastCol)
      .setBackground('#fff2cc')
  }

  sheet
    .getRange(totalRow, 1, totalRow, priceCol)
    .setBackground('#cfe2f3')
    .setFontWeight('bold')

  sheet.getRange(givenRow, 1).setFontWeight('bold')
  sheet.getRange(pendingRow, 1).setFontWeight('bold')

  sheet.setColumnWidth(1, 140)

  for (var col = firstUserCol; col <= lastCol; col++) {
    sheet.setColumnWidth(col, 100)
  }

  sheet.setFrozenRows(1)
}

function buildExpenseSheetTemplate_(sheet, userNames, itemNames) {
  var numUsers = userNames.length
  var numItems = itemNames.length
  var firstUserCol = 2
  var lastUserCol = 1 + numUsers
  var totalCol = numUsers + 2
  var priceCol = numUsers + 3
  var paidByCol = numUsers + 4
  var commentsCol = numUsers + 5
  var lastCol = commentsCol

  var firstItemRow = 2
  var lastItemRow = firstItemRow + numItems - 1
  var totalRow = lastItemRow + 1
  var givenRow = totalRow + 1
  var pendingRow = givenRow + 1

  var header = ['items']
  for (var u = 0; u < numUsers; u++) {
    header.push(userNames[u])
  }
  header.push('total', 'Price', 'paid by', 'Comments')

  var values = [header]

  for (var i = 0; i < numItems; i++) {
    var itemRow = [itemNames[i]]

    for (var j = 0; j < numUsers; j++) {
      itemRow.push(0)
    }

    itemRow.push(0, 0, '', '')
    values.push(itemRow)
  }

  var totalRowValues = ['TOTAL']
  for (var t = 0; t < numUsers + 4; t++) {
    totalRowValues.push('')
  }
  values.push(totalRowValues)

  var givenRowValues = ['GIVEN']
  for (var g = 0; g < numUsers; g++) {
    givenRowValues.push(0)
  }
  givenRowValues.push(0, '', '', '')
  values.push(givenRowValues)

  var pendingRowValues = ['pending']
  for (var p = 0; p < numUsers + 4; p++) {
    pendingRowValues.push('')
  }
  values.push(pendingRowValues)

  sheet.getRange(1, 1, values.length, lastCol).setValues(values)

  for (var itemRowIndex = firstItemRow; itemRowIndex <= lastItemRow; itemRowIndex++) {
    var startLetter = columnToLetter_(firstUserCol)
    var endLetter = columnToLetter_(lastUserCol)
    var totalLetter = columnToLetter_(totalCol)

    sheet
      .getRange(itemRowIndex, totalCol)
      .setFormula(
        '=SUM(' +
          startLetter +
          itemRowIndex +
          ':' +
          endLetter +
          itemRowIndex +
          ')',
      )
    sheet
      .getRange(itemRowIndex, priceCol)
      .setFormula('=' + totalLetter + itemRowIndex)
  }

  for (var userCol = firstUserCol; userCol <= lastUserCol; userCol++) {
    var userLetter = columnToLetter_(userCol)

    sheet
      .getRange(totalRow, userCol)
      .setFormula(
        '=SUM(' +
          userLetter +
          firstItemRow +
          ':' +
          userLetter +
          lastItemRow +
          ')',
      )
    sheet
      .getRange(pendingRow, userCol)
      .setFormula(
        '=' + userLetter + totalRow + '-' + userLetter + givenRow,
      )
  }

  var totalStartLetter = columnToLetter_(firstUserCol)
  var totalEndLetter = columnToLetter_(lastUserCol)
  var priceLetter = columnToLetter_(priceCol)

  sheet
    .getRange(totalRow, totalCol)
    .setFormula(
      '=SUM(' +
        totalStartLetter +
        totalRow +
        ':' +
        totalEndLetter +
        totalRow +
        ')',
    )
  sheet
    .getRange(totalRow, priceCol)
    .setFormula(
      '=SUM(' +
        priceLetter +
        firstItemRow +
        ':' +
        priceLetter +
        lastItemRow +
        ')',
    )

  sheet
    .getRange(givenRow, totalCol)
    .setFormula(
      '=SUM(' +
        totalStartLetter +
        givenRow +
        ':' +
        totalEndLetter +
        givenRow +
        ')',
    )

  sheet
    .getRange(pendingRow, totalCol)
    .setFormula(
      '=SUM(' +
        totalStartLetter +
        pendingRow +
        ':' +
        totalEndLetter +
        pendingRow +
        ')',
    )

  formatExpenseSheet_(sheet, numUsers, numItems)
}

function handleCreateSheet_(name, users, items, requesterEmail) {
  try {
    verifyMasterUser_(requesterEmail)

    var trimmedName = String(name || '').trim()
    var userNames = normalizeStringList_(users)
    var itemNames = normalizeStringList_(items)
    var masterNames = getMasterUserNames_()
    var masterLookup = {}

    for (var i = 0; i < masterNames.length; i++) {
      masterLookup[masterNames[i].toLowerCase()] = masterNames[i]
    }

    if (!trimmedName) {
      return jsonResponse_({
        success: false,
        message: 'Sheet name is required',
      })
    }

    if (isReservedSheetName_(trimmedName)) {
      return jsonResponse_({
        success: false,
        message: 'Cannot use reserved name MASTER',
      })
    }

    if (userNames.length < 1) {
      return jsonResponse_({
        success: false,
        message: 'Select at least one user from MASTER',
      })
    }

    if (itemNames.length < 1) {
      return jsonResponse_({
        success: false,
        message: 'Add at least one item',
      })
    }

    var validatedUsers = []

    for (var u = 0; u < userNames.length; u++) {
      var matchedName = masterLookup[userNames[u].toLowerCase()]

      if (!matchedName) {
        return jsonResponse_({
          success: false,
          message: 'User "' + userNames[u] + '" was not found in MASTER',
        })
      }

      validatedUsers.push(matchedName)
    }

    var spreadsheet = getSpreadsheet_()

    if (spreadsheet.getSheetByName(trimmedName)) {
      return jsonResponse_({
        success: false,
        message: 'A sheet with this name already exists',
      })
    }

    var sheet = spreadsheet.insertSheet(trimmedName)
    buildExpenseSheetTemplate_(sheet, validatedUsers, itemNames)

    return jsonResponse_({
      success: true,
      sheet: {
        id: String(sheet.getSheetId()),
        name: sheet.getName(),
      },
    })
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message || 'Failed to create sheet',
    })
  }
}

function getSheetById_(sheetId) {
  var spreadsheet = getSpreadsheet_()
  var sheets = spreadsheet.getSheets()
  var targetId = String(sheetId)

  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getSheetId()) === targetId) {
      return sheets[i]
    }
  }

  throw new Error('Sheet not found')
}

function findHeaderIndex_(header, label) {
  var normalizedLabel = String(label).trim().toLowerCase()

  for (var i = 0; i < header.length; i++) {
    if (String(header[i]).trim().toLowerCase() === normalizedLabel) {
      return i
    }
  }

  return -1
}

function findSummaryRowIndex_(rows, label) {
  var normalizedLabel = String(label).trim().toUpperCase()

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === normalizedLabel) {
      return i
    }
  }

  return -1
}

function buildSharesObject_(users, row, startCol) {
  var shares = {}

  for (var i = 0; i < users.length; i++) {
    shares[users[i]] = parseNumber_(row[startCol + i]) || 0
  }

  return shares
}

function parseExpenseSheet_(sheet) {
  var values = sheet.getDataRange().getValues()

  if (values.length < 4) {
    throw new Error('Invalid expense sheet structure')
  }

  var header = values[0]
  var totalCol = findHeaderIndex_(header, 'total')
  var priceCol = findHeaderIndex_(header, 'Price')
  var paidByCol = findHeaderIndex_(header, 'paid by')
  var commentsCol = findHeaderIndex_(header, 'Comments')

  if (totalCol < 2 || priceCol < 0 || paidByCol < 0 || commentsCol < 0) {
    throw new Error('Invalid expense sheet structure')
  }

  var users = []

  for (var u = 1; u < totalCol; u++) {
    var userName = String(header[u] || '').trim()

    if (userName) {
      users.push(userName)
    }
  }

  if (!users.length) {
    throw new Error('No users found in sheet')
  }

  var totalRowIndex = findSummaryRowIndex_(values, 'TOTAL')
  var givenRowIndex = findSummaryRowIndex_(values, 'GIVEN')
  var pendingRowIndex = findSummaryRowIndex_(values, 'pending')

  if (totalRowIndex < 0 || givenRowIndex < 0 || pendingRowIndex < 0) {
    throw new Error('Summary rows missing from sheet')
  }

  var items = []

  for (var rowIndex = 1; rowIndex < totalRowIndex; rowIndex++) {
    var row = values[rowIndex]
    var itemName = String(row[0] || '').trim()

    if (!itemName) {
      continue
    }

    items.push({
      rowIndex: rowIndex + 1,
      name: itemName,
      shares: buildSharesObject_(users, row, 1),
      total: parseNumber_(row[totalCol]) || 0,
      price: parseNumber_(row[priceCol]) || 0,
      paidBy: String(row[paidByCol] || '').trim(),
      comments: String(row[commentsCol] || '').trim(),
    })
  }

  var totalRow = values[totalRowIndex]
  var givenRow = values[givenRowIndex]
  var pendingRow = values[pendingRowIndex]

  return {
    id: String(sheet.getSheetId()),
    name: sheet.getName(),
    users: users,
    items: items,
    summary: {
      total: buildSharesObject_(users, totalRow, 1),
      grandTotal: parseNumber_(totalRow[totalCol]) || 0,
      totalPrice: parseNumber_(totalRow[priceCol]) || 0,
      given: buildSharesObject_(users, givenRow, 1),
      givenTotal: parseNumber_(givenRow[totalCol]) || 0,
      pending: buildSharesObject_(users, pendingRow, 1),
      pendingTotal: parseNumber_(pendingRow[totalCol]) || 0,
    },
    meta: {
      totalRowIndex: totalRowIndex + 1,
      givenRowIndex: givenRowIndex + 1,
      pendingRowIndex: pendingRowIndex + 1,
      totalCol: totalCol + 1,
      priceCol: priceCol + 1,
      paidByCol: paidByCol + 1,
      commentsCol: commentsCol + 1,
    },
  }
}

function handleGetExpenseSheet_(sheetId, requesterEmail) {
  try {
    verifyMasterUser_(requesterEmail)

    if (!sheetId) {
      return jsonResponse_({
        success: false,
        message: 'Sheet id is required',
      })
    }

    var sheet = getSheetById_(sheetId)

    if (isReservedSheetName_(sheet.getName())) {
      return jsonResponse_({
        success: false,
        message: 'Cannot open reserved sheet',
      })
    }

    var parsed = parseExpenseSheet_(sheet)
    delete parsed.meta

    return jsonResponse_({
      success: true,
      sheet: parsed,
    })
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message || 'Failed to load sheet',
    })
  }
}

function handleUpdateExpenseSheet_(sheetId, requesterEmail, payload) {
  try {
    verifyMasterUser_(requesterEmail)

    if (!sheetId) {
      return jsonResponse_({
        success: false,
        message: 'Sheet id is required',
      })
    }

    var sheet = getSheetById_(sheetId)
    var parsed = parseExpenseSheet_(sheet)
    var items = (payload && payload.items) || []
    var given = (payload && payload.given) || {}

    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      var rowIndex = Number(item.rowIndex)

      if (!rowIndex || rowIndex < 2 || rowIndex >= parsed.meta.totalRowIndex) {
        continue
      }

      for (var u = 0; u < parsed.users.length; u++) {
        var userName = parsed.users[u]
        var shareValue = 0

        if (item.shares && item.shares[userName] !== undefined) {
          shareValue = parseNumber_(item.shares[userName]) || 0
        }

        sheet.getRange(rowIndex, 2 + u).setValue(shareValue)
      }

      sheet
        .getRange(rowIndex, parsed.meta.paidByCol)
        .setValue(String((item && item.paidBy) || '').trim())
      sheet
        .getRange(rowIndex, parsed.meta.commentsCol)
        .setValue(String((item && item.comments) || '').trim())
    }

    for (var g = 0; g < parsed.users.length; g++) {
      var givenUser = parsed.users[g]
      var givenValue = 0

      if (given[givenUser] !== undefined) {
        givenValue = parseNumber_(given[givenUser]) || 0
      }

      sheet.getRange(parsed.meta.givenRowIndex, 2 + g).setValue(givenValue)
    }

    SpreadsheetApp.flush()

    var updated = parseExpenseSheet_(sheet)
    delete updated.meta

    return jsonResponse_({
      success: true,
      sheet: updated,
    })
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message || 'Failed to save sheet',
    })
  }
}

const SUPER_ADMIN_TYPE = 'SUPER ADMIN'

function verifySuperAdmin_(email) {
  if (!email) {
    throw new Error('Unauthorized')
  }

  var sheet = getMasterSheet_()
  var rows = sheet.getDataRange().getValues()
  var normalizedEmail = normalizeEmail_(email)

  for (var i = 1; i < rows.length; i++) {
    if (normalizeEmail_(rows[i][1]) === normalizedEmail) {
      var userType = String(rows[i][3] || '')
        .trim()
        .toUpperCase()

      if (userType === SUPER_ADMIN_TYPE) {
        return true
      }

      throw new Error('Unauthorized: SUPER ADMIN access required')
    }
  }

  throw new Error('Unauthorized')
}

function handleListUsers_(requesterEmail, page, pageSize) {
  verifySuperAdmin_(requesterEmail)

  var sheet = getMasterSheet_()
  var rows = sheet.getDataRange().getValues()
  var users = []

  for (var i = 1; i < rows.length; i++) {
    users.push(buildMasterUserFromRow_(rows[i], i + 1))
  }

  var result = getPaginatedItems_(
    users,
    normalizePage_(page),
    normalizePageSize_(pageSize),
  )

  return jsonResponse_({
    success: true,
    users: result.items,
    pagination: result.pagination,
  })
}

function handleCreateUser_(requesterEmail, user) {
  verifySuperAdmin_(requesterEmail)

  var sheet = getMasterSheet_()
  var rows = sheet.getDataRange().getValues()
  var userInput = validateUserInput_(user, false)

  if (findUserRowIndexByEmail_(rows, userInput.email, null)) {
    return jsonResponse_({
      success: false,
      message: 'A user with this email already exists',
    })
  }

  sheet.appendRow(userInputToRow_(userInput))

  var newRowId = sheet.getLastRow()
  var newRow = sheet.getRange(newRowId, 1, 1, 6).getValues()[0]

  return jsonResponse_({
    success: true,
    user: buildMasterUserFromRow_(newRow, newRowId),
  })
}

function handleUpdateUser_(requesterEmail, rowId, user) {
  verifySuperAdmin_(requesterEmail)

  var sheet = getMasterSheet_()
  var parsedRowId = Number(rowId)

  if (!parsedRowId || parsedRowId < 2) {
    return jsonResponse_({
      success: false,
      message: 'Invalid user row',
    })
  }

  if (parsedRowId > sheet.getLastRow()) {
    return jsonResponse_({
      success: false,
      message: 'User not found',
    })
  }

  var rows = sheet.getDataRange().getValues()
  var userInput = validateUserInput_(user, true)
  var existingRow = sheet.getRange(parsedRowId, 1, 1, 6).getValues()[0]

  userInput.email = String(existingRow[1] || '').trim()

  if (!userInput.password) {
    userInput.password = String(existingRow[2] || '').trim()
  }

  if (findUserRowIndexByEmail_(rows, userInput.email, parsedRowId)) {
    return jsonResponse_({
      success: false,
      message: 'A user with this email already exists',
    })
  }

  sheet.getRange(parsedRowId, 1, 1, 6).setValues([userInputToRow_(userInput)])

  var updatedRow = sheet.getRange(parsedRowId, 1, 1, 6).getValues()[0]

  return jsonResponse_({
    success: true,
    user: buildMasterUserFromRow_(updatedRow, parsedRowId),
  })
}

function handleDeleteUser_(requesterEmail, rowId) {
  verifySuperAdmin_(requesterEmail)

  var sheet = getMasterSheet_()
  var parsedRowId = Number(rowId)

  if (!parsedRowId || parsedRowId < 2) {
    return jsonResponse_({
      success: false,
      message: 'Invalid user row',
    })
  }

  if (parsedRowId > sheet.getLastRow()) {
    return jsonResponse_({
      success: false,
      message: 'User not found',
    })
  }

  var targetEmail = normalizeEmail_(sheet.getRange(parsedRowId, 2).getValue())

  if (targetEmail === normalizeEmail_(requesterEmail)) {
    return jsonResponse_({
      success: false,
      message: 'You cannot delete your own account',
    })
  }

  sheet.deleteRow(parsedRowId)

  return jsonResponse_({
    success: true,
    message: 'User deleted',
  })
}
