const STORAGE_KEY = 'kilometrage-loa-v1'

const defaultState = {
  settings: {
    vehicleName: '',
    startDate: '',
    endDate: '',
    startMileage: '',
    limitMileage: '',
  },
  readings: [],
}

const elements = {
  settingsForm: document.querySelector('#settingsForm'),
  readingForm: document.querySelector('#readingForm'),
  resetButton: document.querySelector('#resetButton'),
  exportButton: document.querySelector('#exportButton'),
  projectedMileage: document.querySelector('#projectedMileage'),
  projectedDelta: document.querySelector('#projectedDelta'),
  currentMileage: document.querySelector('#currentMileage'),
  lastReadingDate: document.querySelector('#lastReadingDate'),
  remainingMileage: document.querySelector('#remainingMileage'),
  remainingPerMonth: document.querySelector('#remainingPerMonth'),
  remainingPerDay: document.querySelector('#remainingPerDay'),
  dailyLimitDetail: document.querySelector('#dailyLimitDetail'),
  actualMonthlyPace: document.querySelector('#actualMonthlyPace'),
  allowedMonthlyPace: document.querySelector('#allowedMonthlyPace'),
  remainingTime: document.querySelector('#remainingTime'),
  contractProgressLabel: document.querySelector('#contractProgressLabel'),
  overageCost: document.querySelector('#overageCost'),
  overageBreakdown: document.querySelector('#overageBreakdown'),
  contractPercent: document.querySelector('#contractPercent'),
  mileagePercent: document.querySelector('#mileagePercent'),
  contractMeter: document.querySelector('#contractMeter'),
  mileageMeter: document.querySelector('#mileageMeter'),
  globalStatus: document.querySelector('#globalStatus'),
  monthlyTargetsSummary: document.querySelector('#monthlyTargetsSummary'),
  monthlyTargetsTable: document.querySelector('#monthlyTargetsTable'),
  recoveryTargetsSummary: document.querySelector('#recoveryTargetsSummary'),
  recoveryTargetsTable: document.querySelector('#recoveryTargetsTable'),
  recoveryStatus: document.querySelector('#recoveryStatus'),
  readingsTable: document.querySelector('#readingsTable'),
  homeAssistantForm: document.querySelector('#homeAssistantForm'),
  homeAssistantUrl: document.querySelector('#homeAssistantUrl'),
  homeAssistantToken: document.querySelector('#homeAssistantToken'),
  homeAssistantEntity: document.querySelector('#homeAssistantEntity'),
  homeAssistantStatus: document.querySelector('#homeAssistantStatus'),
  homeAssistantMessage: document.querySelector('#homeAssistantMessage'),
  homeAssistantCandidates: document.querySelector('#homeAssistantCandidates'),
  discoverHomeAssistantButton: document.querySelector('#discoverHomeAssistantButton'),
  syncHomeAssistantButton: document.querySelector('#syncHomeAssistantButton'),
  dataStorageStatus: document.querySelector('#dataStorageStatus'),
}

const formFields = ['vehicleName', 'startDate', 'endDate', 'startMileage', 'limitMileage']

let state = loadLocalState()
let serverPersistenceReady = false
let serverSaveTimer = null

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(defaultState)
    const parsed = JSON.parse(raw)
    return {
      settings: { ...defaultState.settings, ...parsed.settings },
      readings: Array.isArray(parsed.readings) ? parsed.readings : [],
    }
  } catch {
    return structuredClone(defaultState)
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  if (!serverPersistenceReady) return
  elements.dataStorageStatus.textContent = 'Sauvegarde en cours...'
  window.clearTimeout(serverSaveTimer)
  serverSaveTimer = window.setTimeout(() => {
    void saveStateToServer()
  }, 150)
}

function normalizeState(input) {
  const parsed = input && typeof input === 'object' ? input : {}
  return {
    settings: { ...defaultState.settings, ...(parsed.settings || {}) },
    readings: Array.isArray(parsed.readings) ? parsed.readings : [],
  }
}

function hasMeaningfulState(candidate) {
  return (
    candidate.readings.length > 0 ||
    Object.values(candidate.settings).some((value) => String(value || '').trim() !== '')
  )
}

