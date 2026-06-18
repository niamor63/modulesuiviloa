const http = require('http')
const fs = require('fs')
const path = require('path')

const rootDir = __dirname
const port = Number(process.env.PORT || 4177)
const dataDir = process.env.DATA_DIR || rootDir
const homeAssistantConfigPath = path.join(dataDir, '.home-assistant-config.json')
const loaDataPath = path.join(dataDir, '.loa-data.json')
const loaBackupPath = path.join(dataDir, '.loa-data.backup.json')
const supervisorToken = process.env.SUPERVISOR_TOKEN || ''
const isHomeAssistantAddon = Boolean(supervisorToken)

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)

    if (url.pathname === '/api/app-data' && req.method === 'GET') {
      const data = readLoaData()
      return sendJson(res, {
        success: true,
        exists: Boolean(data),
        data: data || emptyLoaData(),
      })
    }

    if (url.pathname === '/api/app-data' && req.method === 'PUT') {
      const body = await readJsonBody(req)
      const data = normalizeLoaData(body.data)
      writeLoaData(data)
      return sendJson(res, {
        success: true,
        savedAt: data.savedAt,
      })
    }

    if (url.pathname === '/api/home-assistant/config' && req.method === 'GET') {
      const config = readHomeAssistantConfig()
      return sendJson(res, {
        configured: isHomeAssistantAddon || Boolean(config?.url && config?.token),
        managed: isHomeAssistantAddon,
        url: isHomeAssistantAddon ? 'Home Assistant interne' : config?.url || '',
        entityId: config?.entityId || '',
      })
    }

    if (url.pathname === '/api/home-assistant/config' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const existing = readHomeAssistantConfig() || {}
      const config = normalizeHomeAssistantConfig({
        url: isHomeAssistantAddon ? 'http://supervisor/core' : body.url,
        token: isHomeAssistantAddon ? supervisorToken : body.token || existing.token,
        entityId: body.entityId,
      })
      writeHomeAssistantConfig({
        url: isHomeAssistantAddon ? '' : config.url,
        token: isHomeAssistantAddon ? '' : config.token,
        entityId: config.entityId,
      })
      const result = await fetchHomeAssistantState(config, config.entityId)
      return sendJson(res, { success: true, config: publicConfig(config), managed: isHomeAssistantAddon, state: result })
    }

    if (url.pathname === '/api/home-assistant/discover' && req.method === 'GET') {
      const config = requireHomeAssistantConfig()
      const states = await homeAssistantRequest(config, '/api/states')
      const candidates = states
        .filter((item) => {
          const text = `${item.entity_id} ${item.attributes?.friendly_name || ''} ${item.attributes?.device_class || ''}`.toLowerCase()
          return /odometer|mileage|kilometr|kilometer|distance_total/.test(text)
        })
        .map((item) => ({
          entityId: item.entity_id,
          name: item.attributes?.friendly_name || item.entity_id,
          state: item.state,
          unit: item.attributes?.unit_of_measurement || '',
        }))
      return sendJson(res, { success: true, candidates })
    }

    if (url.pathname === '/api/home-assistant/sync' && req.method === 'GET') {
      const config = requireHomeAssistantConfig()
      if (!config.entityId) return sendJson(res, { success: false, error: 'Entite Home Assistant manquante.' }, 400)
      const state = await fetchHomeAssistantState(config, config.entityId)
      return sendJson(res, { success: true, state })
    }

    const cleanPath = url.pathname === '/' ? '/index.html' : url.pathname
    const filePath = path.normalize(path.join(rootDir, cleanPath))

    if (!filePath.startsWith(rootDir)) return sendText(res, 'Forbidden', 403)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return sendText(res, 'Not found', 404)
    }

    const contentType =
      {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
        '.svg': 'image/svg+xml',
      }[path.extname(filePath)] || 'application/octet-stream'

    res.writeHead(200, { 'Content-Type': contentType })
    fs.createReadStream(filePath).pipe(res)
  } catch (error) {
    console.error(error)
    sendJson(res, { success: false, error: error.message || 'Erreur serveur' }, error.status || 500)
  }
})

server.listen(port, () => {
  console.log(`Suivi Kilometrage LOA: http://localhost:${port}`)
})

