function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0 }

function validateProvider(p) {
  if (!p || typeof p !== 'object') return false
  if (!isNonEmptyString(p.id)) return false
  if (!isNonEmptyString(p.name)) return false
  return true
}

function validateServer(s) {
  if (!s || typeof s !== 'object') return false
  if (!isNonEmptyString(s.id)) return false
  if (!isNonEmptyString(s.name)) return false
  if (!isNonEmptyString(s.ip)) return false
  return true
}

function validateDomain(d) {
  if (!d || typeof d !== 'object') return false
  if (!isNonEmptyString(d.id)) return false
  if (!isNonEmptyString(d.name)) return false
  return true
}

module.exports = { validateProvider, validateServer, validateDomain }