async function saveStateToServer() {
  try {
    const response = await fetch('./api/app-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: state }),
    })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Sauvegarde impossible.')
    elements.dataStorageStatus.textContent = 'Donnees sauvegardees sur le serveur'
  } catch {
    elements.dataStorageStatus.textContent = 'Sauvegarde locale uniquement - serveur indisponible'
  }
}

async function initializePersistentState() {
  const localState = normalizeState(state)
  try {
    const response = await fetch('./api/app-data', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Chargement impossible.')

    if (payload.exists) {
      state = normalizeState(payload.data)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      elements.dataStorageStatus.textContent = 'Donnees chargees depuis le serveur'
    } else if (hasMeaningfulState(localState)) {
      state = localState
      elements.dataStorageStatus.textContent = 'Migration des donnees vers le serveur...'
      serverPersistenceReady = true
      await saveStateToServer()
    } else {
      state = structuredClone(defaultState)
      elements.dataStorageStatus.textContent = 'Stockage serveur actif'
    }
  } catch {
    state = localState
    elements.dataStorageStatus.textContent = 'Mode local - serveur indisponible'
  } finally {
    serverPersistenceReady = true
    render()
  }
}

function parseLocalDate(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function daysBetween(start, end) {
  return Math.max(0, (end.getTime() - start.getTime()) / 86400000)
}

function monthsFromDays(days) {
  return days / 30.4375
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value))
}

function formatKm(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} km`
}

function formatMonthPace(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} km / mois`
}