function sendText(res, text, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(text)
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function emptyLoaData() {
  return {
    version: 1,
    savedAt: null,
    settings: {
      vehicleName: '',
      startDate: '',
      endDate: '',
      startMileage: '',
      limitMileage: '',
    },
    readings: [],
  }
}

function normalizeLoaData(input) {
  const source = input && typeof input === 'object' ? input : {}
  const settings = source.settings && typeof source.settings === 'object' ? source.settings : {}
  const readings = Array.isArray(source.readings) ? source.readings.slice(0, 10000) : []

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    settings: {
      vehicleName: String(settings.vehicleName || '').slice(0, 200),
      startDate: normalizeDateValue(settings.startDate),
      endDate: normalizeDateValue(settings.endDate),
      startMileage: normalizeNumberString(settings.startMileage),
      limitMileage: normalizeNumberString(settings.limitMileage),
    },
    readings: readings
      .map((reading) => ({
        id: String(reading?.id || '').slice(0, 100),
        date: normalizeDateValue(reading?.date),
        mileage: Number(reading?.mileage),
        note: String(reading?.note || '').slice(0, 500),
      }))
      .filter((reading) => reading.id && reading.date && Number.isFinite(reading.mileage) && reading.mileage >= 0),
  }
}

function normalizeDateValue(value) {
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function normalizeNumberString(value) {
  if (value === '' || value === null || value === undefined) return ''
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? String(number) : ''
}

function readLoaData() {
  try {
    if (!fs.existsSync(loaDataPath)) return null
    return normalizeLoaDataForRead(JSON.parse(fs.readFileSync(loaDataPath, 'utf8')))
  } catch (error) {
    console.error('Lecture des donnees LOA impossible:', error)
    return readLoaBackup()
  }
}

function readLoaBackup() {
  try {
    if (!fs.existsSync(loaBackupPath)) return null
    return normalizeLoaDataForRead(JSON.parse(fs.readFileSync(loaBackupPath, 'utf8')))
  } catch (error) {
    console.error('Lecture de la sauvegarde LOA impossible:', error)
    return null
  }
}

function normalizeLoaDataForRead(input) {
  const normalized = normalizeLoaData(input)
  normalized.savedAt = input?.savedAt || null
  return normalized
}

function writeLoaData(data) {
  fs.mkdirSync(dataDir, { recursive: true })
  const temporaryPath = `${loaDataPath}.${process.pid}.tmp`
  if (fs.existsSync(loaDataPath)) fs.copyFileSync(loaDataPath, loaBackupPath)
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), { mode: 0o600 })
  fs.renameSync(temporaryPath, loaDataPath)
}

function readHomeAssistantConfig() {
  try {
    if (!fs.existsSync(homeAssistantConfigPath)) return null
    return JSON.parse(fs.readFileSync(homeAssistantConfigPath, 'utf8'))
  } catch {
    return null
  }
}

function writeHomeAssistantConfig(config) {
  fs.writeFileSync(homeAssistantConfigPath, JSON.stringify(config, null, 2), { mode: 0o600 })
}

function requireHomeAssistantConfig() {
  const stored = readHomeAssistantConfig() || {}
  const config = isHomeAssistantAddon
    ? { url: 'http://supervisor/core', token: supervisorToken, entityId: stored.entityId || '' }
    : stored
  if (!config?.url || !config?.token) {
    const error = new Error('Configure Home Assistant avant de continuer.')
    error.status = 400
    throw error
  }
  return config
}

function normalizeHomeAssistantConfig(input) {
  const url = String(input.url || '').trim().replace(/\/+$/, '')
  const token = String(input.token || '').trim()
  const entityId = String(input.entityId || '').trim()
  if (!/^https?:\/\//i.test(url)) throw new Error('Adresse Home Assistant invalide.')
  if (!token) throw new Error('Jeton Home Assistant manquant.')
  return { url, token, entityId }
}

function publicConfig(config) {
  return {
    url: isHomeAssistantAddon ? 'Home Assistant interne' : config.url,
    entityId: config.entityId,
    configured: true,
  }
}

async function homeAssistantRequest(config, requestPath) {
  const response = await fetch(`${config.url}${requestPath}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await response.text()
  if (!response.ok) {
    const error = new Error(`Home Assistant a repondu ${response.status}: ${text || response.statusText}`)
    error.status = 502
    throw error
  }
  return text ? JSON.parse(text) : null
}

async function fetchHomeAssistantState(config, entityId) {
  if (!entityId) {
    await homeAssistantRequest(config, '/api/')
    return null
  }
  const item = await homeAssistantRequest(config, `/api/states/${encodeURIComponent(entityId)}`)
  const rawValue = Number(String(item.state).replace(',', '.'))
  if (!Number.isFinite(rawValue)) throw new Error(`La valeur de ${entityId} n'est pas numerique.`)
  const unit = String(item.attributes?.unit_of_measurement || '').toLowerCase()
  const mileage = unit === 'mi' || unit.includes('mile') ? rawValue * 1.609344 : rawValue
  return {
    entityId,
    name: item.attributes?.friendly_name || entityId,
    mileage,
    rawValue,
    unit: item.attributes?.unit_of_measurement || '',
    lastUpdated: item.last_updated || new Date().toISOString(),
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1_000_000) reject(new Error('Requete trop volumineuse.'))
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        reject(new Error('Corps JSON invalide.'))
      }
    })
    req.on('error', reject)
  })
}