function formatDayPace(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} km / jour`
}

function formatEuro(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value) || 0)
}

function formatDateFr(value) {
  const date = parseLocalDate(value)
  if (!date) return ''
  return date.toLocaleDateString('fr-FR')
}

function formatMonthFr(date) {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function getSortedReadings() {
  return [...state.readings].sort((a, b) => {
    const byDate = String(a.date).localeCompare(String(b.date))
    if (byDate !== 0) return byDate
    return Number(a.mileage) - Number(b.mileage)
  })
}

function calculateOverageCost(projectedMileage, limitMileage) {
  const overageKm = Math.max(0, projectedMileage - limitMileage)
  const firstTierKmLimit = Math.max(0, limitMileage * 0.2)
  const firstTierKm = Math.min(overageKm, firstTierKmLimit)
  const secondTierKm = Math.max(0, overageKm - firstTierKmLimit)

  return {
    overageKm,
    firstTierKm,
    secondTierKm,
    cost: firstTierKm * 0.11 + secondTierKm * 0.22,
  }
}

function calculateMonthlyTargets(metrics) {
  if (!metrics.configured || metrics.remainingDays <= 0 || metrics.remainingKm <= 0) return []

  const targets = []
  const dailyTarget = metrics.remainingKm / metrics.remainingDays
  let cursor = new Date(metrics.currentDate)
  let cumulativeKm = 0

  while (cursor < metrics.endDate && targets.length < 72) {
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    const periodEnd = nextMonth < metrics.endDate ? nextMonth : metrics.endDate
    const periodDays = daysBetween(cursor, periodEnd)

    if (periodDays > 0) {
      const monthKm = dailyTarget * periodDays
      cumulativeKm += monthKm
      targets.push({
        month: formatMonthFr(cursor),
        days: Math.ceil(periodDays),
        monthKm,
        targetMileage: metrics.currentMileage + cumulativeKm,
      })
    }

    cursor = periodEnd
  }

  return targets
}

function addMonths(date, months) {
  const result = new Date(date)
  const originalDay = result.getDate()
  result.setMonth(result.getMonth() + months)
  if (result.getDate() !== originalDay) result.setDate(0)
  return result
}

function contractTargetMileageAt(metrics, date) {
  const elapsedAtDate = Math.max(0, daysBetween(metrics.startDate, date))
  const progressAtDate = Math.min(1, elapsedAtDate / metrics.totalDays)
  return metrics.startMileage + metrics.totalContractKm * progressAtDate
}

function dateWhenContractTargetReaches(metrics, mileage) {
  if (metrics.totalContractKm <= 0) return null
  const progress = (mileage - metrics.startMileage) / metrics.totalContractKm
  if (progress < 0 || progress > 1) return null
  const date = new Date(metrics.startDate)
  date.setDate(date.getDate() + Math.ceil(progress * metrics.totalDays))
  return date
}

function calculateRecoveryTargets(metrics) {
  if (!metrics.configured || metrics.remainingDays <= 0) return { targets: [], excessKm: 0, reachable: false }

  const currentTargetMileage = contractTargetMileageAt(metrics, metrics.currentDate)
  const excessKm = Math.max(0, metrics.currentMileage - currentTargetMileage)
  const recoveryEndDate = addMonths(metrics.currentDate, 3)
  const cappedRecoveryEndDate = recoveryEndDate < metrics.endDate ? recoveryEndDate : metrics.endDate
  const recoveryDays = daysBetween(metrics.currentDate, cappedRecoveryEndDate)
  const targetMileageAtEnd = contractTargetMileageAt(metrics, cappedRecoveryEndDate)
  const allowedRecoveryKm = Math.max(0, targetMileageAtEnd - metrics.currentMileage)
  const earliestCatchupDate = dateWhenContractTargetReaches(metrics, metrics.currentMileage)

  if (excessKm <= 0) {
    return {
      targets: [],
      excessKm,
      reachable: true,
      recoveryDays,
      allowedRecoveryKm,
      targetMileageAtEnd,
      earliestCatchupDate,
      endDate: cappedRecoveryEndDate,
    }
  }

  const targets = []
  const dailyTarget = recoveryDays > 0 ? allowedRecoveryKm / recoveryDays : 0
  let cursor = new Date(metrics.currentDate)
  let cumulativeKm = 0

  while (cursor < cappedRecoveryEndDate && targets.length < 4) {
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    const periodEnd = nextMonth < cappedRecoveryEndDate ? nextMonth : cappedRecoveryEndDate
    const periodDays = daysBetween(cursor, periodEnd)

    if (periodDays > 0) {
      const monthKm = dailyTarget * periodDays
      cumulativeKm += monthKm
      targets.push({
        month: formatMonthFr(cursor),
        days: Math.ceil(periodDays),
        monthKm,
        targetMileage: metrics.currentMileage + cumulativeKm,
      })
    }

    cursor = periodEnd
  }

  return {
    targets,
    excessKm,
    reachable: allowedRecoveryKm > 0,
    recoveryDays,
    allowedRecoveryKm,
    targetMileageAtEnd,
    earliestCatchupDate,
    endDate: cappedRecoveryEndDate,
  }
}

function getMetrics() {
  const settings = state.settings
  const startDate = parseLocalDate(settings.startDate)
  const endDate = parseLocalDate(settings.endDate)
  const startMileage = Number(settings.startMileage)
  const limitMileage = Number(settings.limitMileage)
  const readings = getSortedReadings()
  const lastReading = readings.at(-1)
  const currentMileage = lastReading ? Number(lastReading.mileage) : startMileage || 0
  const currentDate = lastReading ? parseLocalDate(lastReading.date) : new Date()

  if (!startDate || !endDate || !limitMileage || endDate <= startDate) {
    return { configured: false, readings, currentMileage }
  }

  const totalDays = Math.max(1, daysBetween(startDate, endDate))
  const elapsedDays = Math.max(0, daysBetween(startDate, currentDate || new Date()))
  const remainingDays = Math.max(0, daysBetween(currentDate || new Date(), endDate))
  const totalContractKm = Math.max(0, limitMileage - startMileage)
  const consumedKm = Math.max(0, currentMileage - startMileage)
  const remainingKm = limitMileage - currentMileage
  const contractProgress = clampPercent((elapsedDays / totalDays) * 100)
  const mileageProgress = totalContractKm > 0 ? clampPercent((consumedKm / totalContractKm) * 100) : 0
  const allowedMonthlyPace = totalContractKm / monthsFromDays(totalDays)
  const actualMonthlyPace = elapsedDays > 0 ? consumedKm / monthsFromDays(elapsedDays) : 0
  const remainingPerMonth = remainingDays > 0 ? Math.max(0, remainingKm) / monthsFromDays(remainingDays) : 0
  const remainingPerDay = remainingDays > 0 ? Math.max(0, remainingKm) / remainingDays : 0
  const projectedMileage = currentMileage + actualMonthlyPace * monthsFromDays(remainingDays)
  const projectedDelta = limitMileage - projectedMileage
  const overage = calculateOverageCost(projectedMileage, limitMileage)

  return {
    configured: true,
    readings,
    startMileage,
    limitMileage,
    currentMileage,
    currentDate,
    startDate,
    endDate,
    totalDays,
    totalContractKm,
    remainingKm,
    remainingDays,
    contractProgress,
    mileageProgress,
    allowedMonthlyPace,
    actualMonthlyPace,
    remainingPerMonth,
    remainingPerDay,
    projectedMileage,
    projectedDelta,
    overage,
  }
}

function statusFor(metrics) {
  if (!metrics.configured) {
    return { text: 'A configurer', tone: '' }
  }
  if (metrics.projectedDelta < 0) {
    return { text: `Depassement prevu de ${formatKm(Math.abs(metrics.projectedDelta))}`, tone: 'danger' }
  }
  if (metrics.projectedDelta < 1500 || metrics.mileageProgress > metrics.contractProgress + 8) {
    return { text: `A surveiller: ${formatKm(metrics.projectedDelta)} de marge`, tone: 'warn' }
  }
  return { text: `Dans les clous: ${formatKm(metrics.projectedDelta)} de marge`, tone: 'ok' }
}

function setStatus(element, status) {
  element.className = `status-pill ${status.tone}`.trim()
  element.textContent = status.text
}

function renderForms() {
  for (const field of formFields) {
    const input = document.querySelector(`#${field}`)
    input.value = state.settings[field] || ''
  }

  document.querySelector('#readingDate').value = new Date().toISOString().slice(0, 10)
}

function renderStats(metrics) {
  const status = statusFor(metrics)
  setStatus(elements.projectedDelta, status)
  setStatus(elements.globalStatus, status)

  elements.currentMileage.textContent = formatKm(metrics.currentMileage)
  elements.lastReadingDate.textContent = metrics.readings.at(-1)
    ? `Dernier releve: ${formatDateFr(metrics.readings.at(-1).date)}`
    : 'Aucun releve'

  if (!metrics.configured) {
    elements.projectedMileage.textContent = '0 km'
    elements.remainingMileage.textContent = '0 km'
    elements.remainingPerMonth.textContent = '0 km / mois'
    elements.remainingPerDay.textContent = '0 km / jour'
    elements.dailyLimitDetail.textContent = 'Pour rester dans le forfait'
    elements.actualMonthlyPace.textContent = '0 km / mois'
    elements.allowedMonthlyPace.textContent = '0 km / mois autorises'
    elements.remainingTime.textContent = '0 mois'
    elements.contractProgressLabel.textContent = '0% du contrat'
    elements.overageCost.textContent = '0,00 €'
    elements.overageBreakdown.textContent = '20% a 0,11 €/km puis 0,22 €/km'
    elements.contractPercent.textContent = '0%'
    elements.mileagePercent.textContent = '0%'
    elements.contractMeter.style.width = '0%'
    elements.mileageMeter.style.width = '0%'
    return
  }

  elements.projectedMileage.textContent = formatKm(metrics.projectedMileage)
  elements.remainingMileage.textContent = formatKm(metrics.remainingKm)
  elements.remainingPerMonth.textContent = `${formatMonthPace(metrics.remainingPerMonth)} possibles`
  elements.remainingPerDay.textContent = formatDayPace(metrics.remainingPerDay)
  elements.dailyLimitDetail.textContent =
    metrics.remainingKm > 0
      ? `A ne pas depasser pendant ${Math.ceil(metrics.remainingDays).toLocaleString('fr-FR')} jours`
      : 'Forfait deja depasse'
  elements.actualMonthlyPace.textContent = formatMonthPace(metrics.actualMonthlyPace)
  elements.allowedMonthlyPace.textContent = `${formatMonthPace(metrics.allowedMonthlyPace)} autorises`
  elements.remainingTime.textContent = `${monthsFromDays(metrics.remainingDays).toFixed(1).replace('.', ',')} mois`
  elements.contractProgressLabel.textContent = `${Math.round(metrics.contractProgress)}% du contrat`
  elements.overageCost.textContent = formatEuro(metrics.overage.cost)
  elements.overageBreakdown.textContent =
    metrics.overage.overageKm > 0
      ? `${formatKm(metrics.overage.firstTierKm)} a 0,11 €/km, ${formatKm(metrics.overage.secondTierKm)} a 0,22 €/km`
      : `Pas de depassement projete. Palier 20%: ${formatKm(metrics.limitMileage * 0.2)}`
  elements.contractPercent.textContent = `${Math.round(metrics.contractProgress)}%`
  elements.mileagePercent.textContent = `${Math.round(metrics.mileageProgress)}%`
  elements.contractMeter.style.width = `${metrics.contractProgress}%`
  elements.mileageMeter.style.width = `${metrics.mileageProgress}%`
}

function renderMonthlyTargets(metrics) {
  if (!metrics.configured) {
    elements.monthlyTargetsSummary.textContent = 'Configure le contrat pour calculer les objectifs.'
    elements.monthlyTargetsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">Aucune cible mensuelle pour le moment.</td>
      </tr>
    `
    return
  }

  if (metrics.remainingKm <= 0) {
    elements.monthlyTargetsSummary.textContent = 'Le forfait est deja depasse: il faut limiter au maximum les kilometres restants.'
    elements.monthlyTargetsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">Forfait deja depasse. La cible mensuelle est 0 km.</td>
      </tr>
    `
    return
  }

  const targets = calculateMonthlyTargets(metrics)
  elements.monthlyTargetsSummary.textContent = `Objectif moyen: ${formatDayPace(metrics.remainingPerDay)} soit ${formatMonthPace(metrics.remainingPerMonth)} jusqu'a la fin du contrat.`

  if (targets.length === 0) {
    elements.monthlyTargetsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">Le contrat arrive a son terme.</td>
      </tr>
    `
    return
  }

  elements.monthlyTargetsTable.innerHTML = targets
    .map(
      (target) => `
        <tr>
          <td class="month-name">${escapeHtml(target.month)}</td>
          <td>${formatKm(target.monthKm)}</td>
          <td>${formatKm(target.targetMileage)}</td>
          <td>${target.days.toLocaleString('fr-FR')} jours</td>
        </tr>
      `
    )
    .join('')
}

function renderRecoveryTargets(metrics) {
  if (!metrics.configured) {
    setStatus(elements.recoveryStatus, { text: 'A configurer', tone: '' })
    elements.recoveryTargetsSummary.textContent = 'Configure le contrat pour calculer le plan de retour a la cible.'
    elements.recoveryTargetsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">Aucun plan de rattrapage pour le moment.</td>
      </tr>
    `
    return
  }

  const recovery = calculateRecoveryTargets(metrics)

  if (recovery.excessKm <= 0) {
    setStatus(elements.recoveryStatus, { text: 'Deja sur cible', tone: 'ok' })
    elements.recoveryTargetsSummary.textContent = 'Tu es deja dans la trajectoire du contrat. Garde les cibles mensuelles normales.'
    elements.recoveryTargetsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">Pas de rattrapage necessaire.</td>
      </tr>
    `
    return
  }

  if (!recovery.reachable || recovery.targets.length === 0) {
    setStatus(elements.recoveryStatus, { text: 'Tres serre', tone: 'danger' })
    const catchupText = recovery.earliestCatchupDate
      ? ` Retour possible vers le ${formatDateFr(toDateInputValue(recovery.earliestCatchupDate))} en roulant au minimum.`
      : ''
    elements.recoveryTargetsSummary.textContent = `Tu es au-dessus de la cible de ${formatKm(recovery.excessKm)}. En moins de 3 mois, il faudrait viser 0 km ou presque.${catchupText}`
    elements.recoveryTargetsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="4">Aucun kilometre disponible sur la periode de rattrapage.</td>
      </tr>
    `
    return
  }

  const recoveryPerDay = recovery.allowedRecoveryKm / recovery.recoveryDays
  setStatus(elements.recoveryStatus, { text: 'Plan 3 mois', tone: recoveryPerDay < 15 ? 'warn' : 'ok' })
  elements.recoveryTargetsSummary.textContent =
    `Tu es au-dessus de la cible de ${formatKm(recovery.excessKm)}. Pour revenir dans la trajectoire au ${formatDateFr(toDateInputValue(recovery.endDate))}, vise ${formatDayPace(recoveryPerDay)}.`

  elements.recoveryTargetsTable.innerHTML = recovery.targets
    .map(
      (target) => `
        <tr>
          <td class="month-name">${escapeHtml(target.month)}</td>
          <td>${formatKm(target.monthKm)}</td>
          <td>${formatKm(target.targetMileage)}</td>
          <td>${target.days.toLocaleString('fr-FR')} jours</td>
        </tr>
      `
    )
    .join('')
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function renderTable(readings) {
  if (readings.length === 0) {
    elements.readingsTable.innerHTML = `
      <tr>
        <td class="empty-row" colspan="5">Ajoute ton premier releve pour commencer le suivi.</td>
      </tr>
    `
    return
  }

  elements.readingsTable.innerHTML = readings
    .map((reading, index) => {
      const previous = readings[index - 1]
      const variation = previous ? Number(reading.mileage) - Number(previous.mileage) : 0
      return `
        <tr>
          <td>${formatDateFr(reading.date)}</td>
          <td>${formatKm(reading.mileage)}</td>
          <td>${index === 0 ? '-' : formatKm(variation)}</td>
          <td>${escapeHtml(reading.note || '')}</td>
          <td><button class="danger-button" data-delete-id="${reading.id}" type="button">Supprimer</button></td>
        </tr>
      `
    })
    .join('')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function render() {
  const metrics = getMetrics()
  renderForms()
  renderStats(metrics)
  renderMonthlyTargets(metrics)
  renderRecoveryTargets(metrics)
  renderTable(metrics.readings)
}

async function loadHomeAssistantConfig() {
  try {
    const response = await fetch('./api/home-assistant/config', { cache: 'no-store' })
    const config = await response.json()
    elements.homeAssistantUrl.value = config.url || ''
    elements.homeAssistantEntity.value = config.entityId || ''
    elements.homeAssistantUrl.disabled = Boolean(config.managed)
    elements.homeAssistantToken.disabled = Boolean(config.managed)
    elements.homeAssistantUrl.required = !config.managed
    elements.homeAssistantToken.placeholder = config.managed ? 'Gere automatiquement par Home Assistant' : 'Jeton Home Assistant'
    setStatus(
      elements.homeAssistantStatus,
      config.managed
        ? { text: 'Mode add-on', tone: 'ok' }
        : config.configured
          ? { text: 'Configure', tone: 'ok' }
          : { text: 'Non configure', tone: 'warn' }
    )
    elements.syncHomeAssistantButton.disabled = !config.configured || !config.entityId
    elements.discoverHomeAssistantButton.disabled = !config.configured
  } catch {
    setStatus(elements.homeAssistantStatus, { text: 'Serveur indisponible', tone: 'danger' })
  }
}

function addHomeAssistantReading(sensorState) {
  const date = new Date(sensorState.lastUpdated || Date.now())
  const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const mileage = Math.round(Number(sensorState.mileage))
  const duplicate = state.readings.some((reading) => reading.date === dateValue && Number(reading.mileage) === mileage)

  if (!duplicate) {
    state.readings.push({
      id: crypto.randomUUID(),
      date: dateValue,
      mileage,
      note: `Import Home Assistant - ${sensorState.name}`,
    })
    saveState()
    render()
  }

  elements.homeAssistantMessage.textContent = duplicate
    ? `${formatKm(mileage)} deja present dans l'historique.`
    : `${formatKm(mileage)} importe depuis ${sensorState.name}.`
}

function renderHomeAssistantCandidates(candidates) {
  elements.homeAssistantCandidates.hidden = false
  if (!candidates.length) {
    elements.homeAssistantCandidates.textContent = 'Aucun capteur kilometrage detecte.'
    return
  }
  elements.homeAssistantCandidates.innerHTML = candidates
    .map(
      (candidate) => `
        <button class="sensor-choice" type="button" data-ha-entity="${escapeHtml(candidate.entityId)}">
          <span>${escapeHtml(candidate.name)}</span>
          <small>${escapeHtml(candidate.state)} ${escapeHtml(candidate.unit)}</small>
        </button>
      `
    )
    .join('')
}

elements.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const data = new FormData(elements.settingsForm)
  state.settings = {
    vehicleName: String(data.get('vehicleName') || '').trim(),
    startDate: String(data.get('startDate') || ''),
    endDate: String(data.get('endDate') || ''),
    startMileage: String(data.get('startMileage') || ''),
    limitMileage: String(data.get('limitMileage') || ''),
  }
  saveState()
  render()
})

elements.readingForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const data = new FormData(elements.readingForm)
  const date = String(data.get('readingDate') || '')
  const mileage = Number(data.get('readingMileage'))
  const note = String(data.get('readingNote') || '').trim()
  if (!date || !Number.isFinite(mileage)) return

  state.readings.push({
    id: crypto.randomUUID(),
    date,
    mileage,
    note,
  })
  saveState()
  elements.readingForm.reset()
  render()
})

elements.readingsTable.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-id]')
  if (!button) return
  state.readings = state.readings.filter((reading) => reading.id !== button.dataset.deleteId)
  saveState()
  render()
})

elements.resetButton.addEventListener('click', () => {
  if (!confirm('Supprimer le contrat et tous les releves ?')) return
  state = structuredClone(defaultState)
  saveState()
  render()
})

elements.exportButton.addEventListener('click', () => {
  const rows = [['date', 'kilometrage', 'note'], ...getSortedReadings().map((reading) => [reading.date, reading.mileage, reading.note || ''])]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'suivi-kilometrage-loa.csv'
  link.click()
  URL.revokeObjectURL(url)
})

elements.homeAssistantForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  elements.homeAssistantMessage.textContent = 'Connexion a Home Assistant...'
  const data = new FormData(elements.homeAssistantForm)
  try {
    const response = await fetch('./api/home-assistant/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: data.get('url'),
        token: data.get('token'),
        entityId: data.get('entityId'),
      }),
    })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Connexion impossible.')
    elements.homeAssistantToken.value = ''
    setStatus(elements.homeAssistantStatus, { text: 'Connecte', tone: 'ok' })
    elements.homeAssistantMessage.textContent = payload.state
      ? `Capteur valide: ${formatKm(payload.state.mileage)}.`
      : 'Home Assistant connecte. Detecte maintenant le capteur kilometrage.'
    await loadHomeAssistantConfig()
  } catch (error) {
    setStatus(elements.homeAssistantStatus, { text: 'Erreur', tone: 'danger' })
    elements.homeAssistantMessage.textContent = error.message
  }
})

elements.discoverHomeAssistantButton.addEventListener('click', async () => {
  elements.homeAssistantMessage.textContent = 'Recherche des capteurs...'
  try {
    const response = await fetch('./api/home-assistant/discover', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Detection impossible.')
    renderHomeAssistantCandidates(payload.candidates || [])
    elements.homeAssistantMessage.textContent = `${payload.candidates?.length || 0} capteur(s) possible(s) detecte(s).`
  } catch (error) {
    elements.homeAssistantMessage.textContent = error.message
  }
})

elements.homeAssistantCandidates.addEventListener('click', (event) => {
  const button = event.target.closest('[data-ha-entity]')
  if (!button) return
  elements.homeAssistantEntity.value = button.dataset.haEntity
  elements.homeAssistantCandidates.hidden = true
  elements.homeAssistantMessage.textContent = `Capteur selectionne: ${button.dataset.haEntity}. Enregistre la configuration.`
})

elements.syncHomeAssistantButton.addEventListener('click', async () => {
  elements.homeAssistantMessage.textContent = 'Import du kilometrage...'
  try {
    const response = await fetch('./api/home-assistant/sync', { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Import impossible.')
    addHomeAssistantReading(payload.state)
  } catch (error) {
    elements.homeAssistantMessage.textContent = error.message
  }
})

render()
void initializePersistentState()
void loadHomeAssistantConfig()
