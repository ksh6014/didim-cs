import { useEffect, useRef, useState } from 'react'
import './App.css'
import SidebarNavigation from './SidebarNavigation'
import RemoteAsBoard from './RemoteAsBoard'
import { WorkEntriesEditor, WorkEntriesRead } from './WorkEntries'

function App() {
  const API_URL = ''
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [selectedSite, setSelectedSite] = useState(null)
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem('cs_token') || ''
  )
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  })
  const [loginError, setLoginError] = useState('')
  const [rememberUsername, setRememberUsername] = useState(
    () => Boolean(localStorage.getItem('cs_saved_username'))
  )
  const [users, setUsers] = useState([])
  const [userFormMode, setUserFormMode] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    department: 'CS팀',
    position: '',
    phone: '',
    email: '',
    role: 'USER',
    grantedDays: '15',
  })

  const apiFetch = (url, options = {}) => {
    const headers = new Headers(options.headers || {})

    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`)
    }

    return window.fetch(url, {
      ...options,
      headers,
    })
  }

  const [sites, setSites] = useState([])
  const [newSite, setNewSite] = useState({
    name: '',
    region: '',
    area: '',
    address: '',
    manager: '',
    managerPhone: '',
    customer: '',
    customerPhone: '',
    installDate: '',
    status: '설치 예정',
    equipment: '',
    memo: '',
  })
  const normalizeSite = (site) => {
  return {
    id: site.id,
    name: site.name || '',
    region: site.region || '',
    area: site.area || '',
    address: site.address || '',

    manager: site.extraData?.manager || '',
    managerPhone: site.extraData?.managerPhone || '',

    installCategory: site.extraData?.installCategory || '',
    installDays: Number(site.extraData?.installDays || 1),
    kioskModel: site.extraData?.kioskModel || '',
    kioskCount: Number(site.extraData?.kioskCount || 0),
    beamModel: site.extraData?.beamModel || '',
    sensorType:
      site.extraData?.sensorType ||
      site.extraData?.ceilingSensor ||
      '',
    matUse:
      site.extraData?.matUse ||
      site.extraData?.mat ||
      '',
    autoTeeUse:
      site.extraData?.autoTeeUse ||
      site.extraData?.autoTee ||
      '',
    autoTeeMaker: site.extraData?.autoTeeMaker || '',
    managementProgram: site.extraData?.managementProgram || '',
    cameraModel: site.extraData?.cameraModel || '',
    internetInstall: site.extraData?.internetInstall || '',
    partnerCompany: site.extraData?.partnerCompany || '',
    installAssigneeIds: Array.isArray(site.extraData?.installAssigneeIds)
      ? site.extraData.installAssigneeIds.map(Number)
      : [],
    installMemo: site.extraData?.installMemo || '',
    rawExtraData: site.extraData || {},

    customer: site.customerName || '',
    customerPhone: site.customerPhone || '',

    installDate: site.installDate
      ? site.installDate.slice(0, 10)
      : '',

    status: site.status || '설치 예정',
    equipment: site.equipment || '',
    memo: site.memo || '',

    histories: site.histories || [],
    photos: site.photos || [],
    siteFiles: (site.siteFiles || []).map((siteFile) => ({
      id: siteFile.id,
      fileId: siteFile.fileId,
      file: siteFile.file
        ? normalizeFile(siteFile.file)
        : null,
    })),
  }
}

const loadSites = async () => {
  try {
    const response = await apiFetch(`${API_URL}/api/sites`)

    if (!response.ok) {
      throw new Error('현장 목록 조회 실패')
    }

    const data = await response.json()

    setSites(data.map(normalizeSite))
  } catch (error) {
    console.error(error)
    alert('현장 목록을 불러오지 못했습니다.')
  }
}

useEffect(() => {
  const restoreLogin = async () => {
    if (!authToken) return

    try {
      const response = await apiFetch(`${API_URL}/api/me`)

      if (!response.ok) {
        throw new Error('로그인이 만료되었습니다.')
      }

      const user = await response.json()
      setCurrentUser(user)
      setIsLoggedIn(true)

      if (
        user?.role !== 'MASTER' &&
        user?.department === 'AS팀'
      ) {
        setWorkspaceMode('AS')
        setPage('as-center')
      }
    } catch (error) {
      localStorage.removeItem('cs_token')
      setAuthToken('')
      setIsLoggedIn(false)
    }
  }

  restoreLogin()
}, [])

useEffect(() => {
  if (isLoggedIn) {
    loadSites()
    loadFiles()
    loadNotices()
    loadCurrentUser()
    loadSystemOptions()
  }
}, [isLoggedIn])

  const [files, setFiles] = useState([])
  const [fileCategory, setFileCategory] = useState('설치 매뉴얼')
  const [selectedUploadFile, setSelectedUploadFile] = useState(null)
  const [fileSearch, setFileSearch] = useState('')
  const [fileFilter, setFileFilter] = useState('전체 분류')
  const [editingFileId, setEditingFileId] = useState(null)
  const [editingFileCategory, setEditingFileCategory] = useState('설치 매뉴얼')
  const [linkingFileId, setLinkingFileId] = useState(null)
  const [linkSiteId, setLinkSiteId] = useState('')

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const normalizeFile = (file) => ({
    id: file.id,
    category: file.category || '기타',
    name: file.originalName || file.name || '',
    size: formatFileSize(file.size),
    date: file.createdAt ? file.createdAt.slice(0, 10) : '',
  })

  const loadFiles = async () => {
    try {
      const response = await apiFetch(`${API_URL}/api/files`)

      if (!response.ok) {
        throw new Error('자료실 목록 조회 실패')
      }

      const data = await response.json()
      setFiles(data.map(normalizeFile))
    } catch (error) {
      console.error(error)
      alert('자료실 목록을 불러오지 못했습니다.')
    }
  }

  const uploadFile = async (e) => {
    e.preventDefault()

    if (!selectedUploadFile) {
      alert('업로드할 파일을 선택해주세요.')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', selectedUploadFile)
      formData.append('category', fileCategory)

      const response = await apiFetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '파일 업로드 실패')
      }

      setSelectedUploadFile(null)

      const fileInput = document.getElementById('resource-file-input')
      if (fileInput) fileInput.value = ''

      await loadFiles()
      alert('파일이 자료실에 업로드되었습니다.')
    } catch (error) {
      console.error(error)
      alert(`파일 업로드에 실패했습니다.\n${error.message}`)
    }
  }

  const downloadFile = (file) => {
    window.location.href = `${API_URL}/api/files/${file.id}/download`
  }

  const deleteFile = async (file) => {
    const confirmed = window.confirm(
      `"${file.name}" 파일을 정말 삭제하시겠습니까?`
    )

    if (!confirmed) return

    try {
      const response = await apiFetch(`${API_URL}/api/files/${file.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '파일 삭제 실패')
      }

      await loadFiles()
      alert('파일이 삭제되었습니다.')
    } catch (error) {
      console.error(error)
      alert(`파일 삭제에 실패했습니다.\n${error.message}`)
    }
  }

  const saveFileCategory = async (file) => {
    try {
      const response = await apiFetch(`${API_URL}/api/files/${file.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: editingFileCategory,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '분류 변경 실패')
      }

      setEditingFileId(null)
      await loadFiles()
      alert('파일 분류가 변경되었습니다.')
    } catch (error) {
      console.error(error)
      alert(`분류 변경에 실패했습니다.\n${error.message}`)
    }
  }

  const linkFileToSite = async (file) => {
    if (!linkSiteId) {
      alert('연결할 현장을 선택해주세요.')
      return
    }

    try {
      const response = await apiFetch(`${API_URL}/api/files/${file.id}/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: Number(linkSiteId),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '현장 연결 실패')
      }

      setLinkingFileId(null)
      setLinkSiteId('')
      alert('파일이 현장 상세페이지에 연결되었습니다.')
    } catch (error) {
      console.error(error)
      alert(`현장 연결에 실패했습니다.\n${error.message}`)
    }
  }

  const unlinkFileFromSite = async (siteFileId) => {
    const confirmed = window.confirm('이 현장에서 파일 연결을 해제할까요?')
    if (!confirmed) return

    try {
      const response = await apiFetch(`${API_URL}/api/site-files/${siteFileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '연결 해제 실패')
      }

      if (selectedSite) {
        const refreshed = await apiFetch(`${API_URL}/api/sites/${selectedSite.id}`)
        if (refreshed.ok) {
          const data = await refreshed.json()
          setSelectedSite(normalizeSite(data))
        }
      }
    } catch (error) {
      console.error(error)
      alert(`연결 해제에 실패했습니다.\n${error.message}`)
    }
  }

  const filteredFiles = files.filter((file) => {
    const searchOk =
      !fileSearch ||
      file.name.toLowerCase().includes(fileSearch.toLowerCase())

    const categoryOk =
      fileFilter === '전체 분류' ||
      file.category === fileFilter

    return searchOk && categoryOk
  })

  const [notices, setNotices] = useState([])

  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    isPinned: false,
  })

  const [noticeMode, setNoticeMode] = useState(false)
  const [editingNoticeId, setEditingNoticeId] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)

  const [systemOptionGroups, setSystemOptionGroups] = useState([])
  const [systemOptions, setSystemOptions] = useState([])
  const [systemOptionsLoaded, setSystemOptionsLoaded] = useState(false)
  const [selectedOptionGroup, setSelectedOptionGroup] =
    useState('INSTALL_CATEGORY')
  const [newSystemOptionValue, setNewSystemOptionValue] =
    useState('')

  const [newOptionGroupLabel, setNewOptionGroupLabel] =
    useState('')

  const OPTION_FALLBACKS = {
    SITE_REGION: ['서울', '경기', '인천', '강원', '충청', '전라', '경상', '제주'],
    SITE_STATUS: ['설치 예정', '설치 중', '설치 완료', '점검 필요'],
    FILE_CATEGORY: ['설치 매뉴얼', '프로그램', '드라이버', '문서', '기타'],
    INSTALL_CATEGORY: ['아파트', '관공서', '개인', '연습장', '기타'],
    INSTALL_DAYS: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    INSTALL_KIOSK_MODEL: ['DSR2-3000T', 'DSR1-3000T', '파크골프', '기타'],
    INSTALL_SENSOR_TYPE: ['없음', '천장센서', '좌타센서', '기타'],
    YES_NO: ['유', '무'],
    INSTALL_CAMERA_MODEL: ['MV-GE40GM', '없음', '기타'],
    SERVICE_STATUS: ['접수', '방문 예정', '처리 중', '완료', '보류'],
    BILLING_TYPE: ['무상', '유상'],
    MATERIAL_USAGE_TYPE: ['신규설치', 'AS교체', '추가설치', '현장지급', '불량교환', '기타'],
    LEAVE_TYPE: ['연차', '오전 반차', '오후 반차'],
    INVENTORY_CATEGORY: ['기타', '키오스크', '센서', '카메라', 'PC/부품', '케이블', '소모품'],
    INVENTORY_UNIT: ['개', '대', 'EA', 'SET', 'M', 'BOX'],
    ASSET_TYPE: ['키오스크', '카메라', '센서', '관리PC', '프로젝터', '오토티업', '네트워크장비', '기타'],
    ASSET_STATUS: ['사용중', '예비', '수리중', '교체', '폐기'],
    SERVICE_ATTACHMENT_KIND: ['작업 전', '작업 중', '작업 후', '문서', '기타'],
    SERVICE_REQUEST_TYPE: ['원격A/S', '방문A/S', '상담'],
    SERVICE_INTAKE_CHANNEL: ['전화', '카카오톡', '직접등록', '기타'],
    SERVICE_PRIORITY: ['일반', '긴급'],
  }

  const optionValues = (groupKey) => {
    const values = systemOptions
      .filter(
        (option) =>
          option.groupKey === groupKey &&
          option.isActive !== false
      )
      .sort(
        (a, b) =>
          Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
          Number(a.id || 0) - Number(b.id || 0)
      )
      .map((option) => option.value)

    if (systemOptionsLoaded) {
      return values
    }

    return OPTION_FALLBACKS[groupKey] || []
  }

  const optionRows = (groupKey) =>
    systemOptions
      .filter((option) => option.groupKey === groupKey)
      .sort(
        (a, b) =>
          Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
          Number(a.id || 0) - Number(b.id || 0)
      )

  const today = new Date()
  const [leaveYear, setLeaveYear] = useState(today.getFullYear())
  const [leaveMonth, setLeaveMonth] = useState(today.getMonth() + 1)
  const [leaveSummary, setLeaveSummary] = useState({
    grantedDays: 0,
    usedDays: 0,
    pendingDays: 0,
    remainingDays: 0,
    availableDays: 0,
    requests: [],
  })
  const [leaveCalendar, setLeaveCalendar] = useState([])
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState([])
  const [newLeave, setNewLeave] = useState({
    startDate: '',
    endDate: '',
    days: '1',
    leaveType: '연차',
    reason: '',
  })
  const [editingLeave, setEditingLeave] = useState(null)

  const [scheduleYear, setScheduleYear] = useState(
    today.getFullYear()
  )
  const [scheduleMonth, setScheduleMonth] = useState(
    today.getMonth() + 1
  )
  const [monthlySchedule, setMonthlySchedule] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    summary: {
      installations: 0,
      scheduledInstallations: 0,
      serviceVisits: 0,
      leaves: 0,
    },
    events: [],
  })
  const [scheduleLoading, setScheduleLoading] = useState(false)

  const localDateString = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const emptyWorkLogForm = () => ({
    workEntries: [],
    workDate: localDateString(),
    title: '',
    completedWork: '',
    pendingWork: '',
    nextPlan: '',
    issues: '',
    handover: '',
    memo: '',
    status: 'SUBMITTED',
    isImportant: false,
    siteIds: [],
    materials: [],
  })

  const [workLogs, setWorkLogs] = useState([])
  const [workLogServices, setWorkLogServices] = useState([])
  const [workLogServicesError, setWorkLogServicesError] = useState('')
  const [workLogFormOpen, setWorkLogFormOpen] = useState(false)
  const [editingWorkLogId, setEditingWorkLogId] = useState(null)
  const [workLogForm, setWorkLogForm] = useState(emptyWorkLogForm())
  const [todayTeamWork, setTodayTeamWork] = useState({
    date: localDateString(),
    members: [],
  })
  const [dashboardWeekAnchor, setDashboardWeekAnchor] =
    useState(localDateString())
  const [weeklyWork, setWeeklyWork] = useState({
    startDate: '',
    endDate: '',
    summary: {
      installations: 0,
      serviceVisits: 0,
      leaves: 0,
      urgentServices: 0,
    },
    days: [],
  })
  const [weeklyWorkLoading, setWeeklyWorkLoading] = useState(false)
  const [manuals, setManuals] = useState([])
  const [manualCandidates, setManualCandidates] = useState([])
  const [manualSearch, setManualSearch] = useState('')
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryTransactions, setInventoryTransactions] = useState([])
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryFormOpen, setInventoryFormOpen] = useState(false)
  const [inventoryForm, setInventoryForm] = useState({
    code: '',
    name: '',
    category: '기타',
    unit: '개',
    initialStock: 0,
    minStock: 0,
    location: '',
    memo: '',
  })

  const emptyServiceForm = () => ({
    siteId: '',
    receivedDate: localDateString(),
    visitDate: '',
    requestType: '방문A/S',
    intakeChannel: '직접등록',
    customerName: '',
    priority: '일반',
    requestContent: '',
    resolution: '',
    contact: '',
    assigneeIds: [],
    billingType: '무상',
    billingAmount: 0,
    status: '접수',
    memo: '',
  })

  const [serviceRequests, setServiceRequests] = useState([])
  const [remoteServiceRequests, setRemoteServiceRequests] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [serviceFormOpen, setServiceFormOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState(null)
  const [serviceForm, setServiceForm] = useState(emptyServiceForm())
  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceStatusFilter, setServiceStatusFilter] = useState('전체')

  // ============================================================
  // A/S팀 전용 접수센터
  // ============================================================

  const [workspaceMode, setWorkspaceMode] = useState('CS')

  const emptyAsIntakeForm = () => ({
    requestType: '방문A/S',
    intakeChannel: '전화',
    siteName: '',
    customerName: '',
    contact: '',
    requestContent: '',
    priority: '일반',
    visitDate: '',
    memo: '',
  })

  const [asIntakeForm, setAsIntakeForm] = useState(emptyAsIntakeForm())
  const [asCenterData, setAsCenterData] = useState({
    date: localDateString(),
    summary: {
      total: 0,
      remote: 0,
      visit: 0,
      consult: 0,
      pending: 0,
      completed: 0,
      urgent: 0,
    },
    today: [],
    recent: [],
  })
  const [asCenterLoading, setAsCenterLoading] = useState(false)
  const [lastAsIntakeResult, setLastAsIntakeResult] = useState(null)
  const [asRecentSearch, setAsRecentSearch] = useState('')
  const [asRecentTypeFilter, setAsRecentTypeFilter] = useState('전체')
  const [asRecentStatusFilter, setAsRecentStatusFilter] = useState('미처리')
  const [selectedAsCase, setSelectedAsCase] = useState(null)
  const [asProcessResolution, setAsProcessResolution] = useState('')
  const [asProcessNote, setAsProcessNote] = useState('')
  const [asConvertVisitDate, setAsConvertVisitDate] = useState('')
  const [asConvertReason, setAsConvertReason] = useState('')
  const [asProcessLoading, setAsProcessLoading] = useState(false)
  const [asOperatingSetting, setAsOperatingSetting] = useState({
    startTime: '09:00',
    endTime: '18:00',
    workingDays: [1, 2, 3, 4, 5],
    holidays: [],
  })
  const [asHolidayInput, setAsHolidayInput] = useState('')

  const isAsTeamUser =
    currentUser?.department === 'AS팀' &&
    currentUser?.role !== 'MASTER'

  const activeWorkspace =
    currentUser?.role === 'MASTER'
      ? workspaceMode
      : isAsTeamUser
        ? 'AS'
        : 'CS'

  const switchWorkspace = (mode) => {
    setWorkspaceMode(mode)
    setPage(
      mode === 'AS'
        ? 'as-center'
        : 'dashboard'
    )
  }

  const emptyInstallationForm = () => ({
    siteId: '',
    siteName: '',
    installDate: '',
    installDays: 1,
    status: '설치 예정',
    installCategory: '',
    kioskModel: '',
    kioskCount: 0,
    beamModel: '',
    sensorType: '',
    matUse: '',
    autoTeeUse: '',
    autoTeeMaker: '',
    managementProgram: '',
    cameraModel: '',
    internetInstall: '',
    equipment: '',
    partnerCompany: '',
    assigneeIds: [],
    installMemo: '',
  })

  const [installationSearch, setInstallationSearch] = useState('')
  const [installationStatusFilter, setInstallationStatusFilter] =
    useState('전체')
  const [installationFormOpen, setInstallationFormOpen] =
    useState(false)
  const [editingInstallationSiteId, setEditingInstallationSiteId] =
    useState(null)
  const [installationForm, setInstallationForm] =
    useState(emptyInstallationForm())

  // ============================================================
  // FSM 통합 베타 상태
  // ============================================================

  const [isOnline, setIsOnline] = useState(
    () => navigator.onLine
  )

  const [selectedService, setSelectedService] = useState(null)
  const [serviceActivityText, setServiceActivityText] = useState('')
  const [serviceAttachmentFile, setServiceAttachmentFile] = useState(null)
  const [serviceAttachmentKind, setServiceAttachmentKind] =
    useState('작업 후')
  const [serviceCompleteForm, setServiceCompleteForm] = useState({
    resolution: '',
    billingType: '무상',
    billingAmount: 0,
    materials: [],
  })

  const [assets, setAssets] = useState([])
  const [assetSearch, setAssetSearch] = useState('')
  const [assetSiteFilter, setAssetSiteFilter] = useState('')
  const [assetFormOpen, setAssetFormOpen] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState(null)
  const emptyAssetForm = () => ({
    siteId: '',
    assetType: '',
    model: '',
    serialNumber: '',
    quantity: 1,
    installedAt: '',
    status: '사용중',
    location: '',
    memo: '',
  })
  const [assetForm, setAssetForm] = useState(emptyAssetForm())

  const [checklistTemplates, setChecklistTemplates] = useState([])
  const [checklistTemplateForm, setChecklistTemplateForm] = useState({
    name: '',
    workType: 'SERVICE',
    itemsText: '',
  })

  const [dispatchDate, setDispatchDate] = useState(localDateString())
  const [dispatchData, setDispatchData] = useState({
    date: localDateString(),
    members: [],
    unassigned: {
      services: [],
      installations: [],
    },
  })

  const [alertsData, setAlertsData] = useState({
    generatedAt: '',
    unreadCount: 0,
    alerts: [],
  })

  const firstDayOfMonth = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
  }

  const [kpiFrom, setKpiFrom] = useState(firstDayOfMonth())
  const [kpiTo, setKpiTo] = useState(localDateString())
  const [kpiData, setKpiData] = useState(null)

  const [qrCodeInput, setQrCodeInput] = useState('')
  const [qrLookup, setQrLookup] = useState(null)
  const [qrScanning, setQrScanning] = useState(false)
  const qrVideoRef = useRef(null)
  const qrStreamRef = useRef(null)
  const qrScanFrameRef = useRef(null)

  const [installChecklistSite, setInstallChecklistSite] = useState(null)
  const [installChecklistItems, setInstallChecklistItems] = useState([])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const loadSystemOptions = async () => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/system-options`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '선택항목 조회 실패'
        )
      }

      setSystemOptionGroups(
        data.groups || []
      )
      setSystemOptions(
        data.options || []
      )
      setSystemOptionsLoaded(true)
    } catch (error) {
      console.error(error)
    }
  }

  const addSystemOptionGroup = async (e) => {
    e.preventDefault()

    const label =
      newOptionGroupLabel.trim()

    if (!label) {
      alert('새 선택항목 그룹 이름을 입력해주세요.')
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/system-option-groups`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              label,
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '선택항목 그룹 추가 실패'
        )
      }

      setNewOptionGroupLabel('')
      setSelectedOptionGroup(
        data.key
      )

      await loadSystemOptions()
    } catch (error) {
      console.error(error)

      alert(
        `선택항목 그룹을 추가하지 못했습니다.\n${error.message}`
      )
    }
  }

  const renameSystemOptionGroup = async (group) => {
    const label =
      window.prompt(
        '선택항목 그룹 이름을 변경합니다.',
        group.label
      )

    if (
      label === null ||
      !label.trim() ||
      label.trim() ===
        group.label
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/system-option-groups/${encodeURIComponent(
            group.key
          )}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              label:
                label.trim(),
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '그룹 이름 변경 실패'
        )
      }

      await loadSystemOptions()
    } catch (error) {
      console.error(error)

      alert(
        `선택항목 그룹 이름을 변경하지 못했습니다.\n${error.message}`
      )
    }
  }

  const deleteSystemOptionGroup = async (group) => {
    if (group.isSystem) {
      alert(
        '이 그룹은 실제 화면의 선택창과 연결된 기본 그룹이라 삭제할 수 없습니다.\n그룹 이름 변경과 안쪽 항목 추가/삭제는 가능합니다.'
      )
      return
    }

    if (
      !window.confirm(
        `"${group.label}" 그룹을 삭제할까요?\n\n그룹 안의 선택항목도 선택창에서 숨겨집니다.`
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/system-option-groups/${encodeURIComponent(
            group.key
          )}`,
          {
            method: 'DELETE',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '선택항목 그룹 삭제 실패'
        )
      }

      const remaining =
        systemOptionGroups.filter(
          (item) =>
            item.key !==
            group.key
        )

      setSelectedOptionGroup(
        remaining[0]?.key ||
        ''
      )

      await loadSystemOptions()
    } catch (error) {
      console.error(error)

      alert(
        `선택항목 그룹을 삭제하지 못했습니다.\n${error.message}`
      )
    }
  }

  const addSystemOption = async (e) => {
    e.preventDefault()

    const value =
      newSystemOptionValue.trim()

    if (!value) {
      alert('추가할 항목명을 입력해주세요.')
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/system-options`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              groupKey:
                selectedOptionGroup,
              value,
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '선택항목 추가 실패'
        )
      }

      setNewSystemOptionValue('')
      await loadSystemOptions()
    } catch (error) {
      console.error(error)
      alert(
        `선택항목을 추가하지 못했습니다.\n${error.message}`
      )
    }
  }

  const renameSystemOption = async (option) => {
    if (option.isLocked) {
      alert(
        '시스템 기본 항목은 이름을 변경할 수 없습니다.'
      )
      return
    }

    const value =
      window.prompt(
        '새 항목명을 입력하세요.',
        option.value
      )

    if (
      value === null ||
      !value.trim() ||
      value.trim() === option.value
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/system-options/${option.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              value:
                value.trim(),
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '선택항목 수정 실패'
        )
      }

      await loadSystemOptions()
    } catch (error) {
      console.error(error)
      alert(
        `선택항목을 수정하지 못했습니다.\n${error.message}`
      )
    }
  }

  const deleteSystemOption = async (option) => {
    if (option.isLocked) {
      alert(
        '시스템 동작에 필요한 기본 항목은 삭제할 수 없습니다.'
      )
      return
    }

    if (
      !window.confirm(
        `"${option.value}" 항목을 선택창에서 삭제할까요?\n\n기존에 저장된 과거 데이터는 지워지지 않습니다.`
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/system-options/${option.id}`,
          {
            method: 'DELETE',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '선택항목 삭제 실패'
        )
      }

      await loadSystemOptions()
    } catch (error) {
      console.error(error)
      alert(
        `선택항목을 삭제하지 못했습니다.\n${error.message}`
      )
    }
  }

  useEffect(() => {
    if (!systemOptionsLoaded) return

    const fileCategories =
      optionValues('FILE_CATEGORY')

    if (
      fileCategories.length &&
      !fileCategories.includes(
        fileCategory
      )
    ) {
      setFileCategory(
        fileCategories[0]
      )
    }

    const inventoryCategories =
      optionValues(
        'INVENTORY_CATEGORY'
      )

    const inventoryUnits =
      optionValues(
        'INVENTORY_UNIT'
      )

    setInventoryForm((prev) => ({
      ...prev,
      category:
        inventoryCategories.includes(
          prev.category
        )
          ? prev.category
          : inventoryCategories[0] ||
            '',
      unit:
        inventoryUnits.includes(
          prev.unit
        )
          ? prev.unit
          : inventoryUnits[0] ||
            '',
    }))

    const leaveTypes =
      optionValues('LEAVE_TYPE')

    if (
      leaveTypes.length &&
      !leaveTypes.includes(
        newLeave.leaveType
      )
    ) {
      setNewLeave((prev) => ({
        ...prev,
        leaveType:
          leaveTypes[0],
      }))
    }
  }, [
    systemOptionsLoaded,
    systemOptions,
  ])

  const normalizeNotice = (notice) => ({
    id: notice.id,
    title: notice.title,
    content: notice.content,
    isPinned: Boolean(notice.isPinned),
    writer: notice.author?.name || '관리자',
    date: notice.createdAt ? notice.createdAt.slice(0, 10) : '',
  })

  const loadNotices = async () => {
    try {
      const response = await apiFetch(`${API_URL}/api/notices`)

      if (!response.ok) {
        throw new Error('공지사항 조회 실패')
      }

      const data = await response.json()
      setNotices(data.map(normalizeNotice))
    } catch (error) {
      console.error(error)
      alert('공지사항을 불러오지 못했습니다.')
    }
  }

  const loadCurrentUser = async () => {
    try {
      const response = await apiFetch(`${API_URL}/api/me`)
      if (!response.ok) throw new Error('사용자 조회 실패')

      const data = await response.json()
      setCurrentUser(data)

      if (
        data?.role !== 'MASTER' &&
        data?.department === 'AS팀' &&
        ![
          'as-center',
          'notices',
          'profile',
        ].includes(page)
      ) {
        setWorkspaceMode('AS')
        setPage('as-center')
      }
    } catch (error) {
      console.error(error)
    }
  }

  const loadLeaveData = async (
    year = leaveYear,
    month = leaveMonth
  ) => {
    try {
      const [
        summaryResponse,
        calendarResponse,
        pendingResponse,
      ] = await Promise.all([
        apiFetch(`${API_URL}/api/leave/summary?year=${year}`),
        apiFetch(
          `${API_URL}/api/leave/calendar?year=${year}&month=${month}`
        ),
        apiFetch(`${API_URL}/api/leave/pending`),
      ])

      if (
        !summaryResponse.ok ||
        !calendarResponse.ok ||
        !pendingResponse.ok
      ) {
        throw new Error('연차 정보 조회 실패')
      }

      const summary = await summaryResponse.json()
      const calendar = await calendarResponse.json()
      const pending = await pendingResponse.json()

      setLeaveSummary(summary)
      setLeaveCalendar(calendar)
      setPendingLeaveRequests(pending)
    } catch (error) {
      console.error(error)
      alert('연차 정보를 불러오지 못했습니다.')
    }
  }

  const loadTodayTeamWork = async () => {
    try {
      const response = await apiFetch(
        `${API_URL}/api/worklogs/today-summary?date=${localDateString()}`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '오늘 팀 업무 조회 실패')
      }

      setTodayTeamWork(data)
    } catch (error) {
      console.error(error)
    }
  }

  const loadWeeklyWork = async (
    date = dashboardWeekAnchor
  ) => {
    try {
      setWeeklyWorkLoading(true)

      const response =
        await apiFetch(
          `${API_URL}/api/dashboard/week-summary?date=${date}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '주간 업무 조회 실패'
        )
      }

      setWeeklyWork(data)
    } catch (error) {
      console.error(error)
    } finally {
      setWeeklyWorkLoading(false)
    }
  }

  const moveDashboardWeek = (offset) => {
    const base =
      new Date(
        `${dashboardWeekAnchor}T12:00:00`
      )

    base.setDate(
      base.getDate() +
      offset * 7
    )

    const year =
      base.getFullYear()

    const month =
      String(
        base.getMonth() + 1
      ).padStart(2, '0')

    const day =
      String(
        base.getDate()
      ).padStart(2, '0')

    setDashboardWeekAnchor(
      `${year}-${month}-${day}`
    )
  }

  const resetDashboardWeek = () => {
    setDashboardWeekAnchor(
      localDateString()
    )
  }

  const weeklyDayLabel = (
    dateText
  ) => {
    const date =
      new Date(
        `${dateText}T12:00:00`
      )

    const weekdays = [
      '일',
      '월',
      '화',
      '수',
      '목',
      '금',
      '토',
    ]

    return {
      day:
        date.getDate(),
      weekday:
        weekdays[
          date.getDay()
        ],
    }
  }

  const openWeeklyEvent = async (
    event
  ) => {
    if (
      event.type ===
      'INSTALL'
    ) {
      const site =
        sites.find(
          (row) =>
            row.id ===
            event.siteId
        )

      if (site) {
        openSiteDetail(site)
      } else {
        setPage(
          'installations'
        )
      }

      return
    }

    if (
      event.type ===
      'SERVICE'
    ) {
      await loadServiceDetail(
        event.serviceRequestId
      )
      return
    }

    if (
      event.type ===
      'LEAVE'
    ) {
      setPage('leave')
    }
  }

  const loadManuals = async () => {
    try {
      const requests = [
        apiFetch(`${API_URL}/api/manuals`),
      ]

      if (
        ['MASTER', 'ADMIN'].includes(currentUser?.role)
      ) {
        requests.push(
          apiFetch(
            `${API_URL}/api/manual-candidates?status=CANDIDATE`
          )
        )
      }

      const responses =
        await Promise.all(requests)

      const manualsResponse =
        responses[0]

      const manualData =
        await manualsResponse.json()

      if (!manualsResponse.ok) {
        throw new Error(
          manualData.error ||
          '업무 매뉴얼 조회 실패'
        )
      }

      setManuals(manualData)

      if (
        responses[1]
      ) {
        const candidatesData =
          await responses[1].json()

        if (!responses[1].ok) {
          throw new Error(
            candidatesData.error ||
            '매뉴얼 후보 조회 실패'
          )
        }

        setManualCandidates(
          candidatesData
        )
      } else {
        setManualCandidates([])
      }
    } catch (error) {
      console.error(error)
      alert(
        `업무 매뉴얼을 불러오지 못했습니다.\n${error.message}`
      )
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'dashboard'
    ) {
      loadTodayTeamWork()
      loadWeeklyWork(
        dashboardWeekAnchor
      )
    }
  }, [
    isLoggedIn,
    page,
    dashboardWeekAnchor,
  ])

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'manuals'
    ) {
      loadManuals()
    }
  }, [
    isLoggedIn,
    page,
    currentUser?.role,
  ])

  const promoteManualCandidate = async (candidate) => {
    const title =
      window.prompt(
        '확정할 매뉴얼 제목을 입력하세요.',
        candidate.title || ''
      )

    if (!title?.trim()) return

    const category =
      window.prompt(
        '매뉴얼 분류를 입력하세요. 예: 네트워크 / 장비 / 설치 / 프로그램',
        '기타'
      )

    if (category === null) return

    const content =
      window.prompt(
        '매뉴얼 내용을 확인하거나 수정하세요.',
        candidate.content || ''
      )

    if (content === null) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/manual-candidates/${candidate.id}/promote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            category:
              category.trim() || '기타',
            content,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '매뉴얼 확정 실패'
        )
      }

      await loadManuals()
      alert(
        '업무 매뉴얼로 확정했습니다.'
      )
    } catch (error) {
      console.error(error)
      alert(
        `매뉴얼 확정에 실패했습니다.\n${error.message}`
      )
    }
  }

  const rejectManualCandidate = async (candidate) => {
    if (
      !window.confirm(
        `"${candidate.title}" 후보를 제외할까요?`
      )
    ) {
      return
    }

    try {
      const response = await apiFetch(
        `${API_URL}/api/manual-candidates/${candidate.id}/reject`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '후보 제외 실패'
        )
      }

      await loadManuals()
    } catch (error) {
      console.error(error)
      alert(
        `후보를 제외하지 못했습니다.\n${error.message}`
      )
    }
  }

  const editManual = async (manual) => {
    const title =
      window.prompt(
        '매뉴얼 제목',
        manual.title || ''
      )

    if (!title?.trim()) return

    const category =
      window.prompt(
        '매뉴얼 분류',
        manual.category || '기타'
      )

    if (category === null) return

    const content =
      window.prompt(
        '매뉴얼 내용',
        manual.content || ''
      )

    if (content === null) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/manuals/${manual.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            category:
              category.trim() || '기타',
            content,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '매뉴얼 수정 실패'
        )
      }

      await loadManuals()
    } catch (error) {
      console.error(error)
      alert(
        `매뉴얼을 수정하지 못했습니다.\n${error.message}`
      )
    }
  }

  const deleteManual = async (manual) => {
    if (
      !window.confirm(
        `"${manual.title}" 매뉴얼을 삭제할까요?\n삭제하면 원래 후보 상태로 되돌아갑니다.`
      )
    ) {
      return
    }

    try {
      const response = await apiFetch(
        `${API_URL}/api/manuals/${manual.id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '매뉴얼 삭제 실패'
        )
      }

      await loadManuals()
    } catch (error) {
      console.error(error)
      alert(
        `매뉴얼을 삭제하지 못했습니다.\n${error.message}`
      )
    }
  }

  const loadMonthlySchedule = async (
    year = scheduleYear,
    month = scheduleMonth
  ) => {
    try {
      setScheduleLoading(true)

      const response =
        await apiFetch(
          `${API_URL}/api/schedule/month?year=${year}&month=${month}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '월간 일정 조회 실패'
        )
      }

      setMonthlySchedule(data)
    } catch (error) {
      console.error(error)

      alert(
        `월간 일정을 불러오지 못했습니다.\n${error.message}`
      )
    } finally {
      setScheduleLoading(false)
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'schedule'
    ) {
      loadMonthlySchedule(
        scheduleYear,
        scheduleMonth
      )
    }
  }, [
    isLoggedIn,
    page,
    scheduleYear,
    scheduleMonth,
  ])

  const moveScheduleMonth = (offset) => {
    const date =
      new Date(
        scheduleYear,
        scheduleMonth - 1 + offset,
        1
      )

    setScheduleYear(
      date.getFullYear()
    )
    setScheduleMonth(
      date.getMonth() + 1
    )
  }

  const getScheduleCalendarCells = () => {
    const firstDay =
      new Date(
        scheduleYear,
        scheduleMonth - 1,
        1
      )

    const lastDay =
      new Date(
        scheduleYear,
        scheduleMonth,
        0
      )

    const cells = []

    for (
      let i = 0;
      i < firstDay.getDay();
      i += 1
    ) {
      cells.push(null)
    }

    for (
      let day = 1;
      day <= lastDay.getDate();
      day += 1
    ) {
      cells.push(
        new Date(
          scheduleYear,
          scheduleMonth - 1,
          day
        )
      )
    }

    while (
      cells.length % 7 !== 0
    ) {
      cells.push(null)
    }

    return cells
  }

  const scheduleDateKey = (date) => {
    if (!date) return ''

    const year =
      date.getFullYear()

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, '0')

    const day =
      String(
        date.getDate()
      ).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const getScheduleEventsForDate = (date) => {
    if (!date) return []

    const key =
      scheduleDateKey(date)

    return (
      monthlySchedule.events || []
    )
      .filter((event) => {
        if (
          event.type === 'LEAVE' ||
          event.type === 'INSTALL'
        ) {
          return (
            key >= event.startDate &&
            key <= event.endDate
          )
        }

        return (
          event.date === key
        )
      })
      .sort((a, b) => {
        const order = {
          INSTALL: 1,
          SERVICE: 2,
          LEAVE: 3,
        }

        return (
          (order[a.type] || 9) -
          (order[b.type] || 9)
        )
      })
  }

  const getScheduleEventStyle = (event) => {
    if (event.type === 'INSTALL') {
      if (
        event.status ===
        '설치 완료'
      ) {
        return {
          background: '#e8f7ef',
          color: '#176a49',
          borderColor: '#bfe6d2',
        }
      }

      if (
        event.status ===
        '설치 중'
      ) {
        return {
          background: '#e9f4ff',
          color: '#1766b1',
          borderColor: '#beddf7',
        }
      }

      return {
        background: '#eaf2ff',
        color: '#245fc5',
        borderColor: '#c6dafb',
      }
    }

    if (event.type === 'SERVICE') {
      if (
        event.status === '완료'
      ) {
        return {
          background: '#fff4e8',
          color: '#a65314',
          borderColor: '#ffd5ae',
        }
      }

      return {
        background: '#fff0e5',
        color: '#b94b10',
        borderColor: '#ffc7a5',
      }
    }

    return {
      background: '#f1edff',
      color: '#6242b8',
      borderColor: '#d7cdfd',
    }
  }

  const getScheduleEventLabel = (event) => {
    if (event.type === 'INSTALL') {
      return '설치'
    }

    if (event.type === 'SERVICE') {
      return 'A/S'
    }

    return '연차'
  }

  const openScheduleEvent = async (event) => {
    if (
      event.type === 'INSTALL' &&
      event.siteId
    ) {
      const site =
        sites.find(
          (item) =>
            item.id === event.siteId
        )

      if (site) {
        await openSiteDetail(site)
        return
      }

      setPage('sites')
      return
    }

    if (
      event.type === 'SERVICE'
    ) {
      setPage('service')
      return
    }

    if (
      event.type === 'LEAVE'
    ) {
      setPage('leave')
    }
  }

  const isScheduleToday = (date) => {
    if (!date) return false

    const now = new Date()

    return (
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth() &&
      date.getDate() ===
        now.getDate()
    )
  }

  const installationFormFromSite = (site) => ({
    siteId: String(site.id),
    siteName: site.name || '',
    installDate: site.installDate || '',
    installDays: Number(site.installDays || 1),
    status: site.status || '설치 예정',
    installCategory: site.installCategory || '',
    kioskModel: site.kioskModel || '',
    kioskCount: Number(site.kioskCount || 0),
    beamModel: site.beamModel || '',
    sensorType: site.sensorType || '',
    matUse: site.matUse || '',
    autoTeeUse: site.autoTeeUse || '',
    autoTeeMaker: site.autoTeeMaker || '',
    managementProgram: site.managementProgram || '',
    cameraModel: site.cameraModel || '',
    internetInstall: site.internetInstall || '',
    equipment: site.equipment || '',
    partnerCompany: site.partnerCompany || '',
    assigneeIds: Array.isArray(site.installAssigneeIds)
      ? site.installAssigneeIds
      : [],
    installMemo: site.installMemo || '',
  })

  const openNewInstallation = () => {
    setEditingInstallationSiteId(null)
    setInstallationForm(emptyInstallationForm())
    setInstallationFormOpen(true)
  }

  const applyInstallationSiteSuggestion = () => {
    if (editingInstallationSiteId) {
      return
    }

    const name =
      installationForm.siteName
        .trim()

    if (!name) return

    const matchedSite =
      sites.find(
        (site) =>
          site.name.trim() === name
      )

    if (matchedSite) {
      setInstallationForm(
        installationFormFromSite(
          matchedSite
        )
      )
    }
  }

  const editInstallation = (site) => {
    setEditingInstallationSiteId(site.id)
    setInstallationForm(
      installationFormFromSite(site)
    )
    setInstallationFormOpen(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const toggleInstallationAssignee = (userId) => {
    setInstallationForm((prev) => ({
      ...prev,
      assigneeIds:
        prev.assigneeIds.includes(userId)
          ? prev.assigneeIds.filter(
              (id) => id !== userId
            )
          : [
              ...prev.assigneeIds,
              userId,
            ],
    }))
  }

  const getInstallationAssigneeNames = (site) => {
    const ids =
      Array.isArray(site.installAssigneeIds)
        ? site.installAssigneeIds
        : []

    if (!ids.length) {
      return site.manager || '-'
    }

    const names =
      ids
        .map(
          (id) =>
            teamMembers.find(
              (member) =>
                member.id === Number(id)
            )?.name
        )
        .filter(Boolean)

    return names.length
      ? names.join(', ')
      : site.manager || '-'
  }

  const saveInstallation = async (e) => {
    e.preventDefault()

    const siteName =
      installationForm.siteName
        .trim()

    if (!siteName) {
      alert('현장명을 입력해주세요.')
      return
    }

    if (!installationForm.installDate) {
      alert('설치 예정일을 입력해주세요.')
      return
    }

    const matchedSite =
      sites.find(
        (site) =>
          site.name.trim() ===
          siteName
      )

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/installations/save`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              siteId:
                editingInstallationSiteId ||
                matchedSite?.id ||
                null,
              siteName,
              installDate:
                installationForm.installDate,
              installDays:
                Number(
                  installationForm.installDays
                ) || 1,
              status:
                installationForm.status,
              installCategory:
                installationForm.installCategory,
              kioskModel:
                installationForm.kioskModel,
              kioskCount:
                Number(
                  installationForm.kioskCount
                ) || 0,
              beamModel:
                installationForm.beamModel,
              sensorType:
                installationForm.sensorType,
              matUse:
                installationForm.matUse,
              autoTeeUse:
                installationForm.autoTeeUse,
              autoTeeMaker:
                installationForm.autoTeeMaker,
              managementProgram:
                installationForm.managementProgram,
              cameraModel:
                installationForm.cameraModel,
              internetInstall:
                installationForm.internetInstall,
              equipment:
                installationForm.equipment,
              partnerCompany:
                installationForm.partnerCompany,
              assigneeIds:
                installationForm.assigneeIds,
              installMemo:
                installationForm.installMemo,
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '설치 정보 저장 실패'
        )
      }

      await loadSites()

      setEditingInstallationSiteId(null)
      setInstallationForm(
        emptyInstallationForm()
      )
      setInstallationFormOpen(false)

      alert(
        editingInstallationSiteId
          ? '설치 정보가 수정되었습니다.'
          : '설치 예정이 등록되었습니다.'
      )
    } catch (error) {
      console.error(error)

      alert(
        `설치 정보를 저장하지 못했습니다.\n${error.message}`
      )
    }
  }

  const startNewSiteForInstallation = () => {
    setNewSite((prev) => ({
      ...prev,
      status: '설치 예정',
    }))
    setPage('register')
  }

  // ============================================================
  // FSM 통합 베타 함수
  // ============================================================

  const formatDateTime = (value) => {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return String(value)
    }

    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const serviceDraftKey = (id) =>
    `cs_service_draft_${id}`

  const saveServiceOfflineDraft = () => {
    if (!selectedService) return

    localStorage.setItem(
      serviceDraftKey(selectedService.id),
      JSON.stringify(serviceCompleteForm)
    )

    alert(
      'A/S 작업 내용을 이 PC/기기에 임시저장했습니다.\n인터넷이 끊겨도 현재 작성 내용은 남아 있습니다.'
    )
  }

  const clearServiceOfflineDraft = (id) => {
    localStorage.removeItem(
      serviceDraftKey(id)
    )
  }

  const loadServiceDetail = async (rowOrId) => {
    try {
      const id =
        typeof rowOrId === 'object'
          ? rowOrId.id
          : Number(rowOrId)

      const response =
        await apiFetch(
          `${API_URL}/api/service-requests/${id}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'A/S 상세 조회 실패'
        )
      }

      const savedDraft =
        localStorage.getItem(
          serviceDraftKey(id)
        )

      let draft = null

      if (savedDraft) {
        try {
          draft =
            JSON.parse(savedDraft)
        } catch {
          draft = null
        }
      }

      setSelectedService(data)

      setServiceCompleteForm(
        draft || {
          resolution:
            data.resolution || '',
          billingType:
            data.billingType || '무상',
          billingAmount:
            Number(
              data.billingAmount || 0
            ),
          materials:
            [],
        }
      )

      setServiceActivityText('')
      setServiceAttachmentFile(null)
      setPage('service-detail')

      await loadInventory()
    } catch (error) {
      console.error(error)

      alert(
        `A/S 상세 정보를 불러오지 못했습니다.\n${error.message}`
      )
    }
  }

  const refreshServiceDetail = async () => {
    if (!selectedService?.id) {
      return
    }

    const response =
      await apiFetch(
        `${API_URL}/api/service-requests/${selectedService.id}`
      )

    const data =
      await response.json()

    if (!response.ok) {
      throw new Error(
        data.error ||
        'A/S 상세 새로고침 실패'
      )
    }

    setSelectedService(data)
  }

  const addServiceActivity = async () => {
    if (
      !selectedService ||
      !serviceActivityText.trim()
    ) {
      return
    }

    if (!isOnline) {
      alert(
        '현재 오프라인입니다. 메모는 A/S 작업 임시저장 기능을 사용해주세요.'
      )
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/service-requests/${selectedService.id}/activities`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              title: '업무 메모',
              content:
                serviceActivityText.trim(),
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '메모 저장 실패'
        )
      }

      setServiceActivityText('')
      await refreshServiceDetail()
    } catch (error) {
      console.error(error)

      alert(
        `메모를 저장하지 못했습니다.\n${error.message}`
      )
    }
  }

  const uploadServiceAttachment = async () => {
    if (
      !selectedService ||
      !serviceAttachmentFile
    ) {
      alert('첨부할 파일 또는 사진을 선택해주세요.')
      return
    }

    if (!isOnline) {
      alert('파일 업로드는 인터넷 연결이 필요합니다.')
      return
    }

    try {
      const formData =
        new FormData()

      formData.append(
        'file',
        serviceAttachmentFile
      )

      formData.append(
        'category',
        'A/S'
      )

      const uploadResponse =
        await apiFetch(
          `${API_URL}/api/files/upload`,
          {
            method: 'POST',
            body: formData,
          }
        )

      const uploaded =
        await uploadResponse.json()

      if (!uploadResponse.ok) {
        throw new Error(
          uploaded.error ||
          '파일 업로드 실패'
        )
      }

      const linkResponse =
        await apiFetch(
          `${API_URL}/api/service-requests/${selectedService.id}/files`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              fileId:
                uploaded.id,
              kind:
                serviceAttachmentKind,
            }),
          }
        )

      const linked =
        await linkResponse.json()

      if (!linkResponse.ok) {
        throw new Error(
          linked.error ||
          'A/S 파일 연결 실패'
        )
      }

      setServiceAttachmentFile(null)

      const input =
        document.getElementById(
          'service-attachment-input'
        )

      if (input) {
        input.value = ''
      }

      await refreshServiceDetail()
    } catch (error) {
      console.error(error)

      alert(
        `첨부파일을 저장하지 못했습니다.\n${error.message}`
      )
    }
  }

  const deleteServiceAttachment = async (linkId) => {
    if (
      !window.confirm(
        'A/S에서 이 첨부파일 연결을 해제할까요?'
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/service-files/${linkId}`,
          {
            method: 'DELETE',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '첨부 삭제 실패'
        )
      }

      await refreshServiceDetail()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const toggleServiceChecklist = async (
    item,
    checked
  ) => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/service-checklist/${item.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              checked,
              note:
                item.note || '',
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '체크리스트 수정 실패'
        )
      }

      setSelectedService((prev) => ({
        ...prev,
        checklistItems:
          (prev?.checklistItems || []).map(
            (row) =>
              row.id === data.id
                ? data
                : row
          ),
      }))
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const addServiceMaterial = () => {
    const firstItem =
      inventoryItems.find(
        (item) =>
          item.isActive !== false &&
          !serviceCompleteForm.materials.some(
            (material) =>
              material.itemId ===
              item.id
          )
      )

    if (!firstItem) {
      alert('추가할 수 있는 재고 품목이 없습니다.')
      return
    }

    setServiceCompleteForm((prev) => ({
      ...prev,
      materials: [
        ...prev.materials,
        {
          itemId:
            firstItem.id,
          quantity: 1,
          usageType: 'AS교체',
        },
      ],
    }))
  }

  const updateServiceMaterial = (
    index,
    field,
    value
  ) => {
    setServiceCompleteForm((prev) => ({
      ...prev,
      materials:
        prev.materials.map(
          (material, rowIndex) =>
            rowIndex === index
              ? {
                  ...material,
                  [field]:
                    field === 'itemId' ||
                    field === 'quantity'
                      ? Number(value)
                      : value,
                }
              : material
        ),
    }))
  }

  const removeServiceMaterial = (index) => {
    setServiceCompleteForm((prev) => ({
      ...prev,
      materials:
        prev.materials.filter(
          (_, rowIndex) =>
            rowIndex !== index
        ),
    }))
  }

  const completeServiceRequest = async () => {
    if (!selectedService) {
      return
    }

    if (!serviceCompleteForm.resolution.trim()) {
      alert('처리 내용을 입력해주세요.')
      return
    }

    if (!isOnline) {
      saveServiceOfflineDraft()
      alert(
        '현재 오프라인이라 완료 처리는 서버에 전송할 수 없습니다.\n작업 내용은 임시저장했습니다.'
      )
      return
    }

    const uncheckedRequired =
      (
        selectedService.checklistItems ||
        []
      ).filter(
        (item) =>
          item.required &&
          !item.checked
      )

    if (
      uncheckedRequired.length &&
      !window.confirm(
        `필수 체크리스트 ${uncheckedRequired.length}개가 아직 완료되지 않았습니다.\n그래도 A/S 완료 처리할까요?`
      )
    ) {
      return
    }

    if (
      !window.confirm(
        'A/S를 완료 처리할까요?\n\n사용 자재는 재고에서 자동 차감되고 업무일지가 자동 생성됩니다.'
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/service-requests/${selectedService.id}/complete`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(
              serviceCompleteForm
            ),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'A/S 완료 처리 실패'
        )
      }

      clearServiceOfflineDraft(
        selectedService.id
      )

      await loadServiceDetail(
        selectedService.id
      )

      await loadServiceRequests()
      await loadInventory()

      alert(
        'A/S 완료 → 업무일지 생성 → 사용 자재 재고 차감까지 반영되었습니다.'
      )
    } catch (error) {
      console.error(error)

      alert(
        `A/S 완료 처리에 실패했습니다.\n${error.message}`
      )
    }
  }

  const loadAssets = async () => {
    try {
      const params =
        new URLSearchParams()

      if (assetSiteFilter) {
        params.set(
          'siteId',
          assetSiteFilter
        )
      }

      if (assetSearch.trim()) {
        params.set(
          'q',
          assetSearch.trim()
        )
      }

      const query =
        params.toString()

      const response =
        await apiFetch(
          `${API_URL}/api/assets${query ? `?${query}` : ''}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '장비대장 조회 실패'
        )
      }

      setAssets(data)
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'assets'
    ) {
      loadAssets()
    }
  }, [
    isLoggedIn,
    page,
    assetSiteFilter,
  ])

  const saveAsset = async (e) => {
    e.preventDefault()

    try {
      const response =
        await apiFetch(
          editingAssetId
            ? `${API_URL}/api/assets/${editingAssetId}`
            : `${API_URL}/api/assets`,
          {
            method:
              editingAssetId
                ? 'PUT'
                : 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              ...assetForm,
              siteId:
                Number(
                  assetForm.siteId
                ),
              quantity:
                Number(
                  assetForm.quantity
                ) || 1,
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '장비 저장 실패'
        )
      }

      setAssetForm(
        emptyAssetForm()
      )
      setEditingAssetId(null)
      setAssetFormOpen(false)
      await loadAssets()
      await loadSites()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const editAsset = (asset) => {
    setEditingAssetId(asset.id)

    setAssetForm({
      siteId:
        String(asset.siteId),
      assetType:
        asset.assetType || '',
      model:
        asset.model || '',
      serialNumber:
        asset.serialNumber || '',
      quantity:
        asset.quantity || 1,
      installedAt:
        asset.installedAt
          ? asset.installedAt.slice(0, 10)
          : '',
      status:
        asset.status || '사용중',
      location:
        asset.location || '',
      memo:
        asset.memo || '',
    })

    setAssetFormOpen(true)
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const deleteAsset = async (asset) => {
    if (
      !window.confirm(
        `${asset.assetCode} 장비를 삭제할까요?`
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/assets/${asset.id}`,
          {
            method: 'DELETE',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '장비 삭제 실패'
        )
      }

      await loadAssets()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const loadChecklistTemplates = async () => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/checklist-templates`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '체크리스트 템플릿 조회 실패'
        )
      }

      setChecklistTemplates(data)
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'checklist-templates'
    ) {
      loadChecklistTemplates()
    }
  }, [
    isLoggedIn,
    page,
  ])

  const saveChecklistTemplate = async (e) => {
    e.preventDefault()

    const items =
      checklistTemplateForm.itemsText
        .split('\n')
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean)

    if (
      !checklistTemplateForm.name.trim() ||
      !items.length
    ) {
      alert(
        '템플릿 이름과 체크 항목을 입력해주세요.'
      )
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/checklist-templates`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              name:
                checklistTemplateForm.name,
              workType:
                checklistTemplateForm.workType,
              items,
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '템플릿 저장 실패'
        )
      }

      setChecklistTemplateForm({
        name: '',
        workType: 'SERVICE',
        itemsText: '',
      })

      await loadChecklistTemplates()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const deleteChecklistTemplate = async (template) => {
    if (
      !window.confirm(
        `"${template.name}" 템플릿을 사용 중지할까요?\n기존 작업에 이미 복사된 체크리스트는 유지됩니다.`
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/checklist-templates/${template.id}`,
          {
            method: 'DELETE',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '템플릿 삭제 실패'
        )
      }

      await loadChecklistTemplates()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const openInstallChecklist = async (site) => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/sites/${site.id}/install-checklist`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '설치 체크리스트 조회 실패'
        )
      }

      setInstallChecklistSite(site)
      setInstallChecklistItems(data)
      setPage('install-checklist')
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const toggleInstallChecklist = async (
    item,
    checked
  ) => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/site-checklist/${item.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              checked,
              note:
                item.note || '',
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '설치 체크리스트 수정 실패'
        )
      }

      setInstallChecklistItems(
        (prev) =>
          prev.map(
            (row) =>
              row.id === data.id
                ? data
                : row
          )
      )
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const loadDispatch = async () => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/dispatch?date=${dispatchDate}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '배차 조회 실패'
        )
      }

      setDispatchData(data)
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'dispatch'
    ) {
      loadDispatch()
    }
  }, [
    isLoggedIn,
    page,
    dispatchDate,
  ])

  const loadAlerts = async (
    silent = false
  ) => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/alerts`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '알림 조회 실패'
        )
      }

      setAlertsData({
        generatedAt:
          data.generatedAt || '',
        unreadCount:
          Number(
            data.unreadCount || 0
          ),
        alerts:
          data.alerts || [],
      })
    } catch (error) {
      console.error(error)

      if (!silent) {
        alert(error.message)
      }
    }
  }

  useEffect(() => {
    if (!isLoggedIn) {
      return
    }

    loadAlerts(true)

    const timer =
      window.setInterval(
        () => {
          loadAlerts(true)
        },
        10000
      )

    return () => {
      window.clearInterval(
        timer
      )
    }
  }, [
    isLoggedIn,
    currentUser?.id,
  ])

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'alerts'
    ) {
      loadAlerts(true)
    }
  }, [
    isLoggedIn,
    page,
  ])

  const markAlertRead = async (
    notificationId
  ) => {
    if (!notificationId) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/alerts/${notificationId}/read`,
          {
            method: 'POST',
          }
        )

      if (!response.ok) {
        return
      }

      setAlertsData((prev) => ({
        ...prev,
        unreadCount:
          Math.max(
            0,
            Number(
              prev.unreadCount || 0
            ) - 1
          ),
        alerts:
          prev.alerts.map(
            (row) =>
              row.notificationId ===
              notificationId
                ? {
                    ...row,
                    isRead: true,
                  }
                : row
          ),
      }))
    } catch (error) {
      console.error(error)
    }
  }

  const markAllAlertsRead = async () => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/alerts/read-all`,
          {
            method: 'POST',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '전체 읽음 처리 실패'
        )
      }

      await loadAlerts(true)
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const openAlertTarget = async (alert) => {
    if (
      alert.notificationId &&
      alert.isRead === false
    ) {
      await markAlertRead(
        alert.notificationId
      )
    }

    if (alert.type === 'AS_INTAKE') {
      setAsRecentSearch(
        String(
          alert.targetId || ''
        )
      )
      setPage('as-center')
      return
    }

    if (alert.type === 'SERVICE') {
      await loadServiceDetail(
        alert.targetId
      )
      return
    }

    if (alert.type === 'INVENTORY') {
      setPage('inventory')
      return
    }

    if (alert.type === 'INSTALL') {
      const site =
        sites.find(
          (row) =>
            row.id ===
            alert.targetId
        )

      if (site) {
        openInstallChecklist(site)
      } else {
        setPage('installations')
      }
      return
    }

    if (alert.type === 'LEAVE') {
      setPage('leave')
    }
  }

  const loadKpi = async () => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/kpi?from=${kpiFrom}&to=${kpiTo}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '통계 조회 실패'
        )
      }

      setKpiData(data)
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'kpi'
    ) {
      loadKpi()
    }
  }, [
    isLoggedIn,
    page,
  ])

  const lookupQrCode = async (
    rawCode = qrCodeInput
  ) => {
    const code =
      String(rawCode || '').trim()

    if (!code) {
      alert('QR 또는 장비 코드를 입력해주세요.')
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/lookup-code?code=${encodeURIComponent(
            code
          )}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '코드 조회 실패'
        )
      }

      setQrCodeInput(code)
      setQrLookup(data)
    } catch (error) {
      console.error(error)
      setQrLookup(null)
      alert(error.message)
    }
  }

  const stopQrScanner = () => {
    if (qrScanFrameRef.current) {
      cancelAnimationFrame(
        qrScanFrameRef.current
      )
      qrScanFrameRef.current = null
    }

    if (qrStreamRef.current) {
      qrStreamRef.current
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        )

      qrStreamRef.current = null
    }

    setQrScanning(false)
  }

  const startQrScanner = async () => {
    if (
      !('BarcodeDetector' in window)
    ) {
      alert(
        '이 브라우저는 카메라 QR 인식을 지원하지 않습니다.\n아래 코드 입력창을 이용해주세요.'
      )
      return
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode:
              'environment',
          },
          audio: false,
        })

      qrStreamRef.current =
        stream

      setQrScanning(true)

      setTimeout(
        async () => {
          const video =
            qrVideoRef.current

          if (!video) {
            stopQrScanner()
            return
          }

          video.srcObject =
            stream

          await video.play()

          const detector =
            new window.BarcodeDetector({
              formats: [
                'qr_code',
              ],
            })

          const scan = async () => {
            try {
              const codes =
                await detector.detect(
                  video
                )

              if (
                codes.length &&
                codes[0].rawValue
              ) {
                const value =
                  codes[0].rawValue

                stopQrScanner()
                setQrCodeInput(value)
                await lookupQrCode(
                  value
                )
                return
              }
            } catch (error) {
              console.error(error)
            }

            qrScanFrameRef.current =
              requestAnimationFrame(
                scan
              )
          }

          scan()
        },
        100
      )
    } catch (error) {
      console.error(error)
      stopQrScanner()

      alert(
        '카메라를 열지 못했습니다. 카메라 권한을 확인해주세요.'
      )
    }
  }

  useEffect(() => {
    return () => {
      stopQrScanner()
    }
  }, [])

  const loadAsCenter = async () => {
    try {
      setAsCenterLoading(true)

      const response =
        await apiFetch(
          `${API_URL}/api/as-center?date=${localDateString()}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'A/S 접수센터 조회 실패'
        )
      }

      setAsCenterData(data)
      if (data.operatingSetting) {
        setAsOperatingSetting(data.operatingSetting)
      }
    } catch (error) {
      console.error(error)

      alert(
        `A/S 접수센터를 불러오지 못했습니다.\n${error.message}`
      )
    } finally {
      setAsCenterLoading(false)
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'as-center' &&
      (
        currentUser?.role === 'MASTER' ||
        currentUser?.department === 'AS팀'
      )
    ) {
      loadAsCenter()
    }
  }, [
    isLoggedIn,
    page,
    currentUser?.role,
    currentUser?.department,
  ])

  useEffect(() => {
    if (
      !isLoggedIn ||
      page !== 'as-center' ||
      !(
        currentUser?.role === 'MASTER' ||
        currentUser?.department === 'AS팀'
      )
    ) return

    const timer = window.setInterval(loadAsCenter, 10000)
    return () => window.clearInterval(timer)
  }, [isLoggedIn, page, currentUser?.role, currentUser?.department])

  const saveAsOperatingSetting = async () => {
    try {
      const response = await apiFetch(`${API_URL}/api/as-operating-setting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asOperatingSetting),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '운영 설정 저장 실패')
      setAsOperatingSetting(data)
      await loadAsCenter()
      alert('A/S 업무시간과 휴무일을 저장했습니다.')
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const acknowledgeAsRequest = async (row) => {
    try {
      const response = await apiFetch(`${API_URL}/api/as-center/${row.id}/acknowledge`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '접수 확인 실패')
      await loadAsCenter()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const applyAsSiteSuggestion = () => {
    const name =
      asIntakeForm.siteName
        .trim()

    if (!name) return

    const site =
      sites.find(
        (row) =>
          row.name.trim() ===
          name
      )

    if (!site) return

    setAsIntakeForm((prev) => ({
      ...prev,
      siteName:
        site.name,
      customerName:
        prev.customerName ||
        site.customer ||
        '',
      contact:
        prev.contact ||
        site.customerPhone ||
        '',
    }))
  }

  const selectAsRequestType = (requestType) => {
    setAsIntakeForm((prev) => ({
      ...prev,
      requestType,
      visitDate:
        requestType === '방문A/S'
          ? prev.visitDate
          : '',
    }))
  }

  const saveAsIntake = async (e) => {
    e.preventDefault()

    if (
      !asIntakeForm.siteName.trim()
    ) {
      alert('현장명을 입력해주세요.')
      return
    }

    if (
      !asIntakeForm.requestContent.trim()
    ) {
      alert('문의/증상 내용을 입력해주세요.')
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/as-center/intake`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(
              asIntakeForm
            ),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'A/S 접수 실패'
        )
      }

      setLastAsIntakeResult(data)

      setAsIntakeForm({
        ...emptyAsIntakeForm(),
        requestType:
          asIntakeForm.requestType,
        intakeChannel:
          asIntakeForm.intakeChannel,
      })

      await loadSites()
      await loadAsCenter()
      await loadAlerts(true)

      if (
        data.handedOffToCs
      ) {
        alert(
          `방문 A/S가 접수되었습니다.\n접수번호 #${data.request.id}\nCS팀 A/S 관리에도 자동 등록되었습니다.`
        )
      } else {
        alert(
          `${data.request.requestType} 접수가 완료되었습니다.\n접수번호 #${data.request.id}`
        )
      }
    } catch (error) {
      console.error(error)

      alert(
        `A/S 접수에 실패했습니다.\n${error.message}`
      )
    }
  }

  const loadAsProcessDetail = async (
    rowOrId
  ) => {
    try {
      setAsProcessLoading(true)

      const id =
        typeof rowOrId === 'object'
          ? rowOrId.id
          : Number(rowOrId)

      const response =
        await apiFetch(
          `${API_URL}/api/as-center/${id}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'A/S 처리 상세 조회 실패'
        )
      }

      setSelectedAsCase(data)
      setAsProcessResolution(
        data.resolution || ''
      )
      setAsProcessNote('')
      setAsConvertVisitDate(
        data.visitDate
          ? data.visitDate.slice(0, 10)
          : ''
      )
      setAsConvertReason('')
      setPage('as-process')
    } catch (error) {
      console.error(error)

      alert(
        `A/S 처리 정보를 불러오지 못했습니다.\n${error.message}`
      )
    } finally {
      setAsProcessLoading(false)
    }
  }

  const refreshAsProcessDetail = async () => {
    if (!selectedAsCase?.id) {
      return
    }

    const response =
      await apiFetch(
        `${API_URL}/api/as-center/${selectedAsCase.id}`
      )

    const data =
      await response.json()

    if (!response.ok) {
      throw new Error(
        data.error ||
        'A/S 처리 상세 조회 실패'
      )
    }

    setSelectedAsCase(data)
    setAsProcessResolution(
      data.resolution || ''
    )
  }

  const startAsProcess = async () => {
    if (!selectedAsCase) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/as-center/${selectedAsCase.id}/start`,
          {
            method: 'POST',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '처리 시작 실패'
        )
      }

      await refreshAsProcessDetail()
      await loadAsCenter()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const holdAsProcess = async () => {
    if (!selectedAsCase) {
      return
    }

    const reason =
      window.prompt(
        '보류 사유를 입력하세요.',
        asProcessNote
      )

    if (reason === null) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/as-center/${selectedAsCase.id}/hold`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              reason:
                reason.trim(),
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '보류 처리 실패'
        )
      }

      await refreshAsProcessDetail()
      await loadAsCenter()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const addAsProcessNote = async () => {
    if (
      !selectedAsCase ||
      !asProcessNote.trim()
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/service-requests/${selectedAsCase.id}/activities`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              title:
                'A/S팀 처리 메모',
              content:
                asProcessNote.trim(),
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '메모 저장 실패'
        )
      }

      setAsProcessNote('')
      await refreshAsProcessDetail()
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const completeAsProcess = async () => {
    if (
      !selectedAsCase ||
      !asProcessResolution.trim()
    ) {
      alert('처리 결과를 입력해주세요.')
      return
    }

    if (
      !window.confirm(
        `${selectedAsCase.requestType} 처리를 완료할까요?`
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/as-center/${selectedAsCase.id}/complete`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              resolution:
                asProcessResolution.trim(),
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '완료 처리 실패'
        )
      }

      await refreshAsProcessDetail()
      await loadAsCenter()
      await loadAlerts(true)

      alert(
        `${selectedAsCase.requestType} 처리가 완료되었습니다.`
      )
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const convertAsProcess = async (
    targetType
  ) => {
    if (!selectedAsCase) {
      return
    }

    if (
      targetType === '방문A/S' &&
      !window.confirm(
        `이 접수를 방문 A/S로 전환할까요?\n\n전환하면 CS팀 A/S 관리와 알림센터에 즉시 전달됩니다.`
      )
    ) {
      return
    }

    if (
      targetType === '원격A/S' &&
      !window.confirm(
        '상담 접수를 원격 A/S로 전환할까요?'
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/as-center/${selectedAsCase.id}/convert`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              targetType,
              visitDate:
                targetType === '방문A/S'
                  ? asConvertVisitDate
                  : '',
              reason:
                asConvertReason.trim(),
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '유형 전환 실패'
        )
      }

      await loadAsCenter()
      await loadAlerts(true)

      if (
        data.handedOffToCs
      ) {
        alert(
          '방문 A/S로 전환되었습니다.\nCS팀 A/S 관리와 알림센터에 전달되었습니다.'
        )

        setPage('as-center')
        setSelectedAsCase(null)
      } else {
        await loadAsProcessDetail(
          selectedAsCase.id
        )

        alert(
          '원격 A/S로 전환되었습니다.'
        )
      }
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const filteredAsRecent =
    (asCenterData.recent || [])
      .filter((row) => {
        if (
          asRecentStatusFilter ===
            '미처리' &&
          row.status ===
            '완료'
        ) {
          return false
        }

        if (
          asRecentStatusFilter ===
            '완료' &&
          row.status !==
            '완료'
        ) {
          return false
        }

        if (
          asRecentTypeFilter !==
            '전체' &&
          row.requestType !==
            asRecentTypeFilter
        ) {
          return false
        }

        const q =
          asRecentSearch
            .trim()
            .toLowerCase()

        if (!q) {
          return true
        }

        return [
          row.id,
          row.site?.name,
          row.customerName,
          row.contact,
          row.requestContent,
          row.requestType,
          row.intakeChannel,
          row.createdBy?.name,
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(q)
        )
      })

  const remoteAsLiveRows = [...remoteServiceRequests]
    .sort((a, b) => {
      const aDone = a.status === '완료' ? 1 : 0
      const bDone = b.status === '완료' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      const aUrgent = a.priority === '긴급' ? 0 : 1
      const bUrgent = b.priority === '긴급' ? 0 : 1
      if (aUrgent !== bUrgent) return aUrgent - bUrgent
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
    .slice(0, page === 'remote-as' ? remoteServiceRequests.length : 15)

  const duplicateAsCandidates =
    (asCenterData.recent || [])
      .filter((row) => {
        const sameSite =
          asIntakeForm.siteName.trim() &&
          row.site?.name ===
            asIntakeForm.siteName.trim()

        const samePhone =
          asIntakeForm.contact.trim() &&
          row.contact ===
            asIntakeForm.contact.trim()

        return (
          row.status !== '완료' &&
          (sameSite || samePhone)
        )
      })
      .slice(0, 3)

  const loadTeamMembers = async () => {
    try {
      const response =
        await apiFetch(
          `${API_URL}/api/team-members`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '담당자 조회 실패'
        )
      }

      setTeamMembers(data)
    } catch (error) {
      console.error(error)
      alert(
        `담당자 목록을 불러오지 못했습니다.\n${error.message}`
      )
    }
  }

  const loadServiceRequests = async (forDashboard = false) => {
    try {
      const params =
        new URLSearchParams()

      if (
        !forDashboard &&
        serviceStatusFilter !== '전체'
      ) {
        params.set(
          'status',
          serviceStatusFilter
        )
      }

      if (!forDashboard && serviceSearch.trim()) {
        params.set(
          'q',
          serviceSearch.trim()
        )
      }

      params.set(
        'requestType',
        '방문A/S'
      )

      const query =
        params.toString()

      const response =
        await apiFetch(
          `${API_URL}/api/service-requests${query ? `?${query}` : ''}`
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'A/S 현황 조회 실패'
        )
      }

      setServiceRequests(data)
    } catch (error) {
      console.error(error)
      alert(
        `A/S 현황을 불러오지 못했습니다.\n${error.message}`
      )
    }
  }

  const loadRemoteServiceRequests = async () => {
    try {
      const response = await apiFetch(
        `${API_URL}/api/service-requests?requestType=${encodeURIComponent('원격A/S')}`
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '원격 A/S 현황 조회 실패')
      setRemoteServiceRequests(data)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return

    if (page === 'service') {
      loadServiceRequests()
      loadTeamMembers()
    }

    if (page === 'dashboard') {
      loadServiceRequests(true)
      loadRemoteServiceRequests()
    }

    if (page === 'remote-as') loadRemoteServiceRequests()

    if (page === 'installations') {
      loadTeamMembers()
    }
  }, [
    isLoggedIn,
    page,
    serviceStatusFilter,
  ])

  useEffect(() => {
    if (!isLoggedIn || !['dashboard', 'remote-as'].includes(page)) return
    const timer = window.setInterval(
      () => {
        if (page === 'dashboard') loadServiceRequests(true)
        loadRemoteServiceRequests()
      },
      10000
    )
    return () => window.clearInterval(timer)
  }, [isLoggedIn, page])

  const toggleServiceAssignee = (userId) => {
    setServiceForm((prev) => ({
      ...prev,
      assigneeIds:
        prev.assigneeIds.includes(userId)
          ? prev.assigneeIds.filter(
              (id) => id !== userId
            )
          : [
              ...prev.assigneeIds,
              userId,
            ],
    }))
  }

  const saveServiceRequest = async (e) => {
    e.preventDefault()

    try {
      const url =
        editingServiceId
          ? `${API_URL}/api/service-requests/${editingServiceId}`
          : `${API_URL}/api/service-requests`

      const response =
        await apiFetch(
          url,
          {
            method:
              editingServiceId
                ? 'PUT'
                : 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              ...serviceForm,
              siteId:
                Number(serviceForm.siteId),
              billingAmount:
                serviceForm.billingType === '유상'
                  ? Number(
                      serviceForm.billingAmount
                    ) || 0
                  : 0,
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'A/S 저장 실패'
        )
      }

      setEditingServiceId(null)
      setServiceForm(
        emptyServiceForm()
      )
      setServiceFormOpen(false)
      await loadServiceRequests()
    } catch (error) {
      console.error(error)
      alert(
        `A/S 건을 저장하지 못했습니다.\n${error.message}`
      )
    }
  }

  const editServiceRequest = (row) => {
    setEditingServiceId(row.id)

    setServiceForm({
      siteId:
        String(row.siteId),
      receivedDate:
        row.receivedDate
          ? row.receivedDate.slice(0, 10)
          : localDateString(),
      visitDate:
        row.visitDate
          ? row.visitDate.slice(0, 10)
          : '',
      requestType:
        row.requestType || '방문A/S',
      intakeChannel:
        row.intakeChannel || '직접등록',
      customerName:
        row.customerName || '',
      priority:
        row.priority || '일반',
      requestContent:
        row.requestContent || '',
      resolution:
        row.resolution || '',
      contact:
        row.contact || '',
      assigneeIds:
        (row.assignees || []).map(
          (item) => item.userId
        ),
      billingType:
        row.billingType || '무상',
      billingAmount:
        row.billingAmount || 0,
      status:
        row.status || '접수',
      memo:
        row.memo || '',
    })

    setServiceFormOpen(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const deleteServiceRequest = async (row) => {
    if (
      !window.confirm(
        `"${row.site?.name || 'A/S'}" 건을 삭제할까요?`
      )
    ) {
      return
    }

    try {
      const response =
        await apiFetch(
          `${API_URL}/api/service-requests/${row.id}`,
          {
            method: 'DELETE',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          'A/S 삭제 실패'
        )
      }

      await loadServiceRequests()
    } catch (error) {
      console.error(error)
      alert(
        `A/S 건을 삭제하지 못했습니다.\n${error.message}`
      )
    }
  }

  const openNewServiceRequest = () => {
    setEditingServiceId(null)
    setServiceForm(
      emptyServiceForm()
    )
    setServiceFormOpen(true)
  }

  const openRemoteAsRequest = () => {
    setEditingServiceId(null)
    setServiceForm({
      ...emptyServiceForm(),
      requestType: '원격A/S',
      intakeChannel: '직접등록',
      visitDate: '',
    })
    setServiceFormOpen(true)
    setPage('service')
  }

  const formatWon = (value) =>
    `${Number(value || 0).toLocaleString('ko-KR')}원`

  const getServiceStatusStyle = (status) => {
    if (status === '완료') {
      return {
        background: '#e8f7ef',
        color: '#16794c',
      }
    }

    if (status === '방문 예정') {
      return {
        background: '#eaf2ff',
        color: '#2667d8',
      }
    }

    if (status === '처리 중') {
      return {
        background: '#fff5db',
        color: '#9a6700',
      }
    }

    if (status === '보류') {
      return {
        background: '#f3f4f6',
        color: '#596273',
      }
    }

    return {
      background: '#fff0f0',
      color: '#c33c3c',
    }
  }

  const loadInventory = async () => {
    try {
      const [
        itemsResponse,
        transactionsResponse,
      ] =
        await Promise.all([
          apiFetch(
            `${API_URL}/api/inventory/items`
          ),
          apiFetch(
            `${API_URL}/api/inventory/transactions`
          ),
        ])

      const itemsData =
        await itemsResponse.json()

      const transactionsData =
        await transactionsResponse.json()

      if (!itemsResponse.ok) {
        throw new Error(
          itemsData.error ||
          '재고 품목 조회 실패'
        )
      }

      if (!transactionsResponse.ok) {
        throw new Error(
          transactionsData.error ||
          '재고 이력 조회 실패'
        )
      }

      setInventoryItems(itemsData)
      setInventoryTransactions(
        transactionsData
      )
    } catch (error) {
      console.error(error)
      alert(
        `재고 정보를 불러오지 못했습니다.\n${error.message}`
      )
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      ['inventory', 'worklogs'].includes(page)
    ) {
      loadInventory()
    }
  }, [isLoggedIn, page])

  const createInventoryItem = async (e) => {
    e.preventDefault()

    try {
      const response = await apiFetch(
        `${API_URL}/api/inventory/items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            inventoryForm
          ),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '품목 등록 실패'
        )
      }

      setInventoryForm({
        code: '',
        name: '',
        category: '기타',
        unit: '개',
        initialStock: 0,
        minStock: 0,
        location: '',
        memo: '',
      })
      setInventoryFormOpen(false)
      await loadInventory()
    } catch (error) {
      console.error(error)
      alert(
        `품목을 등록하지 못했습니다.\n${error.message}`
      )
    }
  }

  const moveInventory = async (item, type) => {
    const label =
      type === 'IN'
        ? '입고'
        : '출고'

    const quantityText =
      window.prompt(
        `${item.name} ${label} 수량을 입력하세요.`,
        '1'
      )

    if (quantityText === null) return

    const quantity =
      Number(quantityText)

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      alert(
        '수량은 1 이상의 정수로 입력해주세요.'
      )
      return
    }

    const reason =
      window.prompt(
        `${label} 사유를 입력하세요.`,
        type === 'IN'
          ? '신규 구매 입고'
          : '수동 출고'
      )

    if (reason === null) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/inventory/items/${item.id}/move`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            quantity,
            reason,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '재고 처리 실패'
        )
      }

      await loadInventory()
    } catch (error) {
      console.error(error)
      alert(
        `재고를 처리하지 못했습니다.\n${error.message}`
      )
    }
  }

  const editInventoryItem = async (item) => {
    const minStockText =
      window.prompt(
        `${item.name} 최소 재고 수량`,
        String(item.minStock ?? 0)
      )

    if (minStockText === null) return

    const location =
      window.prompt(
        `${item.name} 보관 위치`,
        item.location || ''
      )

    if (location === null) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/inventory/items/${item.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            minStock:
              Number(minStockText) || 0,
            location,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          '품목 수정 실패'
        )
      }

      await loadInventory()
    } catch (error) {
      console.error(error)
      alert(
        `품목을 수정하지 못했습니다.\n${error.message}`
      )
    }
  }

  const addWorkLogMaterial = () => {
    if (!inventoryItems.length) {
      alert(
        '먼저 재고 관리에서 품목을 등록해주세요.'
      )
      return
    }

    const usedIds =
      new Set(
        workLogForm.materials.map(
          (row) => row.itemId
        )
      )

    const firstAvailable =
      inventoryItems.find(
        (item) =>
          !usedIds.has(item.id)
      )

    if (!firstAvailable) {
      alert(
        '추가할 수 있는 재고 품목이 없습니다.'
      )
      return
    }

    setWorkLogForm({
      ...workLogForm,
      materials: [
        ...workLogForm.materials,
        {
          itemId:
            firstAvailable.id,
          quantity: 1,
          usageType:
            'AS교체',
        },
      ],
    })
  }

  const updateWorkLogMaterial = (
    index,
    key,
    value
  ) => {
    setWorkLogForm((prev) => ({
      ...prev,
      materials:
        prev.materials.map(
          (row, rowIndex) =>
            rowIndex === index
              ? {
                  ...row,
                  [key]:
                    key === 'itemId' ||
                    key === 'quantity'
                      ? Number(value)
                      : value,
                }
              : row
        ),
    }))
  }

  const removeWorkLogMaterial = (index) => {
    setWorkLogForm((prev) => ({
      ...prev,
      materials:
        prev.materials.filter(
          (_, rowIndex) =>
            rowIndex !== index
        ),
    }))
  }

  const loadWorkLogs = async () => {
    try {
      const response = await apiFetch(
        `${API_URL}/api/worklogs?limit=100`
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '업무일지 조회 실패')
      }

      setWorkLogs(await response.json())
    } catch (error) {
      console.error(error)
      alert(`업무일지를 불러오지 못했습니다.\n${error.message}`)
    }
  }

  useEffect(() => {
    if (isLoggedIn && page === 'worklogs') {
      loadWorkLogs()
      setWorkLogServicesError('')
      apiFetch(`${API_URL}/api/service-requests`)
        .then(async (response) => {
          if (!response.ok) throw new Error('A/S 접수 목록을 불러오지 못했습니다. 다시 업무일지 메뉴를 열어주세요.')
          setWorkLogServices(await response.json())
        })
        .catch((error) => setWorkLogServicesError(error.message))
    }
  }, [isLoggedIn, page])

  const toggleWorkLogSite = (siteId) => {
    setWorkLogForm((prev) => {
      const exists = prev.siteIds.includes(siteId)

      return {
        ...prev,
        siteIds: exists
          ? prev.siteIds.filter((id) => id !== siteId)
          : [...prev.siteIds, siteId],
      }
    })
  }

  const resetWorkLogForm = () => {
    setEditingWorkLogId(null)
    setWorkLogForm(emptyWorkLogForm())
    setWorkLogFormOpen(false)
  }

  const saveWorkLog = async (e) => {
    e.preventDefault()

    try {
      const response = await apiFetch(
        editingWorkLogId
          ? `${API_URL}/api/worklogs/${editingWorkLogId}`
          : `${API_URL}/api/worklogs`,
        {
          method: editingWorkLogId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(workLogForm),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '업무일지 저장 실패')
      }

      resetWorkLogForm()
      await loadWorkLogs()
      await loadTodayTeamWork()
      await loadInventory()
    } catch (error) {
      console.error(error)
      alert(`업무일지를 저장하지 못했습니다.\n${error.message}`)
    }
  }

  const editWorkLog = (log) => {
    setEditingWorkLogId(log.id)
    setWorkLogFormOpen(true)
    setWorkLogForm({
      workEntries: Array.isArray(log.extraData?.workEntries) ? log.extraData.workEntries : [],
      workDate: log.workDate?.slice(0, 10) || localDateString(),
      title: log.title || '',
      completedWork: log.completedWork || '',
      pendingWork: log.pendingWork || '',
      nextPlan: log.nextPlan || '',
      issues: log.issues || '',
      handover: log.handover || '',
      memo: log.memo || '',
      status: log.status || 'SUBMITTED',
      isImportant: Boolean(log.isImportant),
      siteIds: (log.sites || []).map((item) => item.siteId),
      materials: (log.materials || []).map((row) => ({
        itemId: row.itemId,
        quantity: row.quantity,
        usageType: row.usageType || 'AS교체',
      })),
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const deleteWorkLog = async (log) => {
    const confirmed = window.confirm(
      `${log.author?.name || '작성자'}의 ${log.workDate?.slice(0, 10) || ''} 업무일지를 삭제할까요?`
    )

    if (!confirmed) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/worklogs/${log.id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '업무일지 삭제 실패')
      }

      await loadWorkLogs()
      await loadInventory()
      await loadTodayTeamWork()
    } catch (error) {
      console.error(error)
      alert(`업무일지를 삭제하지 못했습니다.\n${error.message}`)
    }
  }

  const addWorkLogComment = async (log) => {
    const content = window.prompt(
      `${log.author?.name || '직원'} 업무일지에 남길 댓글을 입력하세요.`
    )

    if (!content?.trim()) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/worklogs/${log.id}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '댓글 등록 실패')
      }

      await loadWorkLogs()
    } catch (error) {
      console.error(error)
      alert(`댓글을 등록하지 못했습니다.\n${error.message}`)
    }
  }

  const addManualCandidate = async (log) => {
    const defaultTitle =
      log.title ||
      `${log.workDate?.slice(0, 10) || ''} 업무 매뉴얼 후보`

    const title = window.prompt(
      '매뉴얼 후보 제목을 입력하세요.',
      defaultTitle
    )

    if (!title?.trim()) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/worklogs/${log.id}/manual-candidate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '매뉴얼 후보 등록 실패')
      }

      await loadWorkLogs()

      if (
        ['MASTER', 'ADMIN'].includes(currentUser?.role)
      ) {
        await loadManuals()
      }

      alert('매뉴얼 후보로 등록했습니다.')
    } catch (error) {
      console.error(error)
      alert(`매뉴얼 후보 등록에 실패했습니다.\n${error.message}`)
    }
  }

  useEffect(() => {
    if (isLoggedIn && page === 'leave') {
      loadLeaveData()
    }
  }, [isLoggedIn, page, leaveYear, leaveMonth])

  const registerLeave = async (e) => {
    e.preventDefault()

    try {
      const response = await apiFetch(`${API_URL}/api/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLeave),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '연차 등록 실패')
      }

      setNewLeave({
        startDate: '',
        endDate: '',
        days: '1',
        leaveType: '연차',
        reason: '',
      })

      await loadLeaveData()
      alert('연차 신청이 등록되었습니다. 나머지 직원 전원이 동의하면 캘린더에 자동 반영됩니다.')
    } catch (error) {
      console.error(error)
      alert(`연차 등록에 실패했습니다.\n${error.message}`)
    }
  }

  const cancelLeave = async (id) => {
    const confirmed = window.confirm('등록된 연차를 취소할까요?')
    if (!confirmed) return

    try {
      const response = await apiFetch(`${API_URL}/api/leave/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '연차 취소 실패')
      }

      await loadLeaveData()
    } catch (error) {
      console.error(error)
      alert(`연차 취소에 실패했습니다.\n${error.message}`)
    }
  }

  const startEditLeave = (leave) => {
    setEditingLeave({
      id: leave.id,
      startDate: leave.startDate?.slice(0, 10) || '',
      endDate: leave.endDate?.slice(0, 10) || '',
      days: String(leave.days ?? 1),
      leaveType: leave.leaveType || '연차',
      reason: leave.reason || '',
    })
  }

  const saveEditLeave = async () => {
    if (!editingLeave) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/leave/${editingLeave.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate: editingLeave.startDate,
            endDate: editingLeave.endDate,
            days: Number(editingLeave.days),
            leaveType: editingLeave.leaveType,
            reason: editingLeave.reason,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '연차 수정 실패')
      }

      setEditingLeave(null)
      await loadLeaveData()
      alert('연차가 수정되었습니다.')
    } catch (error) {
      console.error(error)
      alert(`연차 수정에 실패했습니다.\n${error.message}`)
    }
  }

  const agreeLeave = async (id) => {
    const confirmed = window.confirm('이 연차 신청에 동의할까요?')
    if (!confirmed) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/leave/${id}/agree`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '연차 동의 실패')
      }

      await loadLeaveData()

      if (data.status === 'APPROVED') {
        alert('마지막 동의가 완료되어 연차가 승인되고 캘린더에 반영되었습니다.')
      } else {
        alert('동의가 완료되었습니다.')
      }
    } catch (error) {
      console.error(error)
      alert(`연차 동의에 실패했습니다.\n${error.message}`)
    }
  }

  const getLeaveStatusText = (status) => {
    if (status === 'APPROVED') return '승인 완료'
    if (status === 'PENDING') return '동의 대기'
    if (status === 'CANCELLED') return '취소'
    return status || '-'
  }

  const getAgreementProgress = (request) => {
    const agreements = request.agreements || []
    const agreed = agreements.filter(
      (item) => item.status === 'AGREED'
    ).length

    return {
      agreed,
      total: agreements.length,
    }
  }

  const getCalendarCells = () => {
    const firstDay = new Date(leaveYear, leaveMonth - 1, 1)
    const lastDay = new Date(leaveYear, leaveMonth, 0)
    const cells = []

    for (let i = 0; i < firstDay.getDay(); i += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      cells.push(new Date(leaveYear, leaveMonth - 1, day))
    }

    return cells
  }

  const getLeavesForDate = (date) => {
    if (!date) return []

    const target = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )

    return leaveCalendar.filter((item) => {
      const start = new Date(item.startDate)
      const end = new Date(item.endDate)

      const startDay = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      )

      const endDay = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate()
      )

      return target >= startDay && target <= endDay
    })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')

    const formData = new FormData(e.currentTarget)
    const username = String(formData.get('username') || '').trim()
    const password = String(formData.get('password') || '')

    try {
      const response = await window.fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '로그인 실패')
      }

      localStorage.setItem('cs_token', data.token)

      if (rememberUsername) {
        localStorage.setItem('cs_saved_username', username)
      } else {
        localStorage.removeItem('cs_saved_username')
      }

      setAuthToken(data.token)
      setCurrentUser(data.user)
      setIsLoggedIn(true)

      if (data.asLoginBrief) {
        const { nightNew, urgent, unconfirmed } = data.asLoginBrief
        if (nightNew || urgent || unconfirmed) {
          window.alert(
            `A/S 미확인 접수 요약\n\n야간/휴무 신규 ${nightNew}건\n긴급 ${urgent}건\n전체 미확인 ${unconfirmed}건`
          )
        }
      }

      if (
        data.user?.role !== 'MASTER' &&
        data.user?.department === 'AS팀'
      ) {
        setWorkspaceMode('AS')
        setPage('as-center')
      } else {
        setWorkspaceMode('CS')
        setPage('dashboard')
      }

      setLoginForm({
        username: '',
        password: '',
      })
    } catch (error) {
      setLoginError(error.message)
    }
  }


  const handleLogout = () => {
    localStorage.removeItem('cs_token')
    setAuthToken('')
    setCurrentUser(null)
    setIsLoggedIn(false)
    setPage('dashboard')
  }

  const loadUsers = async () => {
    try {
      const response = await apiFetch(`${API_URL}/api/users`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '직원 목록 조회 실패')
      }

      setUsers(await response.json())
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  useEffect(() => {
    if (
      isLoggedIn &&
      page === 'users' &&
      ['MASTER', 'ADMIN'].includes(currentUser?.role)
    ) {
      loadUsers()
    }
  }, [isLoggedIn, page, currentUser?.role])

  const saveUser = async (e) => {
    e.preventDefault()

    try {
      const url = editingUserId
        ? `${API_URL}/api/users/${editingUserId}`
        : `${API_URL}/api/users`

      const body = editingUserId
        ? {
            name: newUser.name,
            department: newUser.department,
            position: newUser.position,
            phone: newUser.phone,
            email: newUser.email,
            role: newUser.role,
          }
        : {
            ...newUser,
            grantedDays: Number(newUser.grantedDays),
          }

      const response = await apiFetch(url, {
        method: editingUserId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '직원 저장 실패')
      }

      setUserFormMode(false)
      setEditingUserId(null)
      setNewUser({
        username: '',
        password: '',
        name: '',
        department: 'CS팀',
        position: '',
        phone: '',
        email: '',
        role: 'USER',
        grantedDays: '15',
      })

      await loadUsers()
    } catch (error) {
      alert(error.message)
    }
  }

  const editUser = (user) => {
    setEditingUserId(user.id)
    setUserFormMode(true)
    setNewUser({
      username: user.username,
      password: '',
      name: user.name || '',
      department: user.department || '',
      position: user.position || '',
      phone: user.phone || '',
      email: user.email || '',
      role: user.role || 'USER',
      grantedDays: '15',
    })
  }

  const toggleUserActive = async (user) => {
    const text = user.isActive ? '비활성화' : '활성화'

    if (!window.confirm(`${user.name} 계정을 ${text}할까요?`)) {
      return
    }

    try {
      const response = await apiFetch(
        `${API_URL}/api/users/${user.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isActive: !user.isActive,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '계정 상태 변경 실패')
      }

      await loadUsers()
    } catch (error) {
      alert(error.message)
    }
  }

  const resetUserPassword = async (user) => {
    const password = window.prompt(
      `${user.name}의 새 비밀번호를 입력하세요. (6자 이상)`
    )

    if (!password) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/users/${user.id}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '비밀번호 초기화 실패')
      }

      alert('비밀번호가 변경되었습니다.')
    } catch (error) {
      alert(error.message)
    }
  }

  const changeMyPassword = async () => {
    const currentPassword = window.prompt('현재 비밀번호를 입력하세요.')
    if (!currentPassword) return

    const newPassword = window.prompt('새 비밀번호를 입력하세요. (6자 이상)')
    if (!newPassword) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/auth/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '비밀번호 변경 실패')
      }

      alert('비밀번호가 변경되었습니다.')
    } catch (error) {
      alert(error.message)
    }
  }


  const changeSiteInput = (e) => {
    const { name, value } = e.target

    setNewSite((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const registerSite = async (e) => {
  e.preventDefault()

  try {
    const response = await apiFetch(`${API_URL}/api/sites`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        name: newSite.name,
        region: newSite.region,
        area: newSite.area,
        address: newSite.address,

        customerName: newSite.customer,
        customerPhone: newSite.customerPhone,

        installDate: newSite.installDate,
        status: newSite.status,
        equipment: newSite.equipment,
        memo: newSite.memo,

        extraData: {
          manager: newSite.manager,
          managerPhone: newSite.managerPhone,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.error || '현장 등록 실패'
      )
    }

    setNewSite({
      name: '',
      region: '',
      area: '',
      address: '',
      manager: '',
      managerPhone: '',
      customer: '',
      customerPhone: '',
      installDate: '',
      status: '설치 예정',
      equipment: '',
      memo: '',
    })

    await loadSites()

    alert('현장이 DB에 등록되었습니다.')

    setPage('sites')
  } catch (error) {
    console.error(error)

    alert(
      `현장 등록에 실패했습니다.\n${error.message}`
    )
  }
}

  const openSiteDetail = async (site) => {
  try {
    const response = await apiFetch(
      `${API_URL}/api/sites/${site.id}`
    )

    if (!response.ok) {
      throw new Error('상세 정보 조회 실패')
    }

    const data = await response.json()

    setSelectedSite(normalizeSite(data))
    setPage('site-detail')
  } catch (error) {
    console.error(error)

    alert('현장 상세 정보를 불러오지 못했습니다.')
  }
}

  const registerNotice = async (e) => {
    e.preventDefault()

    try {
      const url = editingNoticeId
        ? `${API_URL}/api/notices/${editingNoticeId}`
        : `${API_URL}/api/notices`

      const response = await apiFetch(url, {
        method: editingNoticeId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newNotice.title,
          content: newNotice.content,
          isPinned: Boolean(newNotice.isPinned),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '공지사항 저장 실패')
      }

      setNewNotice({
        title: '',
        content: '',
        isPinned: false,
      })

      setEditingNoticeId(null)
      setNoticeMode(false)
      await loadNotices()
    } catch (error) {
      console.error(error)
      alert(`공지사항 저장에 실패했습니다.\n${error.message}`)
    }
  }

  const editNotice = (notice) => {
    setEditingNoticeId(notice.id)
    setNewNotice({
      title: notice.title,
      content: notice.content,
      isPinned: Boolean(notice.isPinned),
    })
    setNoticeMode(true)
  }

  const deleteNotice = async (notice) => {
    const confirmed = window.confirm(
      `"${notice.title}" 공지사항을 삭제할까요?`
    )

    if (!confirmed) return

    try {
      const response = await apiFetch(
        `${API_URL}/api/notices/${notice.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '공지사항 삭제 실패')
      }

      await loadNotices()
    } catch (error) {
      console.error(error)
      alert(`공지사항 삭제에 실패했습니다.\n${error.message}`)
    }
  }


  const getBadgeClass = (status) => {
    if (status === '설치 완료') return 'complete'
    if (status === '설치 중') return 'progress'
    if (status === '점검 필요') return 'danger-badge'
    return 'scheduled'
  }

  const countStatus = (status) => {
    return sites.filter((site) => site.status === status).length
  }

  const dashboardToday = (weeklyWork.days || []).find(
    (day) => day.date === localDateString()
  ) || { events: [] }
  const dashboardTodayEvents = dashboardToday.events || []
  const dashboardTodayCount = (type) =>
    dashboardTodayEvents.filter((event) => event.type === type).length
  const dashboardMissingLogs = (todayTeamWork.members || []).filter(
    (member) => !member.submitted
  ).length
  const dashboardServiceRows = [...serviceRequests]
    .sort((a, b) => {
      const aDone = a.status === '완료' ? 1 : 0
      const bDone = b.status === '완료' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      const aUrgent = a.priority === '긴급' ? 0 : 1
      const bUrgent = b.priority === '긴급' ? 0 : 1
      if (aUrgent !== bUrgent) return aUrgent - bUrgent
      return new Date(b.receivedDate || b.createdAt) - new Date(a.receivedDate || a.createdAt)
    })
    .slice(0, 12)

  const remoteAsBoard = <RemoteAsBoard rows={remoteAsLiveRows} pendingCount={remoteServiceRequests.filter((row) => row.status !== '완료').length} onCreate={openRemoteAsRequest} onDetail={loadServiceDetail} formatDateTime={formatDateTime} getBadgeClass={getBadgeClass} />

  if (!isLoggedIn) {
    const loginFeatures = [
      { icon: '⌂', label: '현장 관리' },
      { icon: '≣', label: '업무일지' },
      { icon: '◇', label: '재고 관리' },
      { icon: '▤', label: '업무 매뉴얼' },
      { icon: '▱', label: '자료실' },
      { icon: '□', label: '연차 관리' },
    ]

    return (
      <div className="cs-login-shell">
        <style>{`
          .cs-login-shell {
            --login-navy: #06162f;
            --login-navy-2: #082b63;
            --login-blue: #2d7ff9;
            --login-blue-soft: #75adff;
            position: relative;
            min-height: 100vh;
            width: 100%;
            overflow: hidden;
            background:
              radial-gradient(circle at 73% 45%, rgba(34, 111, 255, 0.24), transparent 30%),
              radial-gradient(circle at 20% 8%, rgba(38, 121, 255, 0.12), transparent 24%),
              linear-gradient(135deg, #041127 0%, #061a38 45%, #072958 100%);
            color: #fff;
            font-family: Inter, Pretendard, "Noto Sans KR", Arial, sans-serif;
          }

          .cs-login-shell::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.38;
            background-image:
              radial-gradient(circle, rgba(109, 173, 255, 0.7) 1px, transparent 1.5px);
            background-size: 58px 58px;
            mask-image: linear-gradient(to bottom, rgba(0,0,0,.8), transparent 40%);
          }

          .cs-login-glow-line {
            position: absolute;
            left: -8%;
            top: 39%;
            width: 82%;
            height: 260px;
            border-top: 1px solid rgba(45, 127, 249, 0.5);
            border-radius: 50%;
            transform: rotate(-8deg);
            box-shadow:
              0 -8px 40px rgba(33, 118, 255, 0.12),
              0 -1px 0 rgba(104, 173, 255, 0.35);
            opacity: .8;
          }

          .cs-login-glow-line::before,
          .cs-login-glow-line::after {
            content: "";
            position: absolute;
            inset: 18px 0 auto 0;
            height: 100%;
            border-top: 1px solid rgba(57, 137, 255, .18);
            border-radius: 50%;
          }

          .cs-login-glow-line::after {
            inset: 38px 0 auto 0;
            opacity: .65;
          }

          .cs-login-layout {
            position: relative;
            z-index: 2;
            min-height: 100vh;
            max-width: 1440px;
            margin: 0 auto;
            padding: 58px 72px 44px;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: minmax(0, 1.35fr) minmax(360px, .65fr);
            gap: 68px;
            align-items: center;
          }

          .cs-login-brand-panel {
            position: relative;
            z-index: 3;
            align-self: center;
            padding-bottom: 38px;
          }

          .cs-login-brand {
            display: flex;
            align-items: center;
            gap: 22px;
            margin-bottom: 70px;
          }

          .cs-login-mark {
            position: relative;
            width: 74px;
            height: 84px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            clip-path: polygon(50% 0, 94% 23%, 94% 77%, 50% 100%, 6% 77%, 6% 23%);
            background: linear-gradient(145deg, #4da3ff 0%, #1767dc 45%, #0b419a 100%);
            filter: drop-shadow(0 12px 22px rgba(0, 91, 255, .24));
          }

          .cs-login-mark::before {
            content: "";
            position: absolute;
            inset: 7px;
            clip-path: inherit;
            background: #071b3a;
          }

          .cs-login-mark-core {
            position: relative;
            z-index: 2;
            width: 34px;
            height: 34px;
            display: grid;
            place-items: center;
            border-radius: 9px;
            background: linear-gradient(145deg, #ffffff, #d6e8ff);
            color: #0c4fa8;
            font-size: 14px;
            font-weight: 900;
            letter-spacing: -1px;
            transform: rotate(30deg);
            box-shadow: 0 0 24px rgba(80, 160, 255, .34);
          }

          .cs-login-mark-core span {
            transform: rotate(-30deg);
          }

          .cs-login-brand-copy h1 {
            margin: 0;
            color: #fff;
            font-size: clamp(34px, 3.4vw, 56px);
            line-height: 1;
            letter-spacing: -1.9px;
            font-weight: 800;
          }

          .cs-login-brand-copy p {
            margin: 13px 0 0;
            color: #8fc3ff;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 5px;
            text-transform: uppercase;
          }

          .cs-login-feature-row {
            display: grid;
            grid-template-columns: repeat(6, minmax(94px, 1fr));
            gap: 14px;
            max-width: 790px;
          }

          .cs-login-feature {
            min-height: 104px;
            border: 1px solid rgba(120, 179, 255, .18);
            border-radius: 16px;
            background: linear-gradient(
              180deg,
              rgba(8, 44, 91, .54),
              rgba(5, 28, 61, .68)
            );
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,.035),
              0 14px 28px rgba(0, 8, 27, .13);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: .22s ease;
            backdrop-filter: blur(7px);
          }

          .cs-login-feature:hover {
            transform: translateY(-3px);
            border-color: rgba(82, 151, 255, .52);
            background: rgba(11, 55, 112, .72);
          }

          .cs-login-feature-icon {
            width: 34px;
            height: 34px;
            display: grid;
            place-items: center;
            border-radius: 10px;
            color: #a8cfff;
            border: 1px solid rgba(132, 188, 255, .23);
            background: rgba(24, 92, 177, .14);
            font-size: 23px;
            font-weight: 400;
            line-height: 1;
          }

          .cs-login-feature span:last-child {
            color: #f4f8ff;
            font-size: 13px;
            font-weight: 650;
            letter-spacing: -.2px;
            white-space: nowrap;
          }

          .cs-login-footer {
            position: absolute;
            left: 72px;
            bottom: 34px;
            z-index: 5;
            color: rgba(205, 222, 245, .56);
            font-size: 12px;
          }

          .cs-login-card-wrap {
            position: relative;
            z-index: 6;
            display: flex;
            justify-content: flex-end;
          }

          .cs-login-card {
            width: min(100%, 430px);
            padding: 40px 36px 32px;
            box-sizing: border-box;
            border-radius: 20px;
            background: rgba(255, 255, 255, .985);
            color: #102446;
            box-shadow:
              0 34px 80px rgba(0, 10, 34, .30),
              0 0 0 1px rgba(255,255,255,.8);
          }

          .cs-login-card-head {
            margin-bottom: 30px;
            text-align: center;
          }

          .cs-login-card-head h2 {
            margin: 0;
            color: #09214a;
            font-size: 25px;
            font-weight: 800;
            letter-spacing: -.8px;
          }

          .cs-login-card-head p {
            margin: 8px 0 0;
            color: #98a7bb;
            font-size: 13px;
            font-weight: 500;
          }

          .cs-login-field {
            position: relative;
            margin-bottom: 14px;
          }

          .cs-login-field-icon {
            position: absolute;
            left: 16px;
            top: 50%;
            width: 18px;
            height: 18px;
            transform: translateY(-50%);
            color: #7c8fa8;
            pointer-events: none;
          }

          .cs-login-field input {
            width: 100%;
            height: 52px;
            box-sizing: border-box;
            border: 1px solid #dfe6ef;
            border-radius: 10px;
            padding: 0 15px 0 48px;
            outline: none;
            background: #fbfcfe;
            color: #14243d;
            font-size: 14px;
            transition: .18s ease;
          }

          .cs-login-field input::placeholder {
            color: #a7b2c1;
          }

          .cs-login-field input:focus {
            border-color: #5a98f5;
            background: #fff;
            box-shadow: 0 0 0 4px rgba(45, 127, 249, .10);
          }

          .cs-login-options {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 16px 0 22px;
          }

          .cs-login-remember {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #5f7086;
            font-size: 13px;
            cursor: pointer;
            user-select: none;
          }

          .cs-login-remember input {
            width: 16px;
            height: 16px;
            accent-color: #176fe5;
          }

          .cs-login-error {
            margin: -7px 0 16px;
            padding: 10px 12px;
            border-radius: 8px;
            background: #fff1f2;
            color: #c6283f;
            font-size: 12px;
            line-height: 1.4;
          }

          .cs-login-submit {
            width: 100%;
            height: 54px;
            border: 0;
            border-radius: 10px;
            background: linear-gradient(90deg, #0a4fc8 0%, #126ff3 100%);
            color: #fff;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 12px 28px rgba(18, 111, 243, .22);
            transition: .2s ease;
          }

          .cs-login-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 16px 32px rgba(18, 111, 243, .30);
          }

          .cs-login-submit:active {
            transform: translateY(0);
          }

          .cs-login-card-footer {
            margin: 28px 0 0;
            padding-top: 22px;
            border-top: 1px solid #edf0f4;
            color: #9aa6b5;
            text-align: center;
            font-size: 11px;
            letter-spacing: .2px;
          }

          .cs-login-city {
            position: absolute;
            z-index: 1;
            left: 43%;
            right: 19%;
            bottom: 0;
            height: 44%;
            opacity: .55;
            filter: drop-shadow(0 0 18px rgba(31, 104, 235, .28));
            pointer-events: none;
          }

          .cs-login-building {
            position: absolute;
            bottom: 0;
            width: var(--w);
            height: var(--h);
            left: var(--x);
            border: 1px solid rgba(58, 132, 245, .28);
            border-bottom: 0;
            background:
              repeating-linear-gradient(
                to bottom,
                rgba(63, 138, 249, .14) 0 3px,
                transparent 3px 14px
              ),
              linear-gradient(180deg, rgba(10, 65, 141, .72), rgba(5, 26, 59, .9));
            box-shadow: inset 0 0 30px rgba(23, 96, 210, .16);
          }

          .cs-login-building::before {
            content: "";
            position: absolute;
            left: 50%;
            top: -14px;
            width: 2px;
            height: 14px;
            background: rgba(79, 152, 255, .48);
          }

          @media (max-width: 1120px) {
            .cs-login-layout {
              grid-template-columns: 1fr minmax(340px, 420px);
              padding: 46px 42px 70px;
              gap: 34px;
            }

            .cs-login-brand {
              margin-bottom: 42px;
            }

            .cs-login-feature-row {
              grid-template-columns: repeat(3, minmax(100px, 1fr));
              max-width: 520px;
            }

            .cs-login-footer {
              left: 42px;
              bottom: 24px;
            }

            .cs-login-city {
              left: 32%;
              right: 0;
            }
          }

          @media (max-width: 820px) {
            .cs-login-shell {
              overflow: auto;
            }

            .cs-login-layout {
              min-height: 100vh;
              grid-template-columns: 1fr;
              align-content: center;
              padding: 40px 22px 80px;
            }

            .cs-login-brand-panel {
              text-align: center;
              padding-bottom: 0;
            }

            .cs-login-brand {
              justify-content: center;
              margin-bottom: 28px;
            }

            .cs-login-brand-copy {
              text-align: left;
            }

            .cs-login-brand-copy h1 {
              font-size: 34px;
            }

            .cs-login-brand-copy p {
              font-size: 11px;
              letter-spacing: 3px;
            }

            .cs-login-feature-row {
              grid-template-columns: repeat(3, 1fr);
              max-width: 520px;
              margin: 0 auto;
            }

            .cs-login-feature {
              min-height: 86px;
            }

            .cs-login-card-wrap {
              justify-content: center;
            }

            .cs-login-card {
              width: min(100%, 520px);
            }

            .cs-login-city {
              left: 0;
              right: 0;
              height: 32%;
              opacity: .22;
            }

            .cs-login-footer {
              left: 0;
              right: 0;
              bottom: 20px;
              text-align: center;
            }
          }

          @media (max-width: 520px) {
            .cs-login-layout {
              padding-left: 16px;
              padding-right: 16px;
            }

            .cs-login-mark {
              width: 58px;
              height: 66px;
            }

            .cs-login-brand {
              gap: 14px;
            }

            .cs-login-brand-copy h1 {
              font-size: 27px;
              letter-spacing: -1px;
            }

            .cs-login-brand-copy p {
              font-size: 9px;
              letter-spacing: 2px;
            }

            .cs-login-feature-row {
              gap: 8px;
            }

            .cs-login-feature {
              min-height: 76px;
              border-radius: 12px;
            }

            .cs-login-feature-icon {
              width: 28px;
              height: 28px;
              font-size: 18px;
            }

            .cs-login-feature span:last-child {
              font-size: 11px;
            }

            .cs-login-card {
              padding: 32px 22px 26px;
              border-radius: 16px;
            }
          }
        `}</style>

        <div className="cs-login-glow-line" />

        <div className="cs-login-city" aria-hidden="true">
          {[
            ['9%', '70px', '29%'],
            ['19%', '58px', '47%'],
            ['29%', '85px', '68%'],
            ['43%', '64px', '38%'],
            ['55%', '76px', '57%'],
            ['69%', '52px', '44%'],
            ['78%', '88px', '74%'],
            ['93%', '54px', '50%'],
          ].map(([x, w, h], index) => (
            <span
              key={index}
              className="cs-login-building"
              style={{
                '--x': x,
                '--w': w,
                '--h': h,
              }}
            />
          ))}
        </div>

        <main className="cs-login-layout">
          <section className="cs-login-brand-panel">
            <div className="cs-login-brand">
              <div className="cs-login-mark" aria-hidden="true">
                <div className="cs-login-mark-core">
                  <span>CS</span>
                </div>
              </div>

              <div className="cs-login-brand-copy">
                <h1>CS WORKSPACE</h1>
                <p>CS Management System</p>
              </div>
            </div>

            <div className="cs-login-feature-row">
              {loginFeatures.map((feature) => (
                <div
                  key={feature.label}
                  className="cs-login-feature"
                >
                  <span className="cs-login-feature-icon">
                    {feature.icon}
                  </span>
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="cs-login-card-wrap">
            <div className="cs-login-card">
              <div className="cs-login-card-head">
                <h2>로그인</h2>
                <p>CS 업무관리 시스템</p>
              </div>

              <form onSubmit={handleLogin}>
                <div className="cs-login-field">
                  <svg
                    className="cs-login-field-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4.5 20c.7-4.1 3.2-6.2 7.5-6.2s6.8 2.1 7.5 6.2" />
                  </svg>

                  <input
                    type="text"
                    name="username"
                    id="login-username"
                    defaultValue={
                      localStorage.getItem(
                        'cs_saved_username'
                      ) || ''
                    }
                    placeholder="아이디"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="cs-login-field">
                  <svg
                    className="cs-login-field-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <rect
                      x="5"
                      y="10"
                      width="14"
                      height="10"
                      rx="2"
                    />
                    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
                  </svg>

                  <input
                    type="password"
                    name="password"
                    id="login-password"
                    placeholder="비밀번호"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="cs-login-options">
                  <label className="cs-login-remember">
                    <input
                      type="checkbox"
                      checked={rememberUsername}
                      onChange={(e) =>
                        setRememberUsername(
                          e.target.checked
                        )
                      }
                    />
                    아이디 저장
                  </label>
                </div>

                {loginError && (
                  <div className="cs-login-error">
                    {loginError}
                  </div>
                )}

                <button
                  className="cs-login-submit"
                  type="submit"
                >
                  로그인
                </button>
              </form>

              <p className="cs-login-card-footer">
                CS Management System
              </p>
            </div>
          </section>
        </main>

        <div className="cs-login-footer">
          © {new Date().getFullYear()} CS Management System. All rights reserved.
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">

      <aside className="sidebar">

        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            CS
          </div>

          <div>
            <strong>
              {activeWorkspace === 'AS'
                ? 'A/S 접수센터'
                : 'CS 업무관리'}
            </strong>
            <small>
              {activeWorkspace === 'AS'
                ? 'Intake Center'
                : 'Management'}
            </small>
          </div>
        </div>

        {currentUser?.role === 'MASTER' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              margin: '0 10px 12px',
              padding: '6px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,.06)',
            }}
          >
            <button
              type="button"
              onClick={() => switchWorkspace('CS')}
              style={{
                minHeight: '34px',
                border: 0,
                borderRadius: '7px',
                background:
                  activeWorkspace === 'CS'
                    ? '#ffffff'
                    : 'transparent',
                color:
                  activeWorkspace === 'CS'
                    ? '#17325c'
                    : '#d7e2f3',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              CS 업무
            </button>

            <button
              type="button"
              onClick={() => switchWorkspace('AS')}
              style={{
                minHeight: '34px',
                border: 0,
                borderRadius: '7px',
                background:
                  activeWorkspace === 'AS'
                    ? '#ffffff'
                    : 'transparent',
                color:
                  activeWorkspace === 'AS'
                    ? '#17325c'
                    : '#d7e2f3',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              A/S 접수
            </button>
          </div>
        )}

        <SidebarNavigation workspace={activeWorkspace} page={page} onNavigate={setPage} role={currentUser?.role} unreadCount={alertsData.unreadCount} serviceType={selectedService?.requestType} />

        <div className="sidebar-bottom">

          <div className="sidebar-user">
            <div className="avatar">
              {currentUser?.name?.slice(0, 1) || 'U'}
            </div>

            <div>
              <strong>{currentUser?.name || '사용자'}</strong>
              <span>{currentUser?.department || '-'}</span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            로그아웃
          </button>

        </div>

      </aside>


      <main className="main-content">

        <style>{`
          @media (max-width: 900px) {
            .as-intake-layout {
              grid-template-columns: 1fr !important;
            }
            .as-process-layout {
              grid-template-columns: 1fr !important;
            }
            .weekly-summary-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .weekly-work-grid {
              grid-template-columns: repeat(7, 150px) !important;
            }
            .main-content > div[style*="grid-template-columns: minmax(0, 1fr) minmax(300px"] {
              grid-template-columns: 1fr !important;
            }
            .option-admin-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {!isOnline && (
          <div
            style={{
              marginBottom: '14px',
              padding: '10px 14px',
              border: '1px solid #ffd38c',
              borderRadius: '10px',
              background: '#fff7e8',
              color: '#8a5a00',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            오프라인 상태입니다. A/S 작업 내용은 기기에 임시저장할 수 있지만 서버 저장·재고 차감·파일 업로드는 인터넷 연결 후 가능합니다.
          </div>
        )}

        {page === 'remote-as' && activeWorkspace === 'CS' && (
          <>
            <div className="topbar"><div><h1>원격 A/S 현황</h1><p>원격 A/S 요청과 진행 상태를 확인합니다.</p></div><button type="button" className="secondary-button" onClick={loadRemoteServiceRequests}>새로고침</button></div>
            {remoteAsBoard}
          </>
        )}

        {page === 'dashboard' && (
          <>
            <div className="topbar">

              <div>
                <h1>대시보드</h1>

                <p>
                  CS 업무 및 설치 현황을 확인합니다.
                </p>
              </div>

              <div className="top-user">
                {currentUser?.name || '사용자'} · {currentUser?.department || '-'}
              </div>

            </div>

            {remoteAsBoard}

            <section className="dashboard-focus-panel">
              <div className="dashboard-focus-head">
                <div>
                  <span className="dashboard-eyebrow">TODAY · {localDateString()}</span>
                  <h2>오늘 먼저 확인할 업무</h2>
                  <p>숫자를 누르면 해당 업무 화면으로 바로 이동합니다.</p>
                </div>
                <div className="dashboard-quick-actions">
                  <button type="button" className="primary-button" onClick={() => setPage('service')}>+ A/S 접수</button>
                  <button type="button" className="secondary-button" onClick={openRemoteAsRequest}>원격 A/S 요청</button>
                  <button type="button" className="secondary-button" onClick={() => setPage('worklogs')}>업무일지 작성</button>
                  <button type="button" className="secondary-button" onClick={() => setPage('schedule')}>전체 일정</button>
                </div>
              </div>

              <div className="dashboard-focus-grid">
                <button type="button" className="dashboard-focus-card blue" onClick={() => setPage('installations')}>
                  <span>오늘 설치</span>
                  <strong>{dashboardTodayCount('INSTALL')}</strong>
                  <small>설치 일정 확인 →</small>
                </button>
                <button type="button" className="dashboard-focus-card orange" onClick={() => setPage('service')}>
                  <span>오늘 방문 A/S</span>
                  <strong>{dashboardTodayCount('SERVICE')}</strong>
                  <small>방문 일정 확인 →</small>
                </button>
                <button type="button" className={`dashboard-focus-card ${countStatus('점검 필요') > 0 ? 'red' : 'neutral'}`} onClick={() => setPage('sites')}>
                  <span>점검 필요 현장</span>
                  <strong>{countStatus('점검 필요')}</strong>
                  <small>우선 확인 대상 →</small>
                </button>
                <button type="button" className={`dashboard-focus-card ${dashboardMissingLogs > 0 ? 'purple' : 'neutral'}`} onClick={() => setPage('worklogs')}>
                  <span>업무일지 미작성</span>
                  <strong>{dashboardMissingLogs}</strong>
                  <small>작성 현황 확인 →</small>
                </button>
              </div>
            </section>

            <section className="panel dashboard-as-board">
              <div className="panel-header">
                <div>
                  <div className="dashboard-live-title">
                    <span className="dashboard-live-dot" />
                    <h2>실시간 A/S 현황</h2>
                  </div>
                  <p>기존 엑셀 현황판 기준 · 미완료와 긴급 접수를 우선 표시합니다. 15초마다 갱신됩니다.</p>
                </div>
                <button type="button" className="text-button" onClick={() => setPage('service')}>
                  전체 A/S 보기
                </button>
              </div>

              <div className="dashboard-as-summary">
                <span>표시 {dashboardServiceRows.length}건</span>
                <span>미완료 <strong>{serviceRequests.filter((row) => row.status !== '완료').length}</strong></span>
                <span className="urgent">긴급 <strong>{serviceRequests.filter((row) => row.status !== '완료' && row.priority === '긴급').length}</strong></span>
              </div>

              <div className="table-wrap dashboard-as-table-wrap">
                <table className="dashboard-as-table">
                  <thead>
                    <tr>
                      <th>접수일</th>
                      <th>방문일</th>
                      <th>지역</th>
                      <th>현장 / 주소</th>
                      <th>요청 · 증상</th>
                      <th>처리내용</th>
                      <th>연락처</th>
                      <th>담당자</th>
                      <th>청구비용</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardServiceRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`clickable-row ${row.priority === '긴급' && row.status !== '완료' ? 'dashboard-as-urgent-row' : ''}`}
                        onClick={() => loadServiceDetail(row)}
                      >
                        <td>{row.receivedDate?.slice(0, 10) || '-'}</td>
                        <td>{row.visitDate?.slice(0, 10) || '-'}</td>
                        <td>{row.site?.region || row.site?.area || '-'}</td>
                        <td>
                          <strong>{row.site?.name || '-'}</strong>
                          <small>{row.site?.address || ''}</small>
                        </td>
                        <td className="dashboard-as-content">{row.requestContent || '-'}</td>
                        <td className="dashboard-as-content">{row.resolution || '-'}</td>
                        <td>{row.contact || '-'}</td>
                        <td>{row.assignees?.map((item) => item.user?.name).filter(Boolean).join(', ') || '미배정'}</td>
                        <td>{row.billingType === '유상' ? `${Number(row.billingAmount || 0).toLocaleString()}원` : '무상'}</td>
                        <td>
                          <span className={`badge ${getBadgeClass(row.status)}`}>
                            {row.priority === '긴급' && row.status !== '완료' ? '긴급 · ' : ''}{row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!dashboardServiceRows.length && (
                      <tr><td colSpan="10" className="dashboard-as-empty">등록된 방문 A/S가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="summary-grid">

              <div className="summary-card">
                <span>전체 현장</span>
                <strong>{sites.length}</strong>
                <small>등록된 전체 현장</small>
              </div>

              <div className="summary-card">
                <span>설치 예정</span>
                <strong>
                  {countStatus('설치 예정')}
                </strong>
                <small>설치 예정 현장</small>
              </div>

              <div className="summary-card">
                <span>설치 중</span>
                <strong>
                  {countStatus('설치 중')}
                </strong>
                <small>현재 진행 중</small>
              </div>

              <div className="summary-card">
                <span>설치 완료</span>
                <strong>
                  {countStatus('설치 완료')}
                </strong>
                <small>설치 완료 현장</small>
              </div>

              <div className="summary-card danger">
                <span>점검 필요</span>
                <strong>
                  {countStatus('점검 필요')}
                </strong>
                <small>확인이 필요한 현장</small>
              </div>

            </section>

            <section className="content-grid">

              <div className="panel">

                <div className="panel-header">

                  <div>
                    <h2>최근 현장 현황</h2>
                    <p>
                      최근 등록된 현장입니다.
                    </p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setPage('sites')}
                  >
                    전체 보기
                  </button>

                </div>

                <div className="table-wrap">

                  <table>

                    <thead>
                      <tr>
                        <th>현장명</th>
                        <th>지역</th>
                        <th>담당자</th>
                        <th>설치일</th>
                        <th>상태</th>
                      </tr>
                    </thead>

                    <tbody>

                      {sites.slice(0, 5).map((site) => (
                        <tr
                          key={site.id}
                          className="clickable-row"
                          onClick={() =>
                            openSiteDetail(site)
                          }
                        >
                          <td>
                            <strong>
                              {site.name}
                            </strong>
                          </td>

                          <td>{site.area}</td>

                          <td>{site.manager}</td>

                          <td>
                            {site.installDate}
                          </td>

                          <td>
                            <span
                              className={`badge ${getBadgeClass(
                                site.status
                              )}`}
                            >
                              {site.status}
                            </span>
                          </td>
                        </tr>
                      ))}

                    </tbody>

                  </table>

                </div>

              </div>


              <div className="panel">

                <div className="panel-header">
                  <div>
                    <h2>공지사항</h2>
                    <p>최근 공지입니다.</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setPage('notices')}
                  >
                    전체 보기
                  </button>
                </div>

                <div className="notice-list">

                  {notices.slice(0, 4).map((notice) => (
                    <div
                      className="notice-item"
                      key={notice.id}
                    >
                      <strong>
                        {notice.title}
                      </strong>

                      <span>
                        {notice.date}
                      </span>
                    </div>
                  ))}

                </div>

              </div>

            </section>

            <section
              className="panel"
              style={{
                marginTop: '20px',
              }}
            >
              <div className="panel-header">
                <div>
                  <h2>주간 업무 사항</h2>
                  <p>
                    {weeklyWork.startDate && weeklyWork.endDate
                      ? `${weeklyWork.startDate} ~ ${weeklyWork.endDate}`
                      : '이번 주'} 설치 · 방문 A/S · 연차 일정입니다.
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      moveDashboardWeek(-1)
                    }
                  >
                    ← 이전주
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetDashboardWeek}
                  >
                    이번주
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      moveDashboardWeek(1)
                    }
                  >
                    다음주 →
                  </button>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setPage('schedule')
                    }
                  >
                    월간 일정 보기
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(4, minmax(120px, 1fr))',
                  gap: '9px',
                  marginBottom: '14px',
                }}
                className="weekly-summary-grid"
              >
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    background: '#eef5ff',
                  }}
                >
                  <div
                    style={{
                      color: '#66758a',
                      fontSize: '10px',
                    }}
                  >
                    설치
                  </div>
                  <strong
                    style={{
                      display: 'block',
                      marginTop: '3px',
                      color: '#285fb8',
                      fontSize: '19px',
                    }}
                  >
                    {weeklyWork.summary?.installations || 0}
                  </strong>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    background: '#fff3e8',
                  }}
                >
                  <div
                    style={{
                      color: '#7c6a5b',
                      fontSize: '10px',
                    }}
                  >
                    방문 A/S
                  </div>
                  <strong
                    style={{
                      display: 'block',
                      marginTop: '3px',
                      color: '#b75b18',
                      fontSize: '19px',
                    }}
                  >
                    {weeklyWork.summary?.serviceVisits || 0}
                  </strong>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    background: '#f3efff',
                  }}
                >
                  <div
                    style={{
                      color: '#74688f',
                      fontSize: '10px',
                    }}
                  >
                    연차
                  </div>
                  <strong
                    style={{
                      display: 'block',
                      marginTop: '3px',
                      color: '#6b4db5',
                      fontSize: '19px',
                    }}
                  >
                    {weeklyWork.summary?.leaves || 0}
                  </strong>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    background:
                      (weeklyWork.summary?.urgentServices || 0) > 0
                        ? '#fff0f0'
                        : '#f7f9fc',
                  }}
                >
                  <div
                    style={{
                      color: '#7c6b6b',
                      fontSize: '10px',
                    }}
                  >
                    긴급 A/S
                  </div>
                  <strong
                    style={{
                      display: 'block',
                      marginTop: '3px',
                      color:
                        (weeklyWork.summary?.urgentServices || 0) > 0
                          ? '#c23838'
                          : '#596579',
                      fontSize: '19px',
                    }}
                  >
                    {weeklyWork.summary?.urgentServices || 0}
                  </strong>
                </div>
              </div>

              {weeklyWorkLoading ? (
                <div className="memo-box">
                  주간 업무를 불러오는 중입니다.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(7, minmax(150px, 1fr))',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                  }}
                  className="weekly-work-grid"
                >
                  {(weeklyWork.days || []).map(
                    (dayInfo) => {
                      const label =
                        weeklyDayLabel(
                          dayInfo.date
                        )

                      const isToday =
                        dayInfo.date ===
                        localDateString()

                      return (
                        <div
                          key={dayInfo.date}
                          style={{
                            minWidth: '150px',
                            minHeight: '180px',
                            padding: '10px',
                            border:
                              isToday
                                ? '2px solid #4c82db'
                                : '1px solid #e2e8f0',
                            borderRadius: '10px',
                            background:
                              isToday
                                ? '#f7fbff'
                                : '#fff',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                              marginBottom: '9px',
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  label.weekday === '일'
                                    ? '#c43d3d'
                                    : label.weekday === '토'
                                      ? '#3568bb'
                                      : '#354052',
                              }}
                            >
                              {label.weekday} · {label.day}일
                            </strong>

                            {isToday && (
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '999px',
                                  background: '#4c82db',
                                  color: '#fff',
                                  fontSize: '8px',
                                  fontWeight: 900,
                                }}
                              >
                                TODAY
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gap: '6px',
                            }}
                          >
                            {(dayInfo.events || []).map(
                              (event) => {
                                const palette =
                                  event.type === 'INSTALL'
                                    ? {
                                        bg: '#edf5ff',
                                        color: '#285fb8',
                                        label: '설치',
                                      }
                                    : event.type === 'SERVICE'
                                      ? {
                                          bg:
                                            event.priority === '긴급'
                                              ? '#fff0f0'
                                              : '#fff2e8',
                                          color:
                                            event.priority === '긴급'
                                              ? '#bd3434'
                                              : '#ad571a',
                                          label:
                                            event.priority === '긴급'
                                              ? '긴급 A/S'
                                              : 'A/S',
                                        }
                                      : {
                                          bg: '#f3efff',
                                          color: '#6748ae',
                                          label: '연차',
                                        }

                                return (
                                  <button
                                    key={`${dayInfo.date}-${event.id}`}
                                    type="button"
                                    onClick={() =>
                                      openWeeklyEvent(
                                        event
                                      )
                                    }
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: 0,
                                      borderRadius: '8px',
                                      background: palette.bg,
                                      color: palette.color,
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: '5px',
                                        alignItems: 'center',
                                        marginBottom: '3px',
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: '8px',
                                          fontWeight: 900,
                                        }}
                                      >
                                        {palette.label}
                                      </span>
                                    </div>

                                    <strong
                                      style={{
                                        display: 'block',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        fontSize: '11px',
                                      }}
                                    >
                                      {event.title}
                                    </strong>

                                    <div
                                      style={{
                                        marginTop: '3px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        fontSize: '9px',
                                        opacity: .82,
                                      }}
                                    >
                                      {event.type === 'SERVICE' &&
                                      event.assignees?.length
                                        ? event.assignees.join(', ')
                                        : event.subtitle || ''}
                                    </div>
                                  </button>
                                )
                              }
                            )}

                            {!dayInfo.events?.length && (
                              <div
                                style={{
                                  padding: '18px 4px',
                                  color: '#a0a8b4',
                                  textAlign: 'center',
                                  fontSize: '10px',
                                }}
                              >
                                일정 없음
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              )}
            </section>

            <section
              className="panel"
              style={{
                marginTop: '20px',
              }}
            >
              <div className="panel-header">
                <div>
                  <h2>오늘 팀 업무</h2>
                  <p>
                    {todayTeamWork.date || localDateString()} 업무일지 작성 현황입니다.
                  </p>
                </div>

                <button
                  className="text-button"
                  onClick={() => setPage('worklogs')}
                >
                  업무일지 전체 보기
                </button>
              </div>

              {todayTeamWork.members?.length ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {todayTeamWork.members.map((member) => {
                    const firstLog =
                      member.logs?.[0]

                    return (
                      <div
                        key={member.id}
                        style={{
                          border:
                            member.submitted
                              ? '1px solid #d9e7ff'
                              : '1px solid #e5e7eb',
                          background:
                            member.submitted
                              ? '#f8fbff'
                              : '#fafafa',
                          borderRadius: '12px',
                          padding: '15px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '8px',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <strong>
                              {member.name}
                            </strong>

                            <div
                              style={{
                                fontSize: '12px',
                                color: '#667085',
                                marginTop: '2px',
                              }}
                            >
                              {member.position || member.department || 'CS팀'}
                            </div>
                          </div>

                          <span
                            className={`badge ${
                              member.submitted
                                ? 'complete'
                                : ''
                            }`}
                          >
                            {member.submitted
                              ? '작성 완료'
                              : '미작성'}
                          </span>
                        </div>

                        {member.submitted ? (
                          <div
                            style={{
                              marginTop: '12px',
                            }}
                          >
                            <strong
                              style={{
                                display: 'block',
                                fontSize: '14px',
                                marginBottom: '7px',
                              }}
                            >
                              {firstLog?.title || '업무일지'}
                            </strong>

                            {firstLog?.pendingWork && (
                              <div
                                style={{
                                  fontSize: '13px',
                                  lineHeight: 1.5,
                                  marginBottom: '5px',
                                }}
                              >
                                <strong>미완료:</strong>{' '}
                                {firstLog.pendingWork}
                              </div>
                            )}

                            {firstLog?.nextPlan && (
                              <div
                                style={{
                                  fontSize: '13px',
                                  lineHeight: 1.5,
                                }}
                              >
                                <strong>다음 계획:</strong>{' '}
                                {firstLog.nextPlan}
                              </div>
                            )}

                            {(member.logs?.length || 0) > 1 && (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: '#667085',
                                  marginTop: '7px',
                                }}
                              >
                                오늘 작성 {member.logs.length}건
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              marginTop: '12px',
                              fontSize: '13px',
                              color: '#667085',
                            }}
                          >
                            아직 오늘 업무일지가 없습니다.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="memo-box">
                  표시할 활성 직원이 없습니다.
                </div>
              )}
            </section>

            <section className="quick-grid">

              <button
                className="quick-card"
                onClick={() => setPage('inventory')}
              >
                <strong>▥ 재고 관리</strong>
                <span>
                  전체 재고와 부족 품목, 입출고 이력을 확인합니다.
                </span>
              </button>

              <button
                className="quick-card"
                onClick={() => setPage('worklogs')}
              >
                <strong>✎ 업무일지</strong>
                <span>
                  오늘 업무와 실행 계획을 공유합니다.
                </span>
              </button>

              <button
                className="quick-card"
                onClick={() => setPage('manuals')}
              >
                <strong>업무 매뉴얼</strong>
                <span>
                  팀에서 확정한 업무 지식을 확인합니다.
                </span>
              </button>

              <button
                className="quick-card"
                onClick={() => setPage('register')}
              >
                <strong>＋ 현장 등록</strong>
                <span>
                  신규 설치 현장을 등록합니다.
                </span>
              </button>

              <button
                className="quick-card"
                onClick={() => setPage('files')}
              >
                <strong>자료실</strong>
                <span>
                  설치파일과 매뉴얼을 확인합니다.
                </span>
              </button>

              <button
                className="quick-card"
                onClick={() => setPage('notices')}
              >
                <strong>공지사항</strong>
                <span>
                  CS팀 공지사항을 확인합니다.
                </span>
              </button>

            </section>
          </>
        )}


        {page === 'sites' && (
          <>
            <div className="topbar">

              <div>
                <h1>현장 목록</h1>

                <p>
                  등록된 설치 현장을 확인합니다.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() => setPage('register')}
              >
                + 현장 등록
              </button>

            </div>

            <div className="panel">

              <div className="site-toolbar">

                <input
                  type="text"
                  placeholder="현장명 또는 주소 검색"
                />

                <select>
                  <option>전체 지역</option>
                  {optionValues('SITE_REGION').map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>

                <select>
                  <option>전체 상태</option>
                  {optionValues('SITE_STATUS').map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>

                <button className="search-button">
                  검색
                </button>

              </div>

              <div className="table-wrap">

                <table>

                  <thead>
                    <tr>
                      <th>번호</th>
                      <th>현장명</th>
                      <th>지역</th>
                      <th>주소</th>
                      <th>담당자</th>
                      <th>설치일</th>
                      <th>상태</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>

                    {sites.map((site) => (
                      <tr key={site.id}>

                        <td>{site.id}</td>

                        <td>
                          <strong>
                            {site.name}
                          </strong>
                        </td>

                        <td>{site.area}</td>

                        <td>{site.address}</td>

                        <td>{site.manager}</td>

                        <td>
                          {site.installDate}
                        </td>

                        <td>
                          <span
                            className={`badge ${getBadgeClass(
                              site.status
                            )}`}
                          >
                            {site.status}
                          </span>
                        </td>

                        <td>
                          <button
                            className="detail-button"
                            onClick={() =>
                              openSiteDetail(site)
                            }
                          >
                            상세
                          </button>
                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>

            </div>
          </>
        )}


        {page === 'site-detail' && selectedSite && (
          <>
            <div className="topbar">

              <div>
                <button
                  className="back-button"
                  onClick={() => setPage('sites')}
                >
                  ← 현장 목록
                </button>

                <h1>{selectedSite.name}</h1>

                <p>
                  현장 상세 정보 및 설치 진행 상황
                </p>
              </div>

              <span
                className={`badge large-badge ${getBadgeClass(
                  selectedSite.status
                )}`}
              >
                {selectedSite.status}
              </span>

            </div>

            <div className="detail-grid">

              <div className="panel">

                <div className="panel-header">
                  <div>
                    <h2>기본 정보</h2>
                    <p>
                      설치 현장의 기본 정보입니다.
                    </p>
                  </div>

                  <button className="secondary-button">
                    수정
                  </button>
                </div>

                <div className="info-grid">

                  <InfoItem
                    label="현장명"
                    value={selectedSite.name}
                  />

                  <InfoItem
                    label="지역"
                    value={selectedSite.area}
                  />

                  <InfoItem
                    label="주소"
                    value={selectedSite.address}
                  />

                  <InfoItem
                    label="CS 담당자"
                    value={selectedSite.manager}
                  />

                  <InfoItem
                    label="담당자 연락처"
                    value={selectedSite.managerPhone}
                  />

                  <InfoItem
                    label="설치 예정일"
                    value={selectedSite.installDate}
                  />

                  <InfoItem
                    label="설치 장비"
                    value={selectedSite.equipment}
                  />

                  <InfoItem
                    label="상태"
                    value={selectedSite.status}
                  />

                </div>

              </div>


              <div className="panel">

                <div className="panel-header">
                  <div>
                    <h2>고객 담당자</h2>
                    <p>
                      현장 연락처 정보
                    </p>
                  </div>
                </div>

                <div className="info-grid single">

                  <InfoItem
                    label="고객 담당자"
                    value={selectedSite.customer}
                  />

                  <InfoItem
                    label="연락처"
                    value={selectedSite.customerPhone}
                  />

                </div>

              </div>

            </div>


            <div className="panel section-gap">

              <div className="panel-header">
                <div>
                  <h2>특이사항</h2>
                  <p>
                    현장에서 확인해야 할 내용입니다.
                  </p>
                </div>
              </div>

              <div className="memo-box">
                {selectedSite.memo ||
                  '등록된 특이사항이 없습니다.'}
              </div>

            </div>


            <div className="panel section-gap">

              <div className="panel-header">
                <div>
                  <h2>설치 진행 내역</h2>
                  <p>
                    현장 작업 진행 기록
                  </p>
                </div>

                <button className="primary-button">
                  + 진행 내역 추가
                </button>
              </div>

              <div className="timeline">

                <TimelineItem
                  title="현장 등록"
                  text={`${selectedSite.name} 현장이 등록되었습니다.`}
                  date="2026-08-20 10:30"
                />

                <TimelineItem
                  title="담당자 배정"
                  text={`${selectedSite.manager} 담당`}
                  date="2026-08-22 14:20"
                />

                <TimelineItem
                  title="설치 일정 등록"
                  text={`${selectedSite.installDate} 설치 예정`}
                  date="2026-08-23 09:30"
                />

              </div>

            </div>


            <div className="detail-bottom-grid">

              <div className="panel">

                <div className="panel-header">
                  <div>
                    <h2>설치 사진</h2>
                    <p>
                      현장 사진을 관리합니다.
                    </p>
                  </div>

                  <button className="primary-button">
                    + 사진 등록
                  </button>
                </div>

                <div className="photo-grid">

                  <div className="photo-placeholder">
                    설치 전 사진
                  </div>

                  <div className="photo-placeholder">
                    설치 중 사진
                  </div>

                  <div className="photo-placeholder">
                    설치 완료 사진
                  </div>

                </div>

              </div>


              <div className="panel">

                <div className="panel-header">
                  <div>
                    <h2>관련 자료</h2>
                    <p>
                      이 현장에 연결된 파일
                    </p>
                  </div>
                </div>

                <div className="file-list">

                  {selectedSite.siteFiles.length === 0 ? (
                    <div className="memo-box">
                      연결된 자료가 없습니다.
                    </div>
                  ) : (
                    selectedSite.siteFiles.map((siteFile) => (
                      <div
                        className="file-item"
                        key={siteFile.id}
                      >
                        <div className="file-icon">
                          FILE
                        </div>

                        <div className="file-info">
                          <strong>
                            {siteFile.file?.name || '파일'}
                          </strong>

                          <small>
                            {siteFile.file?.category || '-'} · {siteFile.file?.size || '-'}
                          </small>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: '6px',
                          }}
                        >
                          <button
                            type="button"
                            className="detail-button"
                            onClick={() =>
                              siteFile.file && downloadFile(siteFile.file)
                            }
                          >
                            다운로드
                          </button>

                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => unlinkFileFromSite(siteFile.id)}
                          >
                            연결 해제
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                </div>

              </div>

            </div>
          </>
        )}


        {page === 'register' && (
          <>
            <div className="topbar">

              <div>
                <h1>현장 등록</h1>

                <p>
                  새로운 설치 현장을 등록합니다.
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={() => setPage('sites')}
              >
                취소
              </button>

            </div>

            <form
              className="panel site-form"
              onSubmit={registerSite}
            >

              <div className="form-section-title">
                <h2>현장 기본 정보</h2>
                <p>
                  필수 항목을 입력해주세요.
                </p>
              </div>

              <div className="form-grid">

                <FormInput
                  label="현장명"
                  required
                  name="name"
                  value={newSite.name}
                  onChange={changeSiteInput}
                  placeholder="예: 행복아파트"
                />

                <div className="form-field">
                  <label>
                    지역 <span>*</span>
                  </label>

                  <select
                    name="region"
                    value={newSite.region}
                    onChange={changeSiteInput}
                    required
                  >
                    <option value="">지역 선택</option>
                    {optionValues('SITE_REGION').map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                <FormInput
                  label="지역 상세"
                  name="area"
                  value={newSite.area}
                  onChange={changeSiteInput}
                  placeholder="예: 서울 강서구"
                />

                <FormInput
                  label="주소"
                  required
                  name="address"
                  value={newSite.address}
                  onChange={changeSiteInput}
                  placeholder="현장 주소"
                />

              </div>


              <div className="form-divider" />


              <div className="form-section-title">
                <h2>CS 담당 정보</h2>
              </div>

              <div className="form-grid">

                <FormInput
                  label="CS 담당자"
                  required
                  name="manager"
                  value={newSite.manager}
                  onChange={changeSiteInput}
                  placeholder="예: 김대리"
                />

                <FormInput
                  label="담당자 연락처"
                  name="managerPhone"
                  value={newSite.managerPhone}
                  onChange={changeSiteInput}
                  placeholder="010-0000-0000"
                />

              </div>


              <div className="form-divider" />


              <div className="form-section-title">
                <h2>고객 담당 정보</h2>
              </div>

              <div className="form-grid">

                <FormInput
                  label="고객 담당자"
                  name="customer"
                  value={newSite.customer}
                  onChange={changeSiteInput}
                  placeholder="예: 홍길동 관리소장"
                />

                <FormInput
                  label="고객 연락처"
                  name="customerPhone"
                  value={newSite.customerPhone}
                  onChange={changeSiteInput}
                  placeholder="02-0000-0000"
                />

              </div>


              <div className="form-divider" />


              <div className="form-section-title">
                <h2>설치 정보</h2>
              </div>

              <div className="form-grid">

                <div className="form-field">
                  <label>
                    설치 예정일 <span>*</span>
                  </label>

                  <input
                    type="date"
                    required
                    name="installDate"
                    value={newSite.installDate}
                    onChange={changeSiteInput}
                  />
                </div>

                <div className="form-field">
                  <label>설치 상태</label>

                  <select
                    name="status"
                    value={newSite.status}
                    onChange={changeSiteInput}
                  >
                    {optionValues('SITE_STATUS').map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field full">
                  <label>설치 장비</label>

                  <input
                    name="equipment"
                    value={newSite.equipment}
                    onChange={changeSiteInput}
                    placeholder="예: 키오스크 / 출입통제기 / 관리PC"
                  />
                </div>

                <div className="form-field full">
                  <label>특이사항</label>

                  <textarea
                    name="memo"
                    value={newSite.memo}
                    onChange={changeSiteInput}
                    placeholder="현장에서 확인할 내용이나 특이사항을 입력하세요."
                  />
                </div>

              </div>

              <div className="form-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPage('sites')}
                >
                  취소
                </button>

                <button
                  className="primary-button"
                  type="submit"
                >
                  현장 등록
                </button>

              </div>

            </form>
          </>
        )}


        {page === 'files' && (
          <>
            <div className="topbar">
              <div>
                <h1>자료실</h1>
                <p>
                  설치 프로그램, 드라이버 및 문서를 실제로 업로드하고 다운로드합니다.
                </p>
              </div>
            </div>

            <section className="file-category-grid">
              <div className="category-card">
                <span>설치 매뉴얼</span>
                <strong>
                  {files.filter((file) => file.category === '설치 매뉴얼').length}
                </strong>
                <small>PDF 및 문서</small>
              </div>

              <div className="category-card">
                <span>프로그램</span>
                <strong>
                  {files.filter((file) => file.category === '프로그램').length}
                </strong>
                <small>설치 파일</small>
              </div>

              <div className="category-card">
                <span>드라이버</span>
                <strong>
                  {files.filter((file) => file.category === '드라이버').length}
                </strong>
                <small>장치 드라이버</small>
              </div>

              <div className="category-card">
                <span>기타 자료</span>
                <strong>
                  {
                    files.filter(
                      (file) =>
                        !['설치 매뉴얼', '프로그램', '드라이버'].includes(
                          file.category
                        )
                    ).length
                  }
                </strong>
                <small>기타 업무 자료</small>
              </div>
            </section>

            <form
              className="panel"
              onSubmit={uploadFile}
              style={{ marginBottom: '20px' }}
            >
              <div className="panel-header">
                <div>
                  <h2>자료 업로드</h2>
                  <p>분류를 선택하고 파일을 등록하세요.</p>
                </div>
              </div>

              <div className="site-toolbar files-toolbar">
                <select
                  value={fileCategory}
                  onChange={(e) => setFileCategory(e.target.value)}
                >
                  {optionValues('FILE_CATEGORY').map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>

                <input
                  id="resource-file-input"
                  type="file"
                  onChange={(e) =>
                    setSelectedUploadFile(e.target.files?.[0] || null)
                  }
                />

                <button
                  className="primary-button"
                  type="submit"
                >
                  + 업로드
                </button>
              </div>

              {selectedUploadFile && (
                <p style={{ margin: 0, color: '#647589', fontSize: '13px' }}>
                  선택 파일: {selectedUploadFile.name}
                </p>
              )}
            </form>

            <div className="panel">
              <div className="site-toolbar files-toolbar">
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="파일명 검색"
                />

                <select
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                >
                  <option>전체 분류</option>
                  {optionValues('FILE_CATEGORY').map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>

                <button
                  className="search-button"
                  type="button"
                  onClick={loadFiles}
                >
                  새로고침
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>분류</th>
                      <th>파일명</th>
                      <th>크기</th>
                      <th>등록일</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredFiles.length === 0 ? (
                      <tr>
                        <td colSpan="5">
                          등록된 자료가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredFiles.map((file) => (
                        <tr key={file.id}>
                          <td>
                            <span className="file-category">
                              {file.category}
                            </span>
                          </td>

                          <td>
                            <strong>{file.name}</strong>
                          </td>

                          <td>{file.size}</td>

                          <td>{file.date}</td>

                          <td>
                            <div
                              style={{
                                display: 'flex',
                                gap: '6px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <button
                                type="button"
                                className="detail-button"
                                onClick={() => downloadFile(file)}
                              >
                                다운로드
                              </button>

                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                  setEditingFileId(file.id)
                                  setEditingFileCategory(file.category)
                                }}
                              >
                                분류 변경
                              </button>

                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                  setLinkingFileId(file.id)
                                  setLinkSiteId('')
                                }}
                              >
                                현장 연결
                              </button>

                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => deleteFile(file)}
                              >
                                삭제
                              </button>
                            </div>

                            {editingFileId === file.id && (
                              <div
                                style={{
                                  marginTop: '10px',
                                  display: 'flex',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <select
                                  value={editingFileCategory}
                                  onChange={(e) =>
                                    setEditingFileCategory(e.target.value)
                                  }
                                >
                                  {optionValues('FILE_CATEGORY').map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  className="primary-button"
                                  onClick={() => saveFileCategory(file)}
                                >
                                  저장
                                </button>

                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => setEditingFileId(null)}
                                >
                                  취소
                                </button>
                              </div>
                            )}

                            {linkingFileId === file.id && (
                              <div
                                style={{
                                  marginTop: '10px',
                                  display: 'flex',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <select
                                  value={linkSiteId}
                                  onChange={(e) => setLinkSiteId(e.target.value)}
                                >
                                  <option value="">현장 선택</option>
                                  {sites.map((site) => (
                                    <option
                                      key={site.id}
                                      value={site.id}
                                    >
                                      {site.name} - {site.area}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  className="primary-button"
                                  onClick={() => linkFileToSite(file)}
                                >
                                  연결
                                </button>

                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => {
                                    setLinkingFileId(null)
                                    setLinkSiteId('')
                                  }}
                                >
                                  취소
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}


        {page === 'notices' && (
          <>
            <div className="topbar">
              <div>
                <h1>공지사항</h1>
                <p>CS팀 공지사항을 실제 DB로 관리합니다.</p>
              </div>

              <button
                className="primary-button"
                onClick={() => {
                  setNoticeMode(!noticeMode)
                  setEditingNoticeId(null)
                  setNewNotice({
                    title: '',
                    content: '',
                    isPinned: false,
                  })
                }}
              >
                {noticeMode
                  ? '작성 취소'
                  : '+ 공지 등록'}
              </button>
            </div>

            {noticeMode && (
              <form
                className="panel notice-form"
                onSubmit={registerNotice}
              >
                <div className="form-field">
                  <label>제목</label>

                  <input
                    required
                    value={newNotice.title}
                    onChange={(e) =>
                      setNewNotice({
                        ...newNotice,
                        title: e.target.value,
                      })
                    }
                    placeholder="공지 제목"
                  />
                </div>

                <div className="form-field">
                  <label>내용</label>

                  <textarea
                    required
                    value={newNotice.content}
                    onChange={(e) =>
                      setNewNotice({
                        ...newNotice,
                        content: e.target.value,
                      })
                    }
                    placeholder="공지 내용을 입력하세요."
                  />
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '14px',
                    fontSize: '13px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(newNotice.isPinned)}
                    onChange={(e) =>
                      setNewNotice({
                        ...newNotice,
                        isPinned: e.target.checked,
                      })
                    }
                  />
                  상단 고정
                </label>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setNoticeMode(false)
                      setEditingNoticeId(null)
                    }}
                  >
                    취소
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                  >
                    {editingNoticeId ? '수정 저장' : '등록'}
                  </button>
                </div>
              </form>
            )}

            <div className="panel">
              <div className="notice-board">
                {notices.length === 0 ? (
                  <div className="memo-box">
                    등록된 공지사항이 없습니다.
                  </div>
                ) : (
                  notices.map((notice) => (
                    <div
                      className="notice-board-item"
                      key={notice.id}
                    >
                      <div className="notice-number">
                        {notice.isPinned ? '공지' : notice.id}
                      </div>

                      <div className="notice-body">
                        <strong>
                          {notice.isPinned && '📌 '}
                          {notice.title}
                        </strong>

                        <p>{notice.content}</p>

                        <span>
                          {notice.writer} · {notice.date}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => editNotice(notice)}
                        >
                          수정
                        </button>

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => deleteNotice(notice)}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {page === 'installations' && (
          <>
            <div className="topbar">
              <div>
                <h1>설치 관리</h1>
                <p>
                  설치 예정부터 완료까지 현장별 장비 구성과 담당자를 한 화면에서 관리합니다.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={startNewSiteForInstallation}
                >
                  + 새 현장 등록
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    if (installationFormOpen) {
                      setInstallationFormOpen(false)
                      setEditingInstallationSiteId(null)
                      setInstallationForm(
                        emptyInstallationForm()
                      )
                    } else {
                      openNewInstallation()
                    }
                  }}
                >
                  {installationFormOpen
                    ? '등록 취소'
                    : '+ 설치 예정 등록'}
                </button>
              </div>
            </div>

            {installationFormOpen && (
              <form
                className="panel"
                onSubmit={saveInstallation}
                style={{
                  marginBottom: '20px',
                }}
              >
                <div className="panel-header">
                  <div>
                    <h2>
                      {editingInstallationSiteId
                        ? '설치 정보 수정'
                        : '설치 예정 등록'}
                    </h2>
                    <p>
                      기존 현장을 선택한 뒤 설치일, 장비 구성, 담당자를 입력합니다.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>현장 *</label>
                    <input
                      required
                      list="installation-site-list"
                      value={installationForm.siteName}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          siteName:
                            e.target.value,
                          siteId: '',
                        })
                      }
                      onBlur={applyInstallationSiteSuggestion}
                      placeholder="현장명을 직접 입력하세요"
                    />

                    <datalist id="installation-site-list">
                      {sites.map((site) => (
                        <option
                          key={site.id}
                          value={site.name}
                        >
                          {site.region || site.area || ''}
                        </option>
                      ))}
                    </datalist>

                    <small
                      style={{
                        marginTop: '5px',
                        color: '#7b8798',
                      }}
                    >
                      기존 현장명은 자동완성되고, 새로운 현장명도 바로 입력할 수 있습니다.
                    </small>
                  </div>

                  <div className="form-field">
                    <label>설치 예정일 *</label>
                    <input
                      type="date"
                      required
                      value={installationForm.installDate}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          installDate:
                            e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>설치 작업 일수</label>
                    <select
                      value={installationForm.installDays}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          installDays:
                            Number(
                              e.target.value
                            ),
                        })
                      }
                    >
                      {optionValues('INSTALL_DAYS').map((days) => (
                        <option key={days} value={Number(days)}>
                          {days}일
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>상태</label>
                    <select
                      value={installationForm.status}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          status:
                            e.target.value,
                        })
                      }
                    >
                      {optionValues('SITE_STATUS').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>분류</label>
                    <select
                      value={installationForm.installCategory}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          installCategory:
                            e.target.value,
                        })
                      }
                    >
                      <option value="">선택</option>
                      {optionValues('INSTALL_CATEGORY').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>키오스크 모델</label>
                    <select
                      value={installationForm.kioskModel}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          kioskModel:
                            e.target.value,
                        })
                      }
                    >
                      <option value="">선택</option>
                      {optionValues('INSTALL_KIOSK_MODEL').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>키오스크 수량</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={installationForm.kioskCount}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          kioskCount:
                            Number(
                              e.target.value
                            ),
                        })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>빔 / 프로젝터</label>
                    <input
                      value={installationForm.beamModel}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          beamModel:
                            e.target.value,
                        })
                      }
                      placeholder="예: L260F"
                    />
                  </div>

                  <div className="form-field">
                    <label>센서 타입</label>
                    <select
                      value={installationForm.sensorType}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          sensorType:
                            e.target.value,
                        })
                      }
                    >
                      <option value="">선택</option>
                      {optionValues('INSTALL_SENSOR_TYPE').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>매트 유무</label>
                    <select
                      value={installationForm.matUse}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          matUse:
                            e.target.value,
                        })
                      }
                    >
                      <option value="">선택</option>
                      {optionValues('YES_NO').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>오토티업 유무</label>
                    <select
                      value={installationForm.autoTeeUse}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          autoTeeUse:
                            e.target.value,
                        })
                      }
                    >
                      <option value="">선택</option>
                      {optionValues('YES_NO').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>티업기 제조사</label>
                    <input
                      value={installationForm.autoTeeMaker}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          autoTeeMaker:
                            e.target.value,
                        })
                      }
                      placeholder="예: 제조사명"
                    />
                  </div>

                  <div className="form-field">
                    <label>관리 프로그램</label>
                    <input
                      value={installationForm.managementProgram}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          managementProgram:
                            e.target.value,
                        })
                      }
                      placeholder="예: 디딤골프"
                    />
                  </div>

                  <div className="form-field">
                    <label>카메라</label>
                    <select
                      value={installationForm.cameraModel}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          cameraModel:
                            e.target.value,
                        })
                      }
                    >
                      <option value="">선택</option>
                      {optionValues('INSTALL_CAMERA_MODEL').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>인터넷 설치 유무</label>
                    <select
                      value={installationForm.internetInstall}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          internetInstall:
                            e.target.value,
                        })
                      }
                    >
                      <option value="">선택</option>
                      {optionValues('YES_NO').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>기타 설치 장비</label>
                    <input
                      value={installationForm.equipment}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          equipment:
                            e.target.value,
                        })
                      }
                      placeholder="예: 관리PC / 스위치 / 컨버터"
                    />
                  </div>

                  <div className="form-field">
                    <label>협력 업체</label>
                    <input
                      value={installationForm.partnerCompany}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          partnerCompany:
                            e.target.value,
                        })
                      }
                      placeholder="예: OO전기"
                    />
                  </div>

                  <div className="form-field full">
                    <label>설치 담당자</label>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '8px',
                      }}
                    >
                      {teamMembers.length ? (
                        teamMembers.map(
                          (member) => {
                            const checked =
                              installationForm.assigneeIds.includes(
                                member.id
                              )

                            return (
                              <label
                                key={member.id}
                                style={{
                                  display:
                                    'inline-flex',
                                  alignItems:
                                    'center',
                                  gap: '7px',
                                  padding:
                                    '8px 11px',
                                  border:
                                    checked
                                      ? '1px solid #3b82f6'
                                      : '1px solid #dfe5ec',
                                  borderRadius:
                                    '999px',
                                  background:
                                    checked
                                      ? '#eff6ff'
                                      : '#fff',
                                  cursor:
                                    'pointer',
                                  fontSize:
                                    '13px',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    toggleInstallationAssignee(
                                      member.id
                                    )
                                  }
                                />

                                {member.name}
                                {member.position
                                  ? ` · ${member.position}`
                                  : ''}
                              </label>
                            )
                          }
                        )
                      ) : (
                        <span
                          style={{
                            color: '#7b8798',
                            fontSize: '13px',
                          }}
                        >
                          담당자 목록을 불러오는 중입니다.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="form-field full">
                    <label>설치 메모</label>
                    <textarea
                      value={installationForm.installMemo}
                      onChange={(e) =>
                        setInstallationForm({
                          ...installationForm,
                          installMemo:
                            e.target.value,
                        })
                      }
                      placeholder="설치 전 준비사항, 특이사항, 협력업체 전달 내용 등을 기록합니다."
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setInstallationFormOpen(false)
                      setEditingInstallationSiteId(null)
                      setInstallationForm(
                        emptyInstallationForm()
                      )
                    }}
                  >
                    취소
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                  >
                    {editingInstallationSiteId
                      ? '수정 저장'
                      : '설치 예정 등록'}
                  </button>
                </div>
              </form>
            )}

            <section
              className="summary-grid"
              style={{
                marginBottom: '20px',
              }}
            >
              <div className="summary-card">
                <span>설치 일정</span>
                <strong>
                  {
                    sites.filter(
                      (site) =>
                        Boolean(
                          site.installDate
                        )
                    ).length
                  }
                </strong>
                <small>설치일이 등록된 현장</small>
              </div>

              <div className="summary-card">
                <span>설치 예정</span>
                <strong>
                  {countStatus('설치 예정')}
                </strong>
                <small>방문 전 준비 단계</small>
              </div>

              <div className="summary-card">
                <span>설치 중</span>
                <strong>
                  {countStatus('설치 중')}
                </strong>
                <small>현재 작업 진행 중</small>
              </div>

              <div className="summary-card">
                <span>설치 완료</span>
                <strong>
                  {countStatus('설치 완료')}
                </strong>
                <small>설치가 끝난 현장</small>
              </div>

              <div className="summary-card danger">
                <span>점검 필요</span>
                <strong>
                  {countStatus('점검 필요')}
                </strong>
                <small>추가 확인이 필요한 현장</small>
              </div>
            </section>

            <div className="panel">
              <div
                className="panel-header"
                style={{
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <h2>설치 현황</h2>
                  <p>
                    기존 설치 현황표의 주요 항목을 현장 데이터와 연결해서 관리합니다.
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent:
                      'flex-end',
                  }}
                >
                  <select
                    value={installationStatusFilter}
                    onChange={(e) =>
                      setInstallationStatusFilter(
                        e.target.value
                      )
                    }
                    style={{
                      minWidth: '120px',
                    }}
                  >
                    <option>전체</option>
                    {optionValues('SITE_STATUS').map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>

                  <input
                    value={installationSearch}
                    onChange={(e) =>
                      setInstallationSearch(
                        e.target.value
                      )
                    }
                    placeholder="현장 / 지역 / 장비 / 담당자 검색"
                    style={{
                      minWidth: '260px',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  overflowX: 'auto',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    minWidth: '2050px',
                    borderCollapse:
                      'collapse',
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        '설치일',
                        '일수',
                        '분류',
                        '지역',
                        '현장',
                        '키오스크',
                        '수량',
                        '빔',
                        '센서 타입',
                        '매트',
                        '오토티업',
                        '티업기 제조사',
                        '관리 프로그램',
                        '카메라',
                        '인터넷',
                        '기타 장비',
                        '담당자',
                        '협력업체',
                        '상태',
                        '관리',
                      ].map((title) => (
                        <th
                          key={title}
                          style={{
                            padding:
                              '11px 9px',
                            textAlign:
                              'left',
                            fontSize:
                              '12px',
                            whiteSpace:
                              'nowrap',
                            borderBottom:
                              '1px solid #dfe5ec',
                            background:
                              '#f8fafc',
                          }}
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {sites
                      .filter((site) => {
                        if (
                          installationStatusFilter !==
                            '전체' &&
                          site.status !==
                            installationStatusFilter
                        ) {
                          return false
                        }

                        const keyword =
                          installationSearch
                            .trim()
                            .toLowerCase()

                        if (!keyword) {
                          return true
                        }

                        const assignees =
                          getInstallationAssigneeNames(
                            site
                          )

                        return [
                          site.name,
                          site.region,
                          site.area,
                          site.address,
                          site.installCategory,
                          site.kioskModel,
                          site.beamModel,
                          site.sensorType,
                          site.autoTeeMaker,
                          site.managementProgram,
                          site.cameraModel,
                          site.internetInstall,
                          site.equipment,
                          site.partnerCompany,
                          assignees,
                        ].some((value) =>
                          String(value || '')
                            .toLowerCase()
                            .includes(keyword)
                        )
                      })
                      .sort((a, b) => {
                        if (
                          a.installDate &&
                          b.installDate
                        ) {
                          return a.installDate.localeCompare(
                            b.installDate
                          )
                        }

                        if (a.installDate) {
                          return -1
                        }

                        if (b.installDate) {
                          return 1
                        }

                        return (
                          Number(b.id) -
                          Number(a.id)
                        )
                      })
                      .map((site) => (
                        <tr key={site.id}>
                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {site.installDate ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {site.installDays || 1}일
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                            }}
                          >
                            {site.installCategory ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {site.region ||
                              site.area ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              minWidth:
                                '180px',
                            }}
                          >
                            <strong>
                              {site.name}
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  '3px',
                                color:
                                  '#7b8798',
                                fontSize:
                                  '11px',
                              }}
                            >
                              {site.address ||
                                ''}
                            </div>
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {site.kioskModel ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {site.kioskCount
                              ? `${site.kioskCount}대`
                              : '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                            }}
                          >
                            {site.beamModel ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                            }}
                          >
                            {site.sensorType ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                            }}
                          >
                            {site.matUse || '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                            }}
                          >
                            {site.autoTeeUse ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              minWidth:
                                '110px',
                            }}
                          >
                            {site.autoTeeMaker ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              minWidth:
                                '120px',
                            }}
                          >
                            {site.managementProgram ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              minWidth:
                                '120px',
                            }}
                          >
                            {site.cameraModel ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {site.internetInstall ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              minWidth:
                                '140px',
                            }}
                          >
                            {site.equipment ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              minWidth:
                                '140px',
                            }}
                          >
                            {getInstallationAssigneeNames(
                              site
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              minWidth:
                                '120px',
                            }}
                          >
                            {site.partnerCompany ||
                              '-'}
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            <span
                              className={`badge ${getBadgeClass(
                                site.status
                              )}`}
                            >
                              {site.status}
                            </span>
                          </td>

                          <td
                            style={{
                              padding:
                                '10px 9px',
                              borderBottom:
                                '1px solid #eef1f4',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            <div
                              style={{
                                display:
                                  'flex',
                                gap: '5px',
                              }}
                            >
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  editInstallation(
                                    site
                                  )
                                }
                              >
                                수정
                              </button>

                              <button
                                type="button"
                                className="primary-button"
                                onClick={() =>
                                  openInstallChecklist(
                                    site
                                  )
                                }
                              >
                                체크
                              </button>

                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  openSiteDetail(
                                    site
                                  )
                                }
                              >
                                현장
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {page === 'schedule' && (
          <>
            <style>{`
              .monthly-schedule-calendar {
                display: grid;
                grid-template-columns: repeat(7, minmax(138px, 1fr));
                min-width: 980px;
                border-top: 1px solid #e3e8ef;
                border-left: 1px solid #e3e8ef;
                background: #fff;
              }

              .monthly-schedule-weekday {
                padding: 11px 8px;
                border-right: 1px solid #e3e8ef;
                border-bottom: 1px solid #e3e8ef;
                background: #f7f9fc;
                color: #526174;
                text-align: center;
                font-size: 12px;
                font-weight: 800;
              }

              .monthly-schedule-weekday.sun {
                color: #d24a4a;
              }

              .monthly-schedule-weekday.sat {
                color: #3568c8;
              }

              .monthly-schedule-day {
                min-height: 142px;
                padding: 8px;
                box-sizing: border-box;
                border-right: 1px solid #e3e8ef;
                border-bottom: 1px solid #e3e8ef;
                background: #fff;
              }

              .monthly-schedule-day.empty {
                background: #fafbfc;
              }

              .monthly-schedule-day.today {
                background: #f8fbff;
                box-shadow: inset 0 0 0 2px #6da6ff;
              }

              .monthly-schedule-day-number {
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-height: 24px;
                margin-bottom: 5px;
                color: #334155;
                font-size: 12px;
                font-weight: 800;
              }

              .monthly-schedule-day-number.sun {
                color: #d24a4a;
              }

              .monthly-schedule-day-number.sat {
                color: #3568c8;
              }

              .monthly-schedule-today-chip {
                padding: 2px 6px;
                border-radius: 999px;
                background: #1f6feb;
                color: #fff;
                font-size: 9px;
                font-weight: 800;
              }

              .monthly-schedule-event {
                width: 100%;
                margin-top: 5px;
                padding: 6px 7px;
                border: 1px solid;
                border-radius: 7px;
                box-sizing: border-box;
                text-align: left;
                cursor: pointer;
                transition: .16s ease;
              }

              .monthly-schedule-event:hover {
                transform: translateY(-1px);
                filter: brightness(.985);
              }

              .monthly-schedule-event-top {
                display: flex;
                align-items: center;
                gap: 5px;
                min-width: 0;
              }

              .monthly-schedule-event-kind {
                flex: 0 0 auto;
                font-size: 9px;
                font-weight: 900;
              }

              .monthly-schedule-event-title {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 11px;
                font-weight: 800;
              }

              .monthly-schedule-event-sub {
                margin-top: 3px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                opacity: .76;
                font-size: 9px;
              }

              .schedule-legend {
                display: flex;
                gap: 14px;
                flex-wrap: wrap;
                align-items: center;
              }

              .schedule-legend-item {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                color: #667085;
                font-size: 12px;
                font-weight: 700;
              }

              .schedule-legend-dot {
                width: 9px;
                height: 9px;
                border-radius: 999px;
              }

              .schedule-toolbar {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                align-items: center;
                justify-content: flex-end;
              }

              .schedule-month-title {
                min-width: 150px;
                color: #172033;
                text-align: center;
                font-size: 20px;
                font-weight: 850;
                letter-spacing: -.4px;
              }

              @media (max-width: 760px) {
                .schedule-toolbar {
                  justify-content: flex-start;
                }
              }
            `}</style>

            <div className="topbar">
              <div>
                <h1>월간 일정</h1>
                <p>
                  설치 예정 · 방문 A/S · 승인 연차를 한 달 캘린더에서 한 번에 확인합니다.
                </p>
              </div>

              <div className="schedule-toolbar">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    moveScheduleMonth(-1)
                  }
                >
                  ‹ 이전달
                </button>

                <div className="schedule-month-title">
                  {scheduleYear}년 {scheduleMonth}월
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    moveScheduleMonth(1)
                  }
                >
                  다음달 ›
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const now =
                      new Date()

                    setScheduleYear(
                      now.getFullYear()
                    )

                    setScheduleMonth(
                      now.getMonth() + 1
                    )
                  }}
                >
                  이번달
                </button>
              </div>
            </div>

            {currentUser?.role === 'MASTER' && (
              <section className="panel" style={{ marginBottom: '18px' }}>
                <div className="panel-header">
                  <div>
                    <h2>야간/휴무 접수 기준</h2>
                    <p>대한민국 시간 기준입니다. 설정 밖의 접수는 자동으로 야간/휴무 접수로 표시됩니다.</p>
                  </div>
                  <button type="button" className="primary-button" onClick={saveAsOperatingSetting}>설정 저장</button>
                </div>
                <div className="form-grid">
                  <div className="form-field">
                    <label>업무 시작</label>
                    <input type="time" value={asOperatingSetting.startTime} onChange={(e) => setAsOperatingSetting({ ...asOperatingSetting, startTime: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>업무 종료</label>
                    <input type="time" value={asOperatingSetting.endTime} onChange={(e) => setAsOperatingSetting({ ...asOperatingSetting, endTime: e.target.value })} />
                  </div>
                  <div className="form-field full">
                    <label>근무 요일</label>
                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                      {['일', '월', '화', '수', '목', '금', '토'].map((label, day) => (
                        <label key={day} style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                          <input type="checkbox" checked={(asOperatingSetting.workingDays || []).includes(day)} onChange={(e) => setAsOperatingSetting({
                            ...asOperatingSetting,
                            workingDays: e.target.checked
                              ? [...(asOperatingSetting.workingDays || []), day].sort()
                              : (asOperatingSetting.workingDays || []).filter((value) => value !== day),
                          })} /> {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-field full">
                    <label>휴무일</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input type="date" value={asHolidayInput} onChange={(e) => setAsHolidayInput(e.target.value)} />
                      <button type="button" className="secondary-button" onClick={() => {
                        if (!asHolidayInput) return
                        setAsOperatingSetting({ ...asOperatingSetting, holidays: [...new Set([...(asOperatingSetting.holidays || []), asHolidayInput])].sort() })
                        setAsHolidayInput('')
                      }}>휴무일 추가</button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {(asOperatingSetting.holidays || []).map((holiday) => (
                        <button key={holiday} type="button" className="secondary-button" onClick={() => setAsOperatingSetting({ ...asOperatingSetting, holidays: asOperatingSetting.holidays.filter((value) => value !== holiday) })}>{holiday} ×</button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section
              className="summary-grid"
              style={{
                marginBottom: '20px',
              }}
            >
              <div className="summary-card">
                <span>설치 일정</span>
                <strong>
                  {monthlySchedule.summary?.installations || 0}
                </strong>
                <small>
                  이번 달 설치일이 등록된 현장
                </small>
              </div>

              <div className="summary-card">
                <span>설치 예정</span>
                <strong>
                  {monthlySchedule.summary?.scheduledInstallations || 0}
                </strong>
                <small>
                  상태가 설치 예정인 현장
                </small>
              </div>

              <div className="summary-card">
                <span>A/S 방문</span>
                <strong>
                  {monthlySchedule.summary?.serviceVisits || 0}
                </strong>
                <small>
                  방문일이 정해진 A/S
                </small>
              </div>

              <div className="summary-card">
                <span>승인 연차</span>
                <strong>
                  {monthlySchedule.summary?.leaves || 0}
                </strong>
                <small>
                  이번 달과 겹치는 승인 연차
                </small>
              </div>
            </section>

            <div
              className="panel"
              style={{
                marginBottom: '20px',
              }}
            >
              <div className="panel-header">
                <div>
                  <h2>
                    {scheduleYear}년 {scheduleMonth}월 팀 스케줄
                  </h2>
                  <p>
                    일정 항목을 누르면 관련 메뉴로 이동합니다.
                  </p>
                </div>

                <div className="schedule-legend">
                  <span className="schedule-legend-item">
                    <span
                      className="schedule-legend-dot"
                      style={{
                        background: '#4d86e8',
                      }}
                    />
                    설치
                  </span>

                  <span className="schedule-legend-item">
                    <span
                      className="schedule-legend-dot"
                      style={{
                        background: '#e8792f',
                      }}
                    />
                    A/S
                  </span>

                  <span className="schedule-legend-item">
                    <span
                      className="schedule-legend-dot"
                      style={{
                        background: '#7b5cc9',
                      }}
                    />
                    연차
                  </span>

                  {scheduleLoading && (
                    <span
                      style={{
                        color: '#7b8798',
                        fontSize: '12px',
                      }}
                    >
                      불러오는 중...
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  overflowX: 'auto',
                  borderRadius: '10px',
                }}
              >
                <div className="monthly-schedule-calendar">
                  {[
                    '일',
                    '월',
                    '화',
                    '수',
                    '목',
                    '금',
                    '토',
                  ].map(
                    (weekday, index) => (
                      <div
                        key={weekday}
                        className={`monthly-schedule-weekday ${
                          index === 0
                            ? 'sun'
                            : index === 6
                              ? 'sat'
                              : ''
                        }`}
                      >
                        {weekday}
                      </div>
                    )
                  )}

                  {getScheduleCalendarCells().map(
                    (date, index) => {
                      const events =
                        getScheduleEventsForDate(
                          date
                        )

                      const dayOfWeek =
                        index % 7

                      return (
                        <div
                          key={
                            date
                              ? scheduleDateKey(
                                  date
                                )
                              : `empty-${index}`
                          }
                          className={`monthly-schedule-day ${
                            date
                              ? ''
                              : 'empty'
                          } ${
                            isScheduleToday(
                              date
                            )
                              ? 'today'
                              : ''
                          }`}
                        >
                          {date && (
                            <>
                              <div
                                className={`monthly-schedule-day-number ${
                                  dayOfWeek === 0
                                    ? 'sun'
                                    : dayOfWeek === 6
                                      ? 'sat'
                                      : ''
                                }`}
                              >
                                <span>
                                  {date.getDate()}
                                </span>

                                {isScheduleToday(
                                  date
                                ) && (
                                  <span className="monthly-schedule-today-chip">
                                    오늘
                                  </span>
                                )}
                              </div>

                              {events.map(
                                (event) => {
                                  const style =
                                    getScheduleEventStyle(
                                      event
                                    )

                                  return (
                                    <button
                                      key={event.id}
                                      type="button"
                                      className="monthly-schedule-event"
                                      style={style}
                                      onClick={() =>
                                        openScheduleEvent(
                                          event
                                        )
                                      }
                                      title={
                                        event.subtitle ||
                                        event.title
                                      }
                                    >
                                      <div className="monthly-schedule-event-top">
                                        <span className="monthly-schedule-event-kind">
                                          {getScheduleEventLabel(
                                            event
                                          )}
                                        </span>

                                        <span className="monthly-schedule-event-title">
                                          {event.title}
                                        </span>
                                      </div>

                                      <div className="monthly-schedule-event-sub">
                                        {event.type ===
                                        'INSTALL'
                                          ? event.status
                                          : event.type ===
                                              'SERVICE'
                                            ? [
                                                ...(event.assignees ||
                                                  []),
                                                event.status,
                                              ]
                                                .filter(
                                                  Boolean
                                                )
                                                .join(
                                                  ' · '
                                                )
                                            : `${event.subtitle} · ${event.days || 1}일`}
                                      </div>
                                    </button>
                                  )
                                }
                              )}
                            </>
                          )}
                        </div>
                      )
                    }
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>이번 달 설치 예정</h2>
                    <p>
                      설치 예정 현장을 빠르게 확인합니다.
                    </p>
                  </div>
                </div>

                {(monthlySchedule.events || [])
                  .filter(
                    (event) =>
                      event.type ===
                        'INSTALL' &&
                      event.status ===
                        '설치 예정'
                  )
                  .length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {(monthlySchedule.events || [])
                      .filter(
                        (event) =>
                          event.type ===
                            'INSTALL' &&
                          event.status ===
                            '설치 예정'
                      )
                      .map(
                        (event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() =>
                              openScheduleEvent(
                                event
                              )
                            }
                            style={{
                              width: '100%',
                              padding:
                                '11px 12px',
                              border:
                                '1px solid #e2e8f0',
                              borderRadius:
                                '9px',
                              background:
                                '#fff',
                              textAlign:
                                'left',
                              cursor:
                                'pointer',
                            }}
                          >
                            <strong>
                              {event.startDate === event.endDate
                                ? event.startDate
                                : `${event.startDate} ~ ${event.endDate}`}
                              {' · '}
                              {event.title}
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  '4px',
                                color:
                                  '#738095',
                                fontSize:
                                  '12px',
                              }}
                            >
                              {[
                                event.region,
                                event.equipment,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  ' · '
                                ) || '설치 예정'}
                            </div>
                          </button>
                        )
                      )}
                  </div>
                ) : (
                  <div className="memo-box">
                    이번 달 설치 예정 현장이 없습니다.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>이번 달 A/S 방문</h2>
                    <p>
                      방문일이 정해진 A/S입니다.
                    </p>
                  </div>
                </div>

                {(monthlySchedule.events || [])
                  .filter(
                    (event) =>
                      event.type ===
                      'SERVICE'
                  )
                  .length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {(monthlySchedule.events || [])
                      .filter(
                        (event) =>
                          event.type ===
                          'SERVICE'
                      )
                      .map(
                        (event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() =>
                              openScheduleEvent(
                                event
                              )
                            }
                            style={{
                              width: '100%',
                              padding:
                                '11px 12px',
                              border:
                                '1px solid #e2e8f0',
                              borderRadius:
                                '9px',
                              background:
                                '#fff',
                              textAlign:
                                'left',
                              cursor:
                                'pointer',
                            }}
                          >
                            <strong>
                              {event.date} · {event.title}
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  '4px',
                                color:
                                  '#738095',
                                fontSize:
                                  '12px',
                              }}
                            >
                              {[
                                ...(event.assignees ||
                                  []),
                                event.status,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  ' · '
                                )}
                            </div>
                          </button>
                        )
                      )}
                  </div>
                ) : (
                  <div className="memo-box">
                    이번 달 방문 예정 A/S가 없습니다.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>이번 달 연차</h2>
                    <p>
                      팀원 동의가 끝난 승인 연차입니다.
                    </p>
                  </div>
                </div>

                {(monthlySchedule.events || [])
                  .filter(
                    (event) =>
                      event.type ===
                      'LEAVE'
                  )
                  .length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {(monthlySchedule.events || [])
                      .filter(
                        (event) =>
                          event.type ===
                          'LEAVE'
                      )
                      .map(
                        (event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() =>
                              openScheduleEvent(
                                event
                              )
                            }
                            style={{
                              width: '100%',
                              padding:
                                '11px 12px',
                              border:
                                '1px solid #e2e8f0',
                              borderRadius:
                                '9px',
                              background:
                                '#fff',
                              textAlign:
                                'left',
                              cursor:
                                'pointer',
                            }}
                          >
                            <strong>
                              {event.startDate ===
                              event.endDate
                                ? event.startDate
                                : `${event.startDate} ~ ${event.endDate}`}
                              {' · '}
                              {event.title}
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  '4px',
                                color:
                                  '#738095',
                                fontSize:
                                  '12px',
                              }}
                            >
                              {event.subtitle} · {event.days || 1}일
                            </div>
                          </button>
                        )
                      )}
                  </div>
                ) : (
                  <div className="memo-box">
                    이번 달 승인 연차가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {page === 'service' && (
          <>
            <div className="topbar">
              <div>
                <h1>A/S 관리</h1>
                <p>
                  기존 방문 A/S 현황판을 현장, 담당자, 처리 상태 기준으로 관리합니다.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() => {
                  if (serviceFormOpen) {
                    setServiceFormOpen(false)
                    setEditingServiceId(null)
                    setServiceForm(
                      emptyServiceForm()
                    )
                  } else {
                    openNewServiceRequest()
                  }
                }}
              >
                {serviceFormOpen
                  ? '등록 취소'
                  : '+ A/S 접수'}
              </button>
            </div>

            {serviceFormOpen && (
              <form
                className="panel"
                onSubmit={saveServiceRequest}
                style={{
                  marginBottom: '20px',
                }}
              >
                <div className="panel-header">
                  <div>
                    <h2>
                      {editingServiceId
                        ? 'A/S 수정'
                        : 'A/S 접수'}
                    </h2>
                    <p>
                      엑셀에서 관리하던 접수일, 방문일, 요청 내용, 처리 내용, 담당자, 비용을 한 번에 기록합니다.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>접수 유형</label>
                    <select
                      value={serviceForm.requestType}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          requestType: e.target.value,
                        })
                      }
                    >
                      {optionValues('SERVICE_REQUEST_TYPE').map(
                        (value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>접수 경로</label>
                    <select
                      value={serviceForm.intakeChannel}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          intakeChannel: e.target.value,
                        })
                      }
                    >
                      {optionValues('SERVICE_INTAKE_CHANNEL').map(
                        (value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>고객 / 통화자</label>
                    <input
                      value={serviceForm.customerName}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          customerName: e.target.value,
                        })
                      }
                      placeholder="고객 또는 통화자 이름"
                    />
                  </div>

                  <div className="form-field">
                    <label>긴급도</label>
                    <select
                      value={serviceForm.priority}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          priority: e.target.value,
                        })
                      }
                    >
                      {optionValues('SERVICE_PRIORITY').map(
                        (value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>현장 *</label>
                    <select
                      required
                      value={serviceForm.siteId}
                      onChange={(e) => {
                        const siteId =
                          e.target.value

                        const site =
                          sites.find(
                            (item) =>
                              item.id ===
                              Number(siteId)
                          )

                        setServiceForm({
                          ...serviceForm,
                          siteId,
                          contact:
                            serviceForm.contact ||
                            site?.customerPhone ||
                            '',
                        })
                      }}
                    >
                      <option value="">
                        현장을 선택하세요
                      </option>
                      {sites.map((site) => (
                        <option
                          key={site.id}
                          value={site.id}
                        >
                          {site.name}
                          {site.region
                            ? ` · ${site.region}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>상태</label>
                    <select
                      value={serviceForm.status}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          status:
                            e.target.value,
                        })
                      }
                    >
                      {optionValues('SERVICE_STATUS').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>접수일 *</label>
                    <input
                      type="date"
                      required
                      value={serviceForm.receivedDate}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          receivedDate:
                            e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>방문일</label>
                    <input
                      type="date"
                      value={serviceForm.visitDate}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          visitDate:
                            e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-field full">
                    <label>요청 / 증상 내용 *</label>
                    <textarea
                      required
                      value={serviceForm.requestContent}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          requestContent:
                            e.target.value,
                        })
                      }
                      placeholder="예: 8번 타석 그래픽카드/마우스 연결 및 부팅 오류 확인"
                    />
                  </div>

                  <div className="form-field full">
                    <label>처리 내용</label>
                    <textarea
                      value={serviceForm.resolution}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          resolution:
                            e.target.value,
                        })
                      }
                      placeholder="방문 후 실제 처리한 내용을 기록합니다."
                    />
                  </div>

                  <div className="form-field">
                    <label>연락처</label>
                    <input
                      value={serviceForm.contact}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          contact:
                            e.target.value,
                        })
                      }
                      placeholder="010-0000-0000"
                    />
                  </div>

                  <div className="form-field">
                    <label>청구 구분</label>
                    <select
                      value={serviceForm.billingType}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          billingType:
                            e.target.value,
                          billingAmount:
                            e.target.value === '무상'
                              ? 0
                              : serviceForm.billingAmount,
                        })
                      }
                    >
                      {optionValues('BILLING_TYPE').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  {serviceForm.billingType !== '무상' && (
                    <div className="form-field">
                      <label>청구 비용</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={serviceForm.billingAmount}
                        onChange={(e) =>
                          setServiceForm({
                            ...serviceForm,
                            billingAmount:
                              Number(
                                e.target.value
                              ),
                          })
                        }
                        placeholder="100000"
                      />
                    </div>
                  )}

                  <div className="form-field full">
                    <label>담당자</label>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        padding: '10px 0',
                      }}
                    >
                      {teamMembers.map(
                        (member) => {
                          const checked =
                            serviceForm.assigneeIds.includes(
                              member.id
                            )

                          return (
                            <label
                              key={member.id}
                              style={{
                                display:
                                  'inline-flex',
                                alignItems:
                                  'center',
                                gap: '7px',
                                padding:
                                  '8px 11px',
                                border:
                                  checked
                                    ? '1px solid #3b82f6'
                                    : '1px solid #dfe5ec',
                                borderRadius:
                                  '999px',
                                background:
                                  checked
                                    ? '#eff6ff'
                                    : '#fff',
                                cursor:
                                  'pointer',
                                fontSize:
                                  '13px',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  toggleServiceAssignee(
                                    member.id
                                  )
                                }
                              />

                              {member.name}
                              {member.position
                                ? ` · ${member.position}`
                                : ''}
                            </label>
                          )
                        }
                      )}
                    </div>
                  </div>

                  <div className="form-field full">
                    <label>기타 / 메모</label>
                    <textarea
                      value={serviceForm.memo}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          memo:
                            e.target.value,
                        })
                      }
                      placeholder="방문 전 확인사항, 고객 요청, 부품 준비사항 등을 기록합니다."
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setServiceFormOpen(false)
                      setEditingServiceId(null)
                      setServiceForm(
                        emptyServiceForm()
                      )
                    }}
                  >
                    취소
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                  >
                    {editingServiceId
                      ? '수정 저장'
                      : 'A/S 등록'}
                  </button>
                </div>
              </form>
            )}

            <section
              className="summary-grid"
              style={{
                marginBottom: '20px',
              }}
            >
              <div className="summary-card">
                <span>전체 A/S</span>
                <strong>
                  {serviceRequests.length}
                </strong>
                <small>현재 조회된 A/S 건</small>
              </div>

              <div className="summary-card">
                <span>미완료</span>
                <strong>
                  {serviceRequests.filter(
                    (row) =>
                      row.status !== '완료'
                  ).length}
                </strong>
                <small>접수 · 방문 예정 · 처리 중</small>
              </div>

              <div className="summary-card">
                <span>방문 예정</span>
                <strong>
                  {serviceRequests.filter(
                    (row) =>
                      row.status ===
                      '방문 예정'
                  ).length}
                </strong>
                <small>방문 일정이 잡힌 업무</small>
              </div>

              <div className="summary-card">
                <span>완료</span>
                <strong>
                  {serviceRequests.filter(
                    (row) =>
                      row.status === '완료'
                  ).length}
                </strong>
                <small>처리가 끝난 업무</small>
              </div>

              <div className="summary-card">
                <span>유상 청구액</span>
                <strong
                  style={{
                    fontSize: '20px',
                  }}
                >
                  {formatWon(
                    serviceRequests
                      .filter(
                        (row) =>
                          row.billingType ===
                          '유상'
                      )
                      .reduce(
                        (sum, row) =>
                          sum +
                          Number(
                            row.billingAmount ||
                            0
                          ),
                        0
                      )
                  )}
                </strong>
                <small>현재 조회 결과 합계</small>
              </div>
            </section>

            <div className="panel">
              <div
                className="panel-header"
                style={{
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  <h2>방문 A/S 현황</h2>
                  <p>
                    기존 엑셀의 한 행을 하나의 A/S 업무로 관리합니다.
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent:
                      'flex-end',
                  }}
                >
                  <select
                    value={serviceStatusFilter}
                    onChange={(e) =>
                      setServiceStatusFilter(
                        e.target.value
                      )
                    }
                    style={{
                      minWidth: '120px',
                    }}
                  >
                    <option>전체</option>
                    {optionValues('SERVICE_STATUS').map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>

                  <input
                    value={serviceSearch}
                    onChange={(e) =>
                      setServiceSearch(
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadServiceRequests()
                      }
                    }}
                    placeholder="현장 / 주소 / 증상 검색"
                    style={{
                      minWidth: '240px',
                    }}
                  />

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => loadServiceRequests()}
                  >
                    검색
                  </button>
                </div>
              </div>

              <div
                style={{
                  overflowX: 'auto',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    minWidth: '1280px',
                    borderCollapse:
                      'collapse',
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        '접수일',
                        '방문일',
                        '지역',
                        '현장',
                        '요청 / 증상',
                        '처리 내용',
                        '연락처',
                        '담당자',
                        '청구 비용',
                        '상태',
                        '관리',
                      ].map((title) => (
                        <th
                          key={title}
                          style={{
                            padding:
                              '11px 9px',
                            textAlign:
                              'left',
                            fontSize:
                              '12px',
                            whiteSpace:
                              'nowrap',
                            borderBottom:
                              '1px solid #dfe5ec',
                            background:
                              '#f8fafc',
                          }}
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {serviceRequests.length ? (
                      serviceRequests.map(
                        (row) => {
                          const statusStyle =
                            getServiceStatusStyle(
                              row.status
                            )

                          return (
                            <tr key={row.id}>
                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {row.receivedDate?.slice(
                                  0,
                                  10
                                ) || '-'}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {row.visitDate?.slice(
                                  0,
                                  10
                                ) || '-'}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {row.site?.region ||
                                  '-'}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  minWidth:
                                    '190px',
                                }}
                              >
                                <strong>
                                  {row.site?.name ||
                                    '-'}
                                </strong>
                                <div
                                  style={{
                                    marginTop:
                                      '3px',
                                    color:
                                      '#7b8798',
                                    fontSize:
                                      '11px',
                                  }}
                                >
                                  {row.site?.address ||
                                    ''}
                                </div>
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  minWidth:
                                    '260px',
                                  lineHeight:
                                    1.45,
                                }}
                              >
                                {row.requestContent}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  minWidth:
                                    '220px',
                                  lineHeight:
                                    1.45,
                                }}
                              >
                                {row.resolution ||
                                  '-'}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {row.contact ||
                                  '-'}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  minWidth:
                                    '130px',
                                }}
                              >
                                {(row.assignees ||
                                  []).length
                                  ? row.assignees
                                      .map(
                                        (item) =>
                                          item.user
                                            ?.name
                                      )
                                      .filter(
                                        Boolean
                                      )
                                      .join(', ')
                                  : '-'}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {row.billingType ===
                                '무상'
                                  ? '무상'
                                  : `${row.billingType} · ${formatWon(
                                      row.billingAmount
                                    )}`}
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                <span
                                  style={{
                                    display:
                                      'inline-flex',
                                    padding:
                                      '5px 9px',
                                    borderRadius:
                                      '999px',
                                    fontSize:
                                      '12px',
                                    fontWeight:
                                      700,
                                    ...statusStyle,
                                  }}
                                >
                                  {row.status}
                                </span>
                              </td>

                              <td
                                style={{
                                  padding:
                                    '10px 9px',
                                  borderBottom:
                                    '1px solid #eef1f4',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      'flex',
                                    gap: '5px',
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="primary-button"
                                    onClick={() =>
                                      loadServiceDetail(
                                        row
                                      )
                                    }
                                  >
                                    상세
                                  </button>

                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                      editServiceRequest(
                                        row
                                      )
                                    }
                                  >
                                    수정
                                  </button>

                                  {[
                                    'MASTER',
                                    'ADMIN',
                                  ].includes(
                                    currentUser?.role
                                  ) && (
                                    <button
                                      type="button"
                                      className="danger-button"
                                      onClick={() =>
                                        deleteServiceRequest(
                                          row
                                        )
                                      }
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        }
                      )
                    ) : (
                      <tr>
                        <td
                          colSpan="11"
                          style={{
                            padding:
                              '30px',
                            textAlign:
                              'center',
                            color:
                              '#8793a3',
                          }}
                        >
                          등록된 A/S 업무가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {page === 'inventory' && (
          <>
            <div className="topbar">
              <div>
                <h1>재고 관리</h1>
                <p>
                  전체 자재 수량과 입출고 이력을 관리합니다. 업무일지에서 사용한 자재는 자동 출고됩니다.
                </p>
              </div>

              {['MASTER', 'ADMIN'].includes(currentUser?.role) && (
                <button
                  className="primary-button"
                  onClick={() =>
                    setInventoryFormOpen(
                      !inventoryFormOpen
                    )
                  }
                >
                  {inventoryFormOpen
                    ? '등록 취소'
                    : '+ 품목 등록'}
                </button>
              )}
            </div>

            {inventoryFormOpen &&
              ['MASTER', 'ADMIN'].includes(currentUser?.role) && (
                <form
                  className="panel"
                  onSubmit={createInventoryItem}
                  style={{
                    marginBottom: '20px',
                  }}
                >
                  <div className="panel-header">
                    <div>
                      <h2>새 재고 품목</h2>
                      <p>
                        처음 전체 재고를 파악할 때 현재 보유 수량을 초기 재고로 입력하면 됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-field">
                      <label>품목명 *</label>
                      <input
                        required
                        value={inventoryForm.name}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="예: 카드리더기"
                      />
                    </div>

                    <div className="form-field">
                      <label>품목 코드</label>
                      <input
                        value={inventoryForm.code}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            code: e.target.value,
                          })
                        }
                        placeholder="예: CR-001"
                      />
                    </div>

                    <div className="form-field">
                      <label>분류</label>
                      <select
                        value={inventoryForm.category}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            category: e.target.value,
                          })
                        }
                      >
                        {optionValues('INVENTORY_CATEGORY').map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>단위</label>
                      <select
                        value={inventoryForm.unit}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            unit: e.target.value,
                          })
                        }
                      >
                        {optionValues('INVENTORY_UNIT').map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>현재 보유 수량</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={inventoryForm.initialStock}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            initialStock:
                              Number(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>최소 재고</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={inventoryForm.minStock}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            minStock:
                              Number(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>보관 위치</label>
                      <input
                        value={inventoryForm.location}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            location: e.target.value,
                          })
                        }
                        placeholder="예: 창고 A-2"
                      />
                    </div>

                    <div className="form-field">
                      <label>메모</label>
                      <input
                        value={inventoryForm.memo}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            memo: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '15px',
                    }}
                  >
                    <button
                      className="primary-button"
                      type="submit"
                    >
                      품목 등록
                    </button>
                  </div>
                </form>
              )}

            <section
              className="summary-grid"
              style={{
                marginBottom: '20px',
              }}
            >
              <div className="summary-card">
                <span>전체 품목</span>
                <strong>
                  {inventoryItems.length}
                </strong>
                <small>현재 사용 중인 재고 품목</small>
              </div>

              <div className="summary-card">
                <span>전체 수량</span>
                <strong>
                  {inventoryItems.reduce(
                    (sum, item) =>
                      sum + item.currentStock,
                    0
                  )}
                </strong>
                <small>등록 품목 수량 합계</small>
              </div>

              <div className="summary-card danger">
                <span>부족 재고</span>
                <strong>
                  {inventoryItems.filter(
                    (item) =>
                      item.currentStock <=
                      item.minStock
                  ).length}
                </strong>
                <small>최소 재고 이하 품목</small>
              </div>

              <div className="summary-card">
                <span>야간/휴무</span>
                <strong>{asCenterData.summary.afterHours || 0}</strong>
                <small>오늘 업무시간 외 접수</small>
              </div>

              <div className="summary-card danger">
                <span>미확인</span>
                <strong>{asCenterData.summary.unconfirmed || 0}</strong>
                <small>확인이 필요한 미완료 접수</small>
              </div>
            </section>

            <div
              className="panel"
              style={{
                marginBottom: '20px',
              }}
            >
              <div className="panel-header">
                <div>
                  <h2>전체 재고</h2>
                  <p>
                    품목별 현재 수량을 확인합니다.
                  </p>
                </div>

                <input
                  value={inventorySearch}
                  onChange={(e) =>
                    setInventorySearch(
                      e.target.value
                    )
                  }
                  placeholder="품목명 / 코드 / 분류 검색"
                  style={{
                    maxWidth: '280px',
                  }}
                />
              </div>

              <div
                style={{
                  overflowX: 'auto',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        '코드',
                        '품목명',
                        '분류',
                        '현재재고',
                        '최소재고',
                        '위치',
                        '관리',
                      ].map((title) => (
                        <th
                          key={title}
                          style={{
                            textAlign: 'left',
                            padding: '11px',
                            borderBottom:
                              '1px solid #e5e7eb',
                            fontSize: '13px',
                          }}
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {inventoryItems
                      .filter((item) => {
                        const keyword =
                          inventorySearch
                            .trim()
                            .toLowerCase()

                        if (!keyword) return true

                        return [
                          item.code,
                          item.name,
                          item.category,
                          item.location,
                        ].some((value) =>
                          String(value || '')
                            .toLowerCase()
                            .includes(keyword)
                        )
                      })
                      .map((item) => {
                        const stockStatus =
                          item.currentStock <= 0
                            ? {
                                label: '부족',
                                className: 'danger-badge',
                              }
                            : item.currentStock <= item.minStock
                              ? {
                                  label: '주의',
                                  className: 'warning-badge',
                                }
                              : {
                                  label: '정상',
                                  className: 'complete',
                                }

                        return (
                          <tr key={item.id}>
                            <td style={{ padding: '11px', borderBottom: '1px solid #eef1f4' }}>
                              {item.code || '-'}
                            </td>
                            <td style={{ padding: '11px', borderBottom: '1px solid #eef1f4' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <strong>{item.name}</strong>
                                <span
                                  className={`badge ${stockStatus.className}`}
                                >
                                  {stockStatus.label}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '11px', borderBottom: '1px solid #eef1f4' }}>
                              {item.category}
                            </td>
                            <td style={{ padding: '11px', borderBottom: '1px solid #eef1f4' }}>
                              <strong>
                                {item.currentStock}{item.unit}
                              </strong>
                            </td>
                            <td style={{ padding: '11px', borderBottom: '1px solid #eef1f4' }}>
                              {item.minStock}{item.unit}
                            </td>
                            <td style={{ padding: '11px', borderBottom: '1px solid #eef1f4' }}>
                              {item.location || '-'}
                            </td>
                            <td style={{ padding: '11px', borderBottom: '1px solid #eef1f4' }}>
                              {['MASTER', 'ADMIN'].includes(currentUser?.role) ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '5px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                      moveInventory(item, 'IN')
                                    }
                                  >
                                    입고
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                      moveInventory(item, 'OUT')
                                    }
                                  >
                                    출고
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                      editInventoryItem(item)
                                    }
                                  >
                                    설정
                                  </button>
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>최근 입출고 이력</h2>
                  <p>
                    업무일지 자동 출고와 수동 입고/출고 기록이 모두 남습니다.
                  </p>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={loadInventory}
                >
                  새로고침
                </button>
              </div>

              {inventoryTransactions.length ? (
                <div
                  style={{
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  {inventoryTransactions
                    .slice(0, 100)
                    .map((tx) => (
                      <div
                        key={tx.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            '120px minmax(150px, 1.5fr) 90px minmax(180px, 2fr)',
                          gap: '10px',
                          padding: '11px',
                          borderBottom:
                            '1px solid #eef1f4',
                          alignItems: 'center',
                          fontSize: '13px',
                        }}
                      >
                        <span>
                          {tx.createdAt?.slice(0, 10)}
                        </span>

                        <strong>
                          {tx.item?.name || '품목'}
                        </strong>

                        <span
                          style={{
                            fontWeight: 700,
                          }}
                        >
                          {tx.quantity > 0
                            ? `+${tx.quantity}`
                            : tx.quantity}
                          {tx.item?.unit || '개'}
                        </span>

                        <span>
                          {tx.type === 'WORKLOG_OUT'
                            ? `업무일지 자동 출고 · ${tx.user?.name || '-'} · ${tx.site?.name || '현장 미지정'}`
                            : tx.type === 'WORKLOG_RESTORE'
                              ? `업무일지 수정/삭제 복구 · ${tx.user?.name || '-'}`
                              : `${tx.reason || tx.type} · ${tx.user?.name || '-'}`}
                          {' · '}잔여 {tx.balanceAfter}{tx.item?.unit || '개'}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="memo-box">
                  아직 입출고 이력이 없습니다.
                </div>
              )}
            </div>
          </>
        )}


        {page === 'manuals' && (
          <>
            <div className="topbar">
              <div>
                <h1>업무 매뉴얼</h1>
                <p>
                  실제 업무에서 나온 해결 방법을 팀의 공식 매뉴얼로 관리합니다.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={loadManuals}
              >
                새로고침
              </button>
            </div>

            {['MASTER', 'ADMIN'].includes(currentUser?.role) && (
              <div
                className="panel"
                style={{
                  marginBottom: '20px',
                }}
              >
                <div className="panel-header">
                  <div>
                    <h2>
                      매뉴얼 후보 검토
                    </h2>
                    <p>
                      업무일지에서 등록된 해결 방법을 검토해 공식 매뉴얼로 확정합니다.
                    </p>
                  </div>

                  <span className="badge">
                    대기 {manualCandidates.length}건
                  </span>
                </div>

                {manualCandidates.length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                    }}
                  >
                    {manualCandidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        style={{
                          border: '1px solid #e5eaf0',
                          borderRadius: '12px',
                          padding: '15px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '12px',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <strong
                              style={{
                                fontSize: '15px',
                              }}
                            >
                              {candidate.title}
                            </strong>

                            <div
                              style={{
                                fontSize: '12px',
                                color: '#667085',
                                marginTop: '5px',
                              }}
                            >
                              원본 업무일지 · {candidate.workLog?.author?.name || '직원'}
                              {' · '}
                              {candidate.workLog?.workDate?.slice(0, 10) || '-'}
                            </div>

                            {(candidate.workLog?.sites || []).length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '5px',
                                  marginTop: '7px',
                                }}
                              >
                                {candidate.workLog.sites.map((item) => (
                                  <span
                                    key={item.id}
                                    className="badge"
                                  >
                                    {item.site?.name || '현장'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: '6px',
                            }}
                          >
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() =>
                                promoteManualCandidate(candidate)
                              }
                            >
                              매뉴얼 확정
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                rejectManualCandidate(candidate)
                              }
                            >
                              제외
                            </button>
                          </div>
                        </div>

                        {candidate.content && (
                          <div
                            style={{
                              marginTop: '12px',
                              padding: '12px',
                              borderRadius: '9px',
                              background: '#f8fafc',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                              fontSize: '14px',
                            }}
                          >
                            {candidate.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="memo-box">
                    현재 검토할 매뉴얼 후보가 없습니다.
                  </div>
                )}
              </div>
            )}

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>
                    확정된 업무 매뉴얼
                  </h2>
                  <p>
                    모든 직원이 함께 확인하는 공식 업무 지식입니다.
                  </p>
                </div>

                <input
                  value={manualSearch}
                  onChange={(e) =>
                    setManualSearch(e.target.value)
                  }
                  placeholder="매뉴얼 검색"
                  style={{
                    maxWidth: '260px',
                  }}
                />
              </div>

              {manuals.filter((manual) => {
                const keyword =
                  manualSearch
                    .trim()
                    .toLowerCase()

                if (!keyword) return true

                return [
                  manual.title,
                  manual.category,
                  manual.content,
                ].some((value) =>
                  String(value || '')
                    .toLowerCase()
                    .includes(keyword)
                )
              }).length ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '14px',
                  }}
                >
                  {manuals
                    .filter((manual) => {
                      const keyword =
                        manualSearch
                          .trim()
                          .toLowerCase()

                      if (!keyword) return true

                      return [
                        manual.title,
                        manual.category,
                        manual.content,
                      ].some((value) =>
                        String(value || '')
                          .toLowerCase()
                          .includes(keyword)
                      )
                    })
                    .map((manual) => (
                      <div
                        key={manual.id}
                        style={{
                          border: '1px solid #e5eaf0',
                          borderRadius: '12px',
                          padding: '16px',
                          background: '#fff',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '8px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <div>
                            <span className="badge complete">
                              {manual.category || '기타'}
                            </span>

                            <h3
                              style={{
                                margin: '9px 0 5px',
                              }}
                            >
                              {manual.title}
                            </h3>

                            <div
                              style={{
                                fontSize: '12px',
                                color: '#667085',
                              }}
                            >
                              확정자 {manual.createdBy?.name || '-'}
                              {' · '}
                              {manual.updatedAt?.slice(0, 10) || ''}
                            </div>
                          </div>

                          {['MASTER', 'ADMIN'].includes(currentUser?.role) && (
                            <div
                              style={{
                                display: 'flex',
                                gap: '5px',
                              }}
                            >
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => editManual(manual)}
                              >
                                수정
                              </button>

                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => deleteManual(manual)}
                              >
                                삭제
                              </button>
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            marginTop: '13px',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.7,
                            fontSize: '14px',
                          }}
                        >
                          {manual.content || '등록된 상세 내용이 없습니다.'}
                        </div>

                        {manual.sourceCandidate?.workLog && (
                          <div
                            style={{
                              marginTop: '13px',
                              paddingTop: '10px',
                              borderTop: '1px solid #eef1f4',
                              fontSize: '12px',
                              color: '#667085',
                            }}
                          >
                            실제 업무 기록에서 생성 · {manual.sourceCandidate.workLog.author?.name || '직원'}
                            {' · '}
                            {manual.sourceCandidate.workLog.workDate?.slice(0, 10) || '-'}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="memo-box">
                  {manualSearch
                    ? '검색 결과가 없습니다.'
                    : '아직 확정된 업무 매뉴얼이 없습니다.'}
                </div>
              )}
            </div>
          </>
        )}


        {page === 'worklogs' && (
          <>
            <div className="topbar">
              <div>
                <h1>업무일지</h1>
                <p>
                  하루 업무, 미완료 사항, 다음 실행 계획을 팀원과 공유합니다.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() => {
                  if (workLogFormOpen) {
                    resetWorkLogForm()
                  } else {
                    setEditingWorkLogId(null)
                    setWorkLogForm(emptyWorkLogForm())
                    setWorkLogFormOpen(true)
                  }
                }}
              >
                {workLogFormOpen ? '작성 취소' : '+ 오늘 업무일지'}
              </button>
            </div>

            {workLogFormOpen && (
              <form
                className="panel"
                onSubmit={saveWorkLog}
                style={{
                  marginBottom: '20px',
                }}
              >
                <div className="panel-header">
                  <div>
                    <h2>
                      {editingWorkLogId
                        ? '업무일지 수정'
                        : '하루 업무일지 작성'}
                    </h2>
                    <p>
                      내용이 없는 항목은 비워둬도 됩니다.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>업무 날짜 *</label>
                    <input
                      type="date"
                      required
                      value={workLogForm.workDate}
                      onChange={(e) =>
                        setWorkLogForm({
                          ...workLogForm,
                          workDate: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>상태</label>
                    <select
                      value={workLogForm.status}
                      onChange={(e) =>
                        setWorkLogForm({
                          ...workLogForm,
                          status: e.target.value,
                        })
                      }
                    >
                      <option value="SUBMITTED">작성 완료</option>
                      <option value="DRAFT">임시 저장</option>
                    </select>
                  </div>

                  <div className="form-field full">
                    <label>한 줄 제목</label>
                    <input
                      value={workLogForm.title}
                      onChange={(e) =>
                        setWorkLogForm({
                          ...workLogForm,
                          title: e.target.value,
                        })
                      }
                      placeholder="예: 행복아파트 설치 및 네트워크 점검"
                    />
                  </div>

                  <div className="form-field full">
                    <WorkEntriesEditor entries={workLogForm.workEntries} onChange={(workEntries) => setWorkLogForm((prev) => ({ ...prev, workEntries }))} sites={sites} services={workLogServices} error={workLogServicesError} />
                    <label>추가 관련 현장 (위 업무의 현장은 저장 시 자동 연결)</label>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        padding: '10px 0',
                      }}
                    >
                      {sites.length ? (
                        sites.map((site) => (
                          <label
                            key={site.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              border: '1px solid #dbe2ea',
                              borderRadius: '8px',
                              padding: '7px 10px',
                              cursor: 'pointer',
                              background: workLogForm.siteIds.includes(site.id)
                                ? '#eef4ff'
                                : '#fff',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={workLogForm.siteIds.includes(site.id)}
                              onChange={() => toggleWorkLogSite(site.id)}
                            />
                            {site.name}
                          </label>
                        ))
                      ) : (
                        <small>등록된 현장이 없습니다.</small>
                      )}
                    </div>
                  </div>

                  <div className="form-field full">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '8px',
                      }}
                    >
                      <label
                        style={{
                          margin: 0,
                        }}
                      >
                        사용 자재
                      </label>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={addWorkLogMaterial}
                      >
                        + 자재 추가
                      </button>
                    </div>

                    <small
                      style={{
                        display: 'block',
                        marginBottom: '10px',
                        color: '#667085',
                      }}
                    >
                      작성 완료로 저장하면 선택한 자재가 재고에서 자동 차감됩니다. 임시 저장은 차감되지 않습니다.
                    </small>

                    {workLogForm.materials.length ? (
                      <div
                        style={{
                          display: 'grid',
                          gap: '8px',
                        }}
                      >
                        {workLogForm.materials.map((row, index) => {
                          const selectedItem =
                            inventoryItems.find(
                              (item) =>
                                item.id === row.itemId
                            )

                          return (
                            <div
                              key={`${row.itemId}-${index}`}
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'minmax(180px, 2fr) minmax(100px, 1fr) 90px 100px auto',
                                gap: '8px',
                                alignItems: 'center',
                                padding: '10px',
                                border: '1px solid #e5eaf0',
                                borderRadius: '10px',
                              }}
                            >
                              <select
                                value={row.itemId}
                                onChange={(e) =>
                                  updateWorkLogMaterial(
                                    index,
                                    'itemId',
                                    e.target.value
                                  )
                                }
                              >
                                {inventoryItems.map((item) => (
                                  <option
                                    key={item.id}
                                    value={item.id}
                                    disabled={
                                      workLogForm.materials.some(
                                        (other, otherIndex) =>
                                          otherIndex !== index &&
                                          other.itemId === item.id
                                      )
                                    }
                                  >
                                    {item.name} · 재고 {item.currentStock}{item.unit}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={row.usageType}
                                onChange={(e) =>
                                  updateWorkLogMaterial(
                                    index,
                                    'usageType',
                                    e.target.value
                                  )
                                }
                              >
                                {optionValues('MATERIAL_USAGE_TYPE').map((value) => (
                                  <option key={value} value={value}>{value}</option>
                                ))}
                              </select>

                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={row.quantity}
                                onChange={(e) =>
                                  updateWorkLogMaterial(
                                    index,
                                    'quantity',
                                    e.target.value
                                  )
                                }
                              />

                              <span
                                style={{
                                  fontSize: '13px',
                                  color: '#667085',
                                }}
                              >
                                현재 {selectedItem?.currentStock ?? 0}
                                {selectedItem?.unit || '개'}
                              </span>

                              <button
                                type="button"
                                className="danger-button"
                                onClick={() =>
                                  removeWorkLogMaterial(index)
                                }
                              >
                                삭제
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="memo-box">
                        사용한 자재가 없으면 그대로 두면 됩니다.
                      </div>
                    )}
                  </div>

                  {[
                    ['completedWork', '하루 공통 업무 / 요약' , '현장별로 작성한 내용 외의 공통 업무를 적어주세요.'],
                    ['pendingWork', '미완료 / 남은 업무', '아직 끝나지 않은 업무를 적어주세요.'],
                    ['nextPlan', '다음 실행 계획', '내일 또는 다음 방문 때 할 일을 적어주세요.'],
                    ['issues', '문제 / 이슈', '장애, 오류, 특이사항 등을 적어주세요.'],
                    ['handover', '인계 / 공유사항', '다른 직원이 꼭 알아야 할 내용을 적어주세요.'],
                    ['memo', '기타 메모', '그 외 남길 내용을 적어주세요.'],
                  ].map(([key, label, placeholder]) => (
                    <div
                      className="form-field full"
                      key={key}
                    >
                      <label>{label}</label>
                      <textarea
                        value={workLogForm[key]}
                        onChange={(e) =>
                          setWorkLogForm({
                            ...workLogForm,
                            [key]: e.target.value,
                          })
                        }
                        placeholder={placeholder}
                        rows="4"
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          resize: 'vertical',
                          padding: '12px',
                          border: '1px solid #dbe2ea',
                          borderRadius: '8px',
                          font: 'inherit',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}

                  <div className="form-field full">
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={workLogForm.isImportant}
                        onChange={(e) =>
                          setWorkLogForm({
                            ...workLogForm,
                            isImportant: e.target.checked,
                          })
                        }
                      />
                      중요 업무로 표시
                    </label>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetWorkLogForm}
                  >
                    취소
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                  >
                    {editingWorkLogId ? '수정 저장' : '업무일지 저장'}
                  </button>
                </div>
              </form>
            )}

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>팀 업무일지</h2>
                  <p>
                    최근 업무 기록을 모든 팀원이 함께 확인할 수 있습니다.
                  </p>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={loadWorkLogs}
                >
                  새로고침
                </button>
              </div>

              {workLogs.length ? (
                <div
                  style={{
                    display: 'grid',
                    gap: '14px',
                  }}
                >
                  {workLogs.map((log) => {
                    const canEdit =
                      log.authorId === currentUser?.id ||
                      ['MASTER', 'ADMIN'].includes(currentUser?.role)

                    return (
                      <div
                        key={log.id}
                        style={{
                          border: '1px solid #e5eaf0',
                          borderRadius: '12px',
                          padding: '18px',
                          background: log.isImportant
                            ? '#fffdf2'
                            : '#fff',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '14px',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: '16px',
                                }}
                              >
                                {log.author?.name || '직원'}
                              </strong>

                              <span className="badge complete">
                                {log.workDate?.slice(0, 10)}
                              </span>

                              <span className="badge">
                                {log.status === 'DRAFT'
                                  ? '임시 저장'
                                  : '작성 완료'}
                              </span>

                              {log.isImportant && (
                                <span className="badge danger-badge">
                                  중요
                                </span>
                              )}
                            </div>

                            <h3
                              style={{
                                margin: '10px 0 4px',
                              }}
                            >
                              {log.title || '제목 없음'}
                            </h3>

                            {(log.sites || []).length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                  marginTop: '8px',
                                }}
                              >
                                {log.sites.map((item) => (
                                  <span
                                    key={item.id}
                                    className="badge"
                                  >
                                    {item.site?.name || '현장'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: '6px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => addWorkLogComment(log)}
                            >
                              댓글
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => addManualCandidate(log)}
                            >
                              매뉴얼 후보
                            </button>

                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => editWorkLog(log)}
                                >
                                  수정
                                </button>

                                <button
                                  type="button"
                                  className="danger-button"
                                  onClick={() => deleteWorkLog(log)}
                                >
                                  삭제
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '10px',
                            marginTop: '16px',
                          }}
                        >
                          <WorkEntriesRead entries={Array.isArray(log.extraData?.workEntries) ? log.extraData.workEntries : []} onOpen={loadServiceDetail} />
                          {[
                            ['오늘 처리한 업무', log.completedWork],
                            ['미완료 / 남은 업무', log.pendingWork],
                            ['다음 실행 계획', log.nextPlan],
                            ['문제 / 이슈', log.issues],
                            ['인계 / 공유사항', log.handover],
                            ['기타 메모', log.memo],
                          ]
                            .filter(([, value]) => value)
                            .map(([label, value]) => (
                              <div
                                key={label}
                                style={{
                                  background: '#f8fafc',
                                  borderRadius: '10px',
                                  padding: '12px',
                                }}
                              >
                                <strong
                                  style={{
                                    display: 'block',
                                    marginBottom: '6px',
                                    fontSize: '13px',
                                  }}
                                >
                                  {label}
                                </strong>

                                <div
                                  style={{
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.6,
                                    fontSize: '14px',
                                  }}
                                >
                                  {value}
                                </div>
                              </div>
                            ))}
                        </div>

                        {(log.materials || []).length > 0 && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '10px',
                              borderRadius: '9px',
                              background: '#f8fafc',
                              fontSize: '13px',
                            }}
                          >
                            <strong>사용 자재</strong>
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                marginTop: '7px',
                              }}
                            >
                              {log.materials.map((row) => (
                                <span
                                  key={row.id}
                                  className="badge"
                                >
                                  {row.item?.name || '자재'} {row.quantity}{row.item?.unit || '개'} · {row.usageType}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {(log.comments || []).length > 0 && (
                          <div
                            style={{
                              marginTop: '14px',
                              borderTop: '1px solid #eef1f4',
                              paddingTop: '12px',
                            }}
                          >
                            <strong
                              style={{
                                fontSize: '13px',
                              }}
                            >
                              댓글
                            </strong>

                            {(log.comments || []).map((comment) => (
                              <div
                                key={comment.id}
                                style={{
                                  marginTop: '8px',
                                  fontSize: '13px',
                                  lineHeight: 1.5,
                                }}
                              >
                                <strong>
                                  {comment.author?.name || '직원'}
                                </strong>
                                {' · '}
                                {comment.content}
                              </div>
                            ))}
                          </div>
                        )}

                        {(log.manualCandidates || []).length > 0 && (
                          <div
                            style={{
                              marginTop: '10px',
                              fontSize: '12px',
                              color: '#667085',
                            }}
                          >
                            매뉴얼 후보 등록됨 · {log.manualCandidates.length}건
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="memo-box">
                  아직 등록된 업무일지가 없습니다.
                </div>
              )}
            </div>
          </>
        )}


        {page === 'leave' && (
          <>
            <div className="topbar">
              <div>
                <h1>연차 관리</h1>
                <p>
                  직원 연차 일정을 캘린더에서 확인하고 내 잔여 연차를 관리합니다.
                </p>
              </div>

              <div className="top-user">
                {currentUser?.name || '김대리'} · {currentUser?.department || 'CS팀'}
              </div>
            </div>

            <section className="summary-grid">
              <div className="summary-card">
                <span>{leaveYear}년 부여 연차</span>
                <strong>{leaveSummary.grantedDays}</strong>
                <small>총 연차 일수</small>
              </div>

              <div className="summary-card">
                <span>사용 연차</span>
                <strong>{leaveSummary.usedDays}</strong>
                <small>현재까지 사용</small>
              </div>

              <div className="summary-card">
                <span>승인 대기</span>
                <strong>{leaveSummary.pendingDays || 0}</strong>
                <small>동의 진행 중</small>
              </div>

              <div className="summary-card">
                <span>남은 연차</span>
                <strong>{leaveSummary.remainingDays}</strong>
                <small>
                  실제 추가 신청 가능 {leaveSummary.availableDays ?? leaveSummary.remainingDays}일
                </small>
              </div>
            </section>

            <div
              className="detail-grid"
              style={{ marginBottom: '20px' }}
            >
              <form
                className="panel"
                onSubmit={registerLeave}
              >
                <div className="panel-header">
                  <div>
                    <h2>연차 신청</h2>
                    <p>
                      반차는 사용 일수에 0.5를 입력하면 됩니다.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>시작일</label>
                    <input
                      type="date"
                      required
                      value={newLeave.startDate}
                      onChange={(e) =>
                        setNewLeave({
                          ...newLeave,
                          startDate: e.target.value,
                          endDate:
                            newLeave.endDate || e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>종료일</label>
                    <input
                      type="date"
                      required
                      value={newLeave.endDate}
                      onChange={(e) =>
                        setNewLeave({
                          ...newLeave,
                          endDate: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>종류</label>
                    <select
                      value={newLeave.leaveType}
                      onChange={(e) =>
                        setNewLeave({
                          ...newLeave,
                          leaveType: e.target.value,
                        })
                      }
                    >
                      {optionValues('LEAVE_TYPE').map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>사용 일수</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={newLeave.days}
                      onChange={(e) =>
                        setNewLeave({
                          ...newLeave,
                          days: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-field full">
                    <label>메모</label>
                    <input
                      value={newLeave.reason}
                      onChange={(e) =>
                        setNewLeave({
                          ...newLeave,
                          reason: e.target.value,
                        })
                      }
                      placeholder="선택 입력"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    className="primary-button"
                    type="submit"
                  >
                    연차 신청
                  </button>
                </div>
              </form>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>내 연차 내역</h2>
                    <p>{leaveYear}년 사용 내역</p>
                  </div>
                </div>

                <div className="file-list">
                  {leaveSummary.requests?.length ? (
                    leaveSummary.requests.map((item) => (
                      <div
                        className="file-item"
                        key={item.id}
                      >
                        <div className="file-info">
                          <strong>
                            {item.leaveType} · {item.days}일
                          </strong>

                          <small>
                            {item.startDate.slice(0, 10)}
                            {' ~ '}
                            {item.endDate.slice(0, 10)}
                          </small>

                          <small>
                            상태: {getLeaveStatusText(item.status)}
                            {item.status === 'PENDING' && item.agreements?.length
                              ? ` · 동의 ${getAgreementProgress(item).agreed}/${getAgreementProgress(item).total}`
                              : ''}
                          </small>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: '6px',
                          }}
                        >
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => startEditLeave(item)}
                          >
                            수정
                          </button>

                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => cancelLeave(item.id)}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="memo-box">
                      연차 신청 내역이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="panel"
              style={{ marginBottom: '20px' }}
            >
              <div className="panel-header">
                <div>
                  <h2>팀 연차 동의 대기</h2>
                  <p>
                    내가 동의해야 하는 다른 직원의 연차 신청입니다.
                  </p>
                </div>
              </div>

              <div className="file-list">
                {pendingLeaveRequests.length ? (
                  pendingLeaveRequests.map((request) => {
                    const progress = getAgreementProgress(request)

                    return (
                      <div
                        className="file-item"
                        key={request.id}
                      >
                        <div className="file-info">
                          <strong>
                            {request.user?.name || '직원'} · {request.leaveType} · {request.days}일
                          </strong>

                          <small>
                            {request.startDate.slice(0, 10)}
                            {' ~ '}
                            {request.endDate.slice(0, 10)}
                          </small>

                          <small>
                            동의 진행 {progress.agreed}/{progress.total}
                            {request.reason ? ` · ${request.reason}` : ''}
                          </small>
                        </div>

                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => agreeLeave(request.id)}
                        >
                          동의
                        </button>
                      </div>
                    )
                  })
                ) : (
                  <div className="memo-box">
                    현재 내가 동의할 연차 신청이 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>직원 연차 캘린더</h2>
                  <p>
                    승인된 연차가 전 직원에게 표시됩니다.
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                  }}
                >
                  <select
                    value={leaveYear}
                    onChange={(e) =>
                      setLeaveYear(Number(e.target.value))
                    }
                  >
                    {[leaveYear - 1, leaveYear, leaveYear + 1].map(
                      (year) => (
                        <option
                          key={year}
                          value={year}
                        >
                          {year}년
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={leaveMonth}
                    onChange={(e) =>
                      setLeaveMonth(Number(e.target.value))
                    }
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map(
                      (month) => (
                        <option
                          key={month}
                          value={month}
                        >
                          {month}월
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="leave-calendar">
                {['일', '월', '화', '수', '목', '금', '토'].map(
                  (day) => (
                    <div
                      className="leave-calendar-head"
                      key={day}
                    >
                      {day}
                    </div>
                  )
                )}

                {getCalendarCells().map((date, index) => (
                  <div
                    className={`leave-calendar-cell ${
                      !date ? 'empty' : ''
                    }`}
                    key={`${leaveYear}-${leaveMonth}-${index}`}
                  >
                    {date && (
                      <>
                        <div className="leave-calendar-date">
                          {date.getDate()}
                        </div>

                        <div className="leave-calendar-items">
                          {getLeavesForDate(date).map((item) => (
                            <div
                              className="leave-calendar-item"
                              key={`${item.id}-${date.getDate()}`}
                            >
                              <strong>
                                {item.user?.name || '직원'}
                              </strong>
                              <span>{item.leaveType}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}


            {editingLeave && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: '20px',
                }}
              >
                <div
                  className="panel"
                  style={{
                    width: '520px',
                    maxWidth: '100%',
                  }}
                >
                  <div className="panel-header">
                    <div>
                      <h2>연차 수정</h2>
                      <p>등록된 연차 정보를 수정합니다.</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-field">
                      <label>시작일</label>
                      <input
                        type="date"
                        value={editingLeave.startDate}
                        onChange={(e) =>
                          setEditingLeave({
                            ...editingLeave,
                            startDate: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>종료일</label>
                      <input
                        type="date"
                        value={editingLeave.endDate}
                        onChange={(e) =>
                          setEditingLeave({
                            ...editingLeave,
                            endDate: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>종류</label>
                      <select
                        value={editingLeave.leaveType}
                        onChange={(e) =>
                          setEditingLeave({
                            ...editingLeave,
                            leaveType: e.target.value,
                          })
                        }
                      >
                        {optionValues('LEAVE_TYPE').map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>사용 일수</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={editingLeave.days}
                        onChange={(e) =>
                          setEditingLeave({
                            ...editingLeave,
                            days: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="form-field full">
                      <label>메모</label>
                      <input
                        value={editingLeave.reason}
                        onChange={(e) =>
                          setEditingLeave({
                            ...editingLeave,
                            reason: e.target.value,
                          })
                        }
                        placeholder="선택 입력"
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditingLeave(null)}
                    >
                      취소
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={saveEditLeave}
                    >
                      수정 저장
                    </button>
                  </div>
                </div>
              </div>
            )}


        {page === 'users' && ['MASTER', 'ADMIN'].includes(currentUser?.role) && (
          <>
            <div className="topbar">
              <div>
                <h1>직원 관리</h1>
                <p>
                  직원 계정, 권한, 활성 상태를 관리합니다.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() => {
                  setEditingUserId(null)
                  setUserFormMode(!userFormMode)
                  setNewUser({
                    username: '',
                    password: '',
                    name: '',
                    department: 'CS팀',
                    position: '',
                    phone: '',
                    email: '',
                    role: 'USER',
                    grantedDays: '15',
                  })
                }}
              >
                {userFormMode ? '등록 취소' : '+ 직원 등록'}
              </button>
            </div>

            {userFormMode && (
              <form
                className="panel site-form"
                onSubmit={saveUser}
                style={{ marginBottom: '20px' }}
              >
                <div className="form-section-title">
                  <h2>
                    {editingUserId ? '직원 정보 수정' : '신규 직원 등록'}
                  </h2>
                </div>

                <div className="form-grid">
                  {!editingUserId && (
                    <>
                      <FormInput
                        label="아이디"
                        required
                        value={newUser.username}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            username: e.target.value,
                          })
                        }
                      />

                      <FormInput
                        label="초기 비밀번호"
                        required
                        type="password"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            password: e.target.value,
                          })
                        }
                      />
                    </>
                  )}

                  <FormInput
                    label="이름"
                    required
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        name: e.target.value,
                      })
                    }
                  />

                  <FormInput
                    label="부서"
                    value={newUser.department}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        department: e.target.value,
                      })
                    }
                  />

                  <FormInput
                    label="직급"
                    value={newUser.position}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        position: e.target.value,
                      })
                    }
                  />

                  <FormInput
                    label="휴대전화"
                    value={newUser.phone}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        phone: e.target.value,
                      })
                    }
                  />

                  <FormInput
                    label="이메일"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        email: e.target.value,
                      })
                    }
                  />

                  <div className="form-field">
                    <label>권한</label>

                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          role: e.target.value,
                        })
                      }
                    >
                      <option value="USER">USER</option>

                      {currentUser?.role === 'MASTER' && (
                        <option value="ADMIN">ADMIN</option>
                      )}

                      {currentUser?.role === 'MASTER' && (
                        <option value="MASTER">MASTER</option>
                      )}
                    </select>
                  </div>

                  {!editingUserId && (
                    <FormInput
                      label="올해 부여 연차"
                      type="number"
                      step="0.5"
                      min="0"
                      value={newUser.grantedDays}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          grantedDays: e.target.value,
                        })
                      }
                    />
                  )}
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="primary-button"
                  >
                    {editingUserId ? '수정 저장' : '직원 등록'}
                  </button>
                </div>
              </form>
            )}

            <div className="panel">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>아이디</th>
                      <th>부서</th>
                      <th>직급</th>
                      <th>권한</th>
                      <th>상태</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.name}</strong>
                        </td>
                        <td>{user.username}</td>
                        <td>{user.department || '-'}</td>
                        <td>{user.position || '-'}</td>
                        <td>{user.role}</td>
                        <td>
                          <span
                            className={`badge ${
                              user.isActive ? 'complete' : 'danger-badge'
                            }`}
                          >
                            {user.isActive ? '사용중' : '비활성'}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              gap: '6px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => editUser(user)}
                            >
                              수정
                            </button>

                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => resetUserPassword(user)}
                            >
                              비밀번호 초기화
                            </button>

                            {user.id !== currentUser?.id && (
                              <button
                                className={
                                  user.isActive
                                    ? 'danger-button'
                                    : 'detail-button'
                                }
                                type="button"
                                onClick={() => toggleUserActive(user)}
                              >
                                {user.isActive ? '비활성화' : '활성화'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}


        {page === 'service-detail' &&
          selectedService && (
          <>
            <div className="topbar">
              <div>
                <button
                  type="button"
                  className="back-button"
                  onClick={() => setPage('service')}
                >
                  ← A/S 목록
                </button>

                <h1>
                  A/S #{selectedService.id} · {selectedService.site?.name}
                </h1>

                <p>
                  접수부터 현장 처리, 체크리스트, 사진, 사용 자재, 업무일지까지 한 화면에서 처리합니다.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    padding: '7px 11px',
                    borderRadius: '999px',
                    background:
                      selectedService.status === '완료'
                        ? '#e8f7ef'
                        : '#fff0e5',
                    color:
                      selectedService.status === '완료'
                        ? '#16794c'
                        : '#b94b10',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {selectedService.status}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={saveServiceOfflineDraft}
                >
                  기기 임시저장
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
                marginBottom: '18px',
              }}
            >
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>현장 / 접수 정보</h2>
                    <p>현장 방문에 필요한 기본 정보입니다.</p>
                  </div>
                </div>

                <div className="info-grid">
                  <InfoItem
                    label="현장"
                    value={selectedService.site?.name || '-'}
                  />
                  <InfoItem
                    label="지역"
                    value={selectedService.site?.region || selectedService.site?.area || '-'}
                  />
                  <InfoItem
                    label="주소"
                    value={selectedService.site?.address || '-'}
                  />
                  <InfoItem
                    label="연락처"
                    value={selectedService.contact || selectedService.site?.customerPhone || '-'}
                  />
                  <InfoItem
                    label="접수일"
                    value={selectedService.receivedDate?.slice(0, 10) || '-'}
                  />
                  <InfoItem
                    label="방문일"
                    value={selectedService.visitDate?.slice(0, 10) || '-'}
                  />
                  <InfoItem
                    label="담당자"
                    value={
                      (selectedService.assignees || [])
                        .map((row) => row.user?.name)
                        .filter(Boolean)
                        .join(', ') || '-'
                    }
                  />
                  <InfoItem
                    label="청구"
                    value={
                      selectedService.billingType === '무상'
                        ? '무상'
                        : `${selectedService.billingType} · ${formatWon(
                            selectedService.billingAmount
                          )}`
                    }
                  />
                </div>

                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#f7f9fc',
                  }}
                >
                  <strong
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '12px',
                    }}
                  >
                    요청 / 증상
                  </strong>
                  <div
                    style={{
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedService.requestContent}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>현장 장비</h2>
                    <p>
                      해당 현장에 등록된 장비대장입니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setAssetSiteFilter(
                        String(selectedService.siteId)
                      )
                      setPage('assets')
                    }}
                  >
                    장비대장 열기
                  </button>
                </div>

                {(selectedService.site?.assets || []).length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {selectedService.site.assets
                      .slice(0, 8)
                      .map((asset) => (
                        <div
                          key={asset.id}
                          style={{
                            padding: '10px 11px',
                            border: '1px solid #e4e9ef',
                            borderRadius: '9px',
                          }}
                        >
                          <strong>
                            {asset.assetType}
                            {asset.model
                              ? ` · ${asset.model}`
                              : ''}
                          </strong>
                          <div
                            style={{
                              marginTop: '4px',
                              color: '#718096',
                              fontSize: '11px',
                            }}
                          >
                            {asset.assetCode}
                            {asset.serialNumber
                              ? ` · S/N ${asset.serialNumber}`
                              : ''}
                            {asset.status
                              ? ` · ${asset.status}`
                              : ''}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="memo-box">
                    아직 등록된 현장 장비가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(0, 1fr) minmax(300px, 0.9fr)',
                gap: '16px',
                marginBottom: '18px',
              }}
            >
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>A/S 체크리스트</h2>
                    <p>
                      현장에서 확인할 표준 작업 항목입니다.
                    </p>
                  </div>

                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#44546a',
                    }}
                  >
                    {
                      (selectedService.checklistItems || [])
                        .filter((item) => item.checked)
                        .length
                    }
                    /
                    {
                      (selectedService.checklistItems || [])
                        .length
                    }
                  </span>
                </div>

                {(selectedService.checklistItems || []).length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {selectedService.checklistItems.map((item) => (
                      <label
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 11px',
                          border: '1px solid #e5eaf0',
                          borderRadius: '9px',
                          background:
                            item.checked
                              ? '#f1fbf5'
                              : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(item.checked)}
                          onChange={(e) =>
                            toggleServiceChecklist(
                              item,
                              e.target.checked
                            )
                          }
                          style={{
                            marginTop: '3px',
                          }}
                        />

                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <strong
                            style={{
                              fontSize: '13px',
                              textDecoration:
                                item.checked
                                  ? 'line-through'
                                  : 'none',
                            }}
                          >
                            {item.label}
                          </strong>

                          {item.checkedBy?.name && (
                            <div
                              style={{
                                marginTop: '3px',
                                color: '#738095',
                                fontSize: '10px',
                              }}
                            >
                              {item.checkedBy.name} · {formatDateTime(item.checkedAt)}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="memo-box">
                    등록된 체크리스트가 없습니다.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>사진 / 파일</h2>
                    <p>
                      작업 전후 사진이나 문서를 A/S에 직접 연결합니다.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '8px',
                    marginBottom: '14px',
                  }}
                >
                  <select
                    value={serviceAttachmentKind}
                    onChange={(e) =>
                      setServiceAttachmentKind(
                        e.target.value
                      )
                    }
                  >
                    {optionValues('SERVICE_ATTACHMENT_KIND').map(
                      (value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      )
                    )}
                  </select>

                  <input
                    id="service-attachment-input"
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    capture="environment"
                    onChange={(e) =>
                      setServiceAttachmentFile(
                        e.target.files?.[0] || null
                      )
                    }
                  />

                  <button
                    type="button"
                    className="primary-button"
                    onClick={uploadServiceAttachment}
                  >
                    파일/사진 업로드
                  </button>
                </div>

                {(selectedService.files || []).length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {selectedService.files.map((link) => (
                      <div
                        key={link.id}
                        style={{
                          padding: '9px 10px',
                          border: '1px solid #e5eaf0',
                          borderRadius: '8px',
                        }}
                      >
                        {link.file?.mimeType?.startsWith('image/') && (
                          <img
                            src={`${API_URL}/api/files/${link.file.id}/download`}
                            alt={link.file.originalName}
                            style={{
                              width: '100%',
                              maxHeight: '160px',
                              objectFit: 'cover',
                              borderRadius: '7px',
                              marginBottom: '8px',
                            }}
                          />
                        )}

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                          }}
                        >
                          <span
                            style={{
                              padding: '3px 6px',
                              borderRadius: '999px',
                              background: '#eef3f8',
                              fontSize: '10px',
                              fontWeight: 800,
                            }}
                          >
                            {link.kind}
                          </span>

                          <a
                            href={`${API_URL}/api/files/${link.file.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {link.file.originalName}
                          </a>

                          <button
                            type="button"
                            className="danger-button"
                            onClick={() =>
                              deleteServiceAttachment(link.id)
                            }
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="memo-box">
                    아직 첨부된 사진/파일이 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="panel section-gap">
              <div className="panel-header">
                <div>
                  <h2>A/S 처리 완료</h2>
                  <p>
                    완료 버튼을 누르면 업무일지를 만들고 사용 자재를 재고에서 자동 차감합니다.
                  </p>
                </div>

                {selectedService.workLogId && (
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: '999px',
                      background: '#e8f7ef',
                      color: '#16794c',
                      fontSize: '11px',
                      fontWeight: 800,
                    }}
                  >
                    업무일지 #{selectedService.workLogId} 연동 완료
                  </span>
                )}
              </div>

              <div className="form-grid">
                <div className="form-field full">
                  <label>처리 내용 *</label>
                  <textarea
                    value={serviceCompleteForm.resolution}
                    disabled={Boolean(selectedService.workLogId)}
                    onChange={(e) =>
                      setServiceCompleteForm({
                        ...serviceCompleteForm,
                        resolution: e.target.value,
                      })
                    }
                    placeholder="원인, 조치 내용, 최종 상태를 기록하세요."
                  />
                </div>

                <div className="form-field">
                  <label>청구 구분</label>
                  <select
                    disabled={Boolean(selectedService.workLogId)}
                    value={serviceCompleteForm.billingType}
                    onChange={(e) =>
                      setServiceCompleteForm({
                        ...serviceCompleteForm,
                        billingType: e.target.value,
                        billingAmount:
                          e.target.value === '무상'
                            ? 0
                            : serviceCompleteForm.billingAmount,
                      })
                    }
                  >
                    {optionValues('BILLING_TYPE').map((value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>청구 비용</label>
                  <input
                    type="number"
                    min="0"
                    disabled={
                      selectedService.workLogId ||
                      serviceCompleteForm.billingType === '무상'
                    }
                    value={serviceCompleteForm.billingAmount}
                    onChange={(e) =>
                      setServiceCompleteForm({
                        ...serviceCompleteForm,
                        billingAmount:
                          Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="form-field full">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '8px',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <label
                      style={{
                        margin: 0,
                      }}
                    >
                      사용 자재
                    </label>

                    {!selectedService.workLogId && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={addServiceMaterial}
                      >
                        + 자재 추가
                      </button>
                    )}
                  </div>

                  {serviceCompleteForm.materials.length ? (
                    <div
                      style={{
                        display: 'grid',
                        gap: '8px',
                      }}
                    >
                      {serviceCompleteForm.materials.map(
                        (material, index) => {
                          const item =
                            inventoryItems.find(
                              (row) =>
                                row.id === material.itemId
                            )

                          return (
                            <div
                              key={`${material.itemId}-${index}`}
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'minmax(180px, 1fr) 90px 140px auto',
                                gap: '8px',
                                alignItems: 'center',
                              }}
                            >
                              <select
                                value={material.itemId}
                                onChange={(e) =>
                                  updateServiceMaterial(
                                    index,
                                    'itemId',
                                    e.target.value
                                  )
                                }
                              >
                                {inventoryItems
                                  .filter(
                                    (row) =>
                                      row.isActive !== false
                                  )
                                  .map((row) => (
                                    <option
                                      key={row.id}
                                      value={row.id}
                                    >
                                      {row.name} · 재고 {row.currentStock}{row.unit}
                                    </option>
                                  ))}
                              </select>

                              <input
                                type="number"
                                min="1"
                                max={item?.currentStock || undefined}
                                value={material.quantity}
                                onChange={(e) =>
                                  updateServiceMaterial(
                                    index,
                                    'quantity',
                                    e.target.value
                                  )
                                }
                              />

                              <select
                                value={material.usageType}
                                onChange={(e) =>
                                  updateServiceMaterial(
                                    index,
                                    'usageType',
                                    e.target.value
                                  )
                                }
                              >
                                {optionValues('MATERIAL_USAGE_TYPE').map(
                                  (value) => (
                                    <option
                                      key={value}
                                      value={value}
                                    >
                                      {value}
                                    </option>
                                  )
                                )}
                              </select>

                              <button
                                type="button"
                                className="danger-button"
                                onClick={() =>
                                  removeServiceMaterial(index)
                                }
                              >
                                삭제
                              </button>
                            </div>
                          )
                        }
                      )}
                    </div>
                  ) : (
                    <div className="memo-box">
                      사용 자재가 없으면 추가하지 않아도 됩니다.
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={saveServiceOfflineDraft}
                >
                  임시저장
                </button>

                {!selectedService.workLogId && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={completeServiceRequest}
                  >
                    A/S 완료 + 업무일지/재고 반영
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(0, 1fr) minmax(280px, .8fr)',
                gap: '16px',
                marginTop: '18px',
              }}
            >
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>작업 타임라인</h2>
                    <p>
                      접수, 상태 변경, 첨부, 완료 기록을 시간순으로 확인합니다.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '14px',
                  }}
                >
                  <input
                    value={serviceActivityText}
                    onChange={(e) =>
                      setServiceActivityText(e.target.value)
                    }
                    placeholder="현장 메모 또는 인수인계 내용"
                    style={{
                      flex: 1,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addServiceActivity()
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="primary-button"
                    onClick={addServiceActivity}
                  >
                    메모 추가
                  </button>
                </div>

                {(selectedService.activities || []).length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '9px',
                    }}
                  >
                    {selectedService.activities.map((activity) => (
                      <div
                        key={activity.id}
                        style={{
                          padding: '11px 12px',
                          borderLeft: '3px solid #5b88d6',
                          background: '#f8fafc',
                          borderRadius: '0 8px 8px 0',
                        }}
                      >
                        <strong>
                          {activity.title}
                        </strong>
                        {activity.content && (
                          <div
                            style={{
                              marginTop: '4px',
                              lineHeight: 1.55,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {activity.content}
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: '5px',
                            color: '#8490a2',
                            fontSize: '10px',
                          }}
                        >
                          {activity.user?.name || '시스템'} · {formatDateTime(activity.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="memo-box">
                    아직 기록된 활동이 없습니다.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>오프라인 작업</h2>
                    <p>
                      통신이 불안한 지하/현장에서 사용할 테스트 기능입니다.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background:
                      isOnline
                        ? '#eef9f2'
                        : '#fff5e8',
                    color:
                      isOnline
                        ? '#1d6c43'
                        : '#8a5a00',
                    fontSize: '12px',
                    lineHeight: 1.65,
                  }}
                >
                  현재 상태: <strong>{isOnline ? '온라인' : '오프라인'}</strong>
                  <br />
                  처리 내용과 사용 자재 선택은 “기기 임시저장”으로 보관할 수 있습니다.
                  서버 저장, 파일 업로드, 재고 차감은 다시 온라인이 된 뒤 완료 버튼을 눌러 반영합니다.
                </div>
              </div>
            </div>
          </>
        )}

        {page === 'install-checklist' &&
          installChecklistSite && (
          <>
            <div className="topbar">
              <div>
                <button
                  type="button"
                  className="back-button"
                  onClick={() => setPage('installations')}
                >
                  ← 설치 관리
                </button>

                <h1>
                  설치 체크리스트 · {installChecklistSite.name}
                </h1>

                <p>
                  설치 표준 절차를 현장에서 체크합니다.
                </p>
              </div>

              <span
                style={{
                  padding: '8px 12px',
                  borderRadius: '999px',
                  background: '#eef5ff',
                  color: '#2864c7',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                {installChecklistItems.filter((item) => item.checked).length}
                /
                {installChecklistItems.length} 완료
              </span>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>설치 현장 확인사항</h2>
                  <p>
                    MASTER/ADMIN의 체크리스트 템플릿을 기준으로 자동 생성됩니다.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '9px',
                }}
              >
                {installChecklistItems.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: '11px',
                      alignItems: 'flex-start',
                      padding: '13px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      background:
                        item.checked
                          ? '#f0faf4'
                          : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(item.checked)}
                      onChange={(e) =>
                        toggleInstallChecklist(
                          item,
                          e.target.checked
                        )
                      }
                      style={{
                        marginTop: '3px',
                      }}
                    />

                    <div>
                      <strong>
                        {item.label}
                      </strong>

                      {item.checkedBy?.name && (
                        <div
                          style={{
                            marginTop: '4px',
                            color: '#718096',
                            fontSize: '10px',
                          }}
                        >
                          {item.checkedBy.name} · {formatDateTime(item.checkedAt)}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {page === 'assets' && (
          <>
            <div className="topbar">
              <div>
                <h1>현장 장비 대장</h1>
                <p>
                  현장에 실제 설치된 키오스크, 카메라, 센서, PC 등의 모델과 이력을 관리합니다.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (assetFormOpen) {
                    setAssetFormOpen(false)
                    setEditingAssetId(null)
                    setAssetForm(emptyAssetForm())
                  } else {
                    setAssetFormOpen(true)
                  }
                }}
              >
                {assetFormOpen
                  ? '등록 취소'
                  : '+ 장비 등록'}
              </button>
            </div>

            {assetFormOpen && (
              <form
                className="panel"
                onSubmit={saveAsset}
                style={{
                  marginBottom: '18px',
                }}
              >
                <div className="panel-header">
                  <div>
                    <h2>
                      {editingAssetId
                        ? '장비 수정'
                        : '현장 장비 등록'}
                    </h2>
                    <p>
                      장비별 QR 코드가 자동 생성됩니다.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>현장 *</label>
                    <select
                      required
                      disabled={Boolean(editingAssetId)}
                      value={assetForm.siteId}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          siteId: e.target.value,
                        })
                      }
                    >
                      <option value="">현장 선택</option>
                      {sites.map((site) => (
                        <option
                          key={site.id}
                          value={site.id}
                        >
                          {site.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>장비 종류 *</label>
                    <select
                      required
                      value={assetForm.assetType}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          assetType: e.target.value,
                        })
                      }
                    >
                      <option value="">선택</option>
                      {optionValues('ASSET_TYPE').map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>모델명</label>
                    <input
                      value={assetForm.model}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          model: e.target.value,
                        })
                      }
                      placeholder="예: DSR2-3000T"
                    />
                  </div>

                  <div className="form-field">
                    <label>시리얼 번호</label>
                    <input
                      value={assetForm.serialNumber}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          serialNumber: e.target.value,
                        })
                      }
                      placeholder="S/N"
                    />
                  </div>

                  <div className="form-field">
                    <label>수량</label>
                    <input
                      type="number"
                      min="1"
                      value={assetForm.quantity}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          quantity:
                            Number(e.target.value) || 1,
                        })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>설치일</label>
                    <input
                      type="date"
                      value={assetForm.installedAt}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          installedAt: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>상태</label>
                    <select
                      value={assetForm.status}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          status: e.target.value,
                        })
                      }
                    >
                      {optionValues('ASSET_STATUS').map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>설치 위치</label>
                    <input
                      value={assetForm.location}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          location: e.target.value,
                        })
                      }
                      placeholder="예: 3번 타석"
                    />
                  </div>

                  <div className="form-field full">
                    <label>메모</label>
                    <textarea
                      value={assetForm.memo}
                      onChange={(e) =>
                        setAssetForm({
                          ...assetForm,
                          memo: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="primary-button"
                  >
                    저장
                  </button>
                </div>
              </form>
            )}

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>장비 목록</h2>
                  <p>
                    QR 라벨을 열어 출력하거나 장비에 부착해 테스트할 수 있습니다.
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <select
                    value={assetSiteFilter}
                    onChange={(e) =>
                      setAssetSiteFilter(e.target.value)
                    }
                  >
                    <option value="">전체 현장</option>
                    {sites.map((site) => (
                      <option
                        key={site.id}
                        value={site.id}
                      >
                        {site.name}
                      </option>
                    ))}
                  </select>

                  <input
                    value={assetSearch}
                    onChange={(e) =>
                      setAssetSearch(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadAssets()
                      }
                    }}
                    placeholder="현장 / 모델 / 시리얼 / 코드 검색"
                  />

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={loadAssets}
                  >
                    검색
                  </button>
                </div>
              </div>

              <div
                style={{
                  overflowX: 'auto',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    minWidth: '1200px',
                  }}
                >
                  <thead>
                    <tr>
                      <th>장비코드</th>
                      <th>현장</th>
                      <th>종류</th>
                      <th>모델</th>
                      <th>S/N</th>
                      <th>수량</th>
                      <th>설치일</th>
                      <th>위치</th>
                      <th>상태</th>
                      <th>관리</th>
                    </tr>
                  </thead>

                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <strong>{asset.assetCode}</strong>
                        </td>
                        <td>{asset.site?.name || '-'}</td>
                        <td>{asset.assetType}</td>
                        <td>{asset.model || '-'}</td>
                        <td>{asset.serialNumber || '-'}</td>
                        <td>{asset.quantity}</td>
                        <td>
                          {asset.installedAt?.slice(0, 10) || '-'}
                        </td>
                        <td>{asset.location || '-'}</td>
                        <td>{asset.status}</td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              gap: '5px',
                            }}
                          >
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                window.open(
                                  `${API_URL}/api/assets/${asset.id}/qr.svg`,
                                  '_blank'
                                )
                              }
                            >
                              QR
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => editAsset(asset)}
                            >
                              수정
                            </button>

                            {['MASTER', 'ADMIN'].includes(
                              currentUser?.role
                            ) && (
                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => deleteAsset(asset)}
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!assets.length && (
                <div className="memo-box">
                  등록된 장비가 없습니다.
                </div>
              )}
            </div>
          </>
        )}

        {page === 'dispatch' && (
          <>
            <div className="topbar">
              <div>
                <h1>팀 배차판</h1>
                <p>
                  하루의 설치 · A/S · 연차를 직원별로 한 번에 확인합니다.
                </p>
              </div>

              <input
                type="date"
                value={dispatchDate}
                onChange={(e) =>
                  setDispatchDate(e.target.value)
                }
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '14px',
              }}
            >
              {(dispatchData.members || []).map((member) => (
                <div
                  key={member.id}
                  className="panel"
                  style={{
                    borderTop:
                      member.leave
                        ? '4px solid #8b6bd6'
                        : '4px solid #4f83d6',
                  }}
                >
                  <div className="panel-header">
                    <div>
                      <h2>{member.name}</h2>
                      <p>
                        {member.position || member.department || '-'}
                      </p>
                    </div>

                    {member.leave && (
                      <span
                        style={{
                          padding: '5px 8px',
                          borderRadius: '999px',
                          background: '#f1edff',
                          color: '#6242b8',
                          fontSize: '10px',
                          fontWeight: 800,
                        }}
                      >
                        {member.leave.leaveType}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {(member.installations || []).map((item) => (
                      <div
                        key={`install-${item.id}`}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          background: '#eaf2ff',
                          color: '#245fc5',
                        }}
                      >
                        <strong>설치 · {item.title}</strong>
                        <div
                          style={{
                            marginTop: '3px',
                            fontSize: '11px',
                          }}
                        >
                          {item.region || '-'} · {item.status}
                        </div>
                      </div>
                    ))}

                    {(member.services || []).map((service) => (
                      <button
                        key={`service-${service.id}`}
                        type="button"
                        onClick={() =>
                          loadServiceDetail(service.id)
                        }
                        style={{
                          padding: '10px',
                          border: 0,
                          borderRadius: '8px',
                          background: '#fff0e5',
                          color: '#a94913',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <strong>
                          A/S · {service.site?.name}
                        </strong>
                        <div
                          style={{
                            marginTop: '3px',
                            fontSize: '11px',
                          }}
                        >
                          {service.status} · {service.requestContent}
                        </div>
                      </button>
                    ))}

                    {!member.leave &&
                      !(member.installations || []).length &&
                      !(member.services || []).length && (
                        <div className="memo-box">
                          등록된 일정 없음
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {(
              (dispatchData.unassigned?.services || []).length ||
              (dispatchData.unassigned?.installations || []).length
            ) > 0 && (
              <div
                className="panel section-gap"
                style={{
                  marginTop: '18px',
                }}
              >
                <div className="panel-header">
                  <div>
                    <h2>담당자 미배정</h2>
                    <p>
                      일정은 잡혔지만 담당자가 없는 업무입니다.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  {(dispatchData.unassigned?.services || []).map(
                    (service) => (
                      <button
                        key={`unassigned-service-${service.id}`}
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          loadServiceDetail(service.id)
                        }
                        style={{
                          textAlign: 'left',
                        }}
                      >
                        A/S · {service.site?.name} · {service.status}
                      </button>
                    )
                  )}

                  {(dispatchData.unassigned?.installations || []).map(
                    (item) => (
                      <div
                        key={`unassigned-install-${item.id}`}
                        className="memo-box"
                      >
                        설치 · {item.title} · {item.status}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {page === 'alerts' && (
          <>
            <div className="topbar">
              <div>
                <h1>알림 센터</h1>
                <p>
                  미처리 A/S, 가까운 일정, 재고 부족, 연차 동의를 자동으로 모아봅니다.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {alertsData.unreadCount > 0 && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={markAllAlertsRead}
                  >
                    모두 읽음
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => loadAlerts(false)}
                >
                  새로고침
                </button>
              </div>
            </div>

            <section
              className="summary-grid"
              style={{
                marginBottom: '18px',
              }}
            >
              <div className="summary-card">
                <span>전체 알림</span>
                <strong>{alertsData.alerts?.length || 0}</strong>
                <small>현재 확인할 항목</small>
              </div>

              <div className="summary-card">
                <span>새 알림</span>
                <strong>{alertsData.unreadCount || 0}</strong>
                <small>아직 확인하지 않은 접수</small>
              </div>

              <div className="summary-card">
                <span>긴급</span>
                <strong>
                  {(alertsData.alerts || []).filter(
                    (alert) => alert.level === 'danger'
                  ).length}
                </strong>
                <small>기한 초과 / 재고 0 등</small>
              </div>

              <div className="summary-card">
                <span>주의</span>
                <strong>
                  {(alertsData.alerts || []).filter(
                    (alert) => alert.level === 'warning'
                  ).length}
                </strong>
                <small>재고 부족 / 동의 대기</small>
              </div>
            </section>

            <div
              style={{
                display: 'grid',
                gap: '10px',
              }}
            >
              {(alertsData.alerts || []).map((alert) => {
                const palette =
                  alert.level === 'danger'
                    ? {
                        bg: '#fff0f0',
                        border: '#ffc5c5',
                        color: '#b52b2b',
                      }
                    : alert.level === 'warning'
                      ? {
                          bg: '#fff8e8',
                          border: '#f5d99d',
                          color: '#8a5a00',
                        }
                      : {
                          bg: '#eef5ff',
                          border: '#c8dcff',
                          color: '#285fb8',
                        }

                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() =>
                      openAlertTarget(alert)
                    }
                    style={{
                      width: '100%',
                      padding: '13px 14px',
                      border: `1px solid ${palette.border}`,
                      borderRadius: '10px',
                      background: palette.bg,
                      color: palette.color,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong>{alert.title}</strong>

                      {alert.isRead === false && (
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '999px',
                            background: '#e53e3e',
                            color: '#fff',
                            fontSize: '9px',
                            fontWeight: 900,
                          }}
                        >
                          NEW
                        </span>
                      )}

                      {alert.createdAt && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            opacity: .7,
                            fontSize: '9px',
                          }}
                        >
                          {formatDateTime(alert.createdAt)}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {alert.message}
                    </div>
                  </button>
                )
              })}

              {!alertsData.alerts?.length && (
                <div className="panel">
                  <div className="memo-box">
                    현재 특별히 확인할 알림이 없습니다.
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {page === 'kpi' &&
          ['MASTER', 'ADMIN'].includes(currentUser?.role) && (
          <>
            <div className="topbar">
              <div>
                <h1>통계 / KPI</h1>
                <p>
                  A/S 처리, 설치, 유상 청구, 재고, 직원 업무량을 기간별로 확인합니다.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '7px',
                  flexWrap: 'wrap',
                }}
              >
                <input
                  type="date"
                  value={kpiFrom}
                  onChange={(e) =>
                    setKpiFrom(e.target.value)
                  }
                />
                <span
                  style={{
                    alignSelf: 'center',
                  }}
                >
                  ~
                </span>
                <input
                  type="date"
                  value={kpiTo}
                  onChange={(e) =>
                    setKpiTo(e.target.value)
                  }
                />
                <button
                  type="button"
                  className="primary-button"
                  onClick={loadKpi}
                >
                  조회
                </button>
              </div>
            </div>

            {kpiData && (
              <>
                <section
                  className="summary-grid"
                  style={{
                    marginBottom: '18px',
                  }}
                >
                  <div className="summary-card">
                    <span>A/S 접수</span>
                    <strong>{kpiData.summary.serviceCount}</strong>
                    <small>선택 기간 전체</small>
                  </div>

                  <div className="summary-card">
                    <span>A/S 완료율</span>
                    <strong>{kpiData.summary.completionRate}%</strong>
                    <small>
                      완료 {kpiData.summary.completedServiceCount}건
                    </small>
                  </div>

                  <div className="summary-card">
                    <span>평균 처리시간</span>
                    <strong>
                      {kpiData.summary.avgCompletionHours}h
                    </strong>
                    <small>접수 → 완료 기준</small>
                  </div>

                  <div className="summary-card">
                    <span>설치</span>
                    <strong>{kpiData.summary.installationCount}</strong>
                    <small>설치 시작일 기준</small>
                  </div>

                  <div className="summary-card">
                    <span>유상 청구</span>
                    <strong
                      style={{
                        fontSize: '20px',
                      }}
                    >
                      {formatWon(kpiData.summary.billingAmount)}
                    </strong>
                    <small>무상 제외 합계</small>
                  </div>

                  <div className="summary-card">
                    <span>재고 부족 품목</span>
                    <strong>{kpiData.summary.lowStockCount}</strong>
                    <small>최소 재고 이하</small>
                  </div>
                </section>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>A/S 많은 현장 TOP 10</h2>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: '8px',
                      }}
                    >
                      {kpiData.topServiceSites.map((row, index) => (
                        <div
                          key={row.name}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: '9px 10px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                          }}
                        >
                          <span>
                            {index + 1}. {row.name}
                          </span>
                          <strong>{row.count}건</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>사용 자재 TOP 10</h2>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: '8px',
                      }}
                    >
                      {kpiData.topMaterials.map((row, index) => (
                        <div
                          key={row.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '10px',
                            padding: '9px 10px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                          }}
                        >
                          <span>
                            {index + 1}. {row.name}
                          </span>
                          <strong>
                            {row.quantity}{row.unit}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className="panel"
                  style={{
                    marginTop: '16px',
                  }}
                >
                  <div className="panel-header">
                    <div>
                      <h2>직원별 업무 현황</h2>
                      <p>
                        단순 실적 평가가 아니라 업무량 파악용 테스트 통계입니다.
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      overflowX: 'auto',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        minWidth: '700px',
                      }}
                    >
                      <thead>
                        <tr>
                          <th>직원</th>
                          <th>A/S 배정</th>
                          <th>A/S 완료</th>
                          <th>업무일지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiData.users.map((row) => (
                          <tr key={row.id}>
                            <td><strong>{row.name}</strong></td>
                            <td>{row.serviceCount}</td>
                            <td>{row.completedServiceCount}</td>
                            <td>{row.workLogCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {page === 'checklist-templates' &&
          ['MASTER', 'ADMIN'].includes(currentUser?.role) && (
          <>
            <div className="topbar">
              <div>
                <h1>체크리스트 관리</h1>
                <p>
                  A/S와 설치의 표준 작업 절차를 템플릿으로 관리합니다.
                </p>
              </div>
            </div>

            <form
              className="panel"
              onSubmit={saveChecklistTemplate}
              style={{
                marginBottom: '18px',
              }}
            >
              <div className="panel-header">
                <div>
                  <h2>새 체크리스트 템플릿</h2>
                  <p>
                    한 줄에 하나씩 체크할 항목을 입력하세요.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>업무 종류</label>
                  <select
                    value={checklistTemplateForm.workType}
                    onChange={(e) =>
                      setChecklistTemplateForm({
                        ...checklistTemplateForm,
                        workType: e.target.value,
                      })
                    }
                  >
                    <option value="SERVICE">A/S</option>
                    <option value="INSTALL">설치</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>템플릿 이름</label>
                  <input
                    value={checklistTemplateForm.name}
                    onChange={(e) =>
                      setChecklistTemplateForm({
                        ...checklistTemplateForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="예: 카메라 교체 A/S 체크리스트"
                  />
                </div>

                <div className="form-field full">
                  <label>체크 항목</label>
                  <textarea
                    value={checklistTemplateForm.itemsText}
                    onChange={(e) =>
                      setChecklistTemplateForm({
                        ...checklistTemplateForm,
                        itemsText: e.target.value,
                      })
                    }
                    placeholder={'증상 재현\n전원 확인\n카메라 교체\n영상 테스트\n고객 확인'}
                    style={{
                      minHeight: '160px',
                    }}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-button"
                >
                  템플릿 등록
                </button>
              </div>
            </form>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '14px',
              }}
            >
              {checklistTemplates.map((template) => (
                <div
                  key={template.id}
                  className="panel"
                >
                  <div className="panel-header">
                    <div>
                      <h2>{template.name}</h2>
                      <p>
                        {template.workType === 'INSTALL'
                          ? '설치'
                          : 'A/S'} · {template.items.length}개 항목
                      </p>
                    </div>

                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        deleteChecklistTemplate(template)
                      }
                    >
                      사용 중지
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '6px',
                    }}
                  >
                    {template.items.map((item, index) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '8px 9px',
                          borderRadius: '7px',
                          background: '#f8fafc',
                          fontSize: '12px',
                        }}
                      >
                        {index + 1}. {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'qr-lookup' && (
          <>
            <div className="topbar">
              <div>
                <h1>QR / 장비 코드 조회</h1>
                <p>
                  현장이나 장비에 붙인 QR을 스캔해서 현장정보와 장비정보를 바로 확인합니다.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(280px, .8fr) minmax(0, 1.2fr)',
                gap: '16px',
              }}
            >
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>코드 입력 / 카메라 스캔</h2>
                    <p>
                      Android Chrome 등 BarcodeDetector 지원 브라우저에서 카메라 스캔을 시험할 수 있습니다.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '9px',
                  }}
                >
                  <input
                    value={qrCodeInput}
                    onChange={(e) =>
                      setQrCodeInput(e.target.value)
                    }
                    placeholder="예: CSW-ASSET:ASSET-..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        lookupQrCode()
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => lookupQrCode()}
                  >
                    코드 조회
                  </button>

                  {!qrScanning ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={startQrScanner}
                    >
                      카메라 QR 스캔
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={stopQrScanner}
                    >
                      카메라 중지
                    </button>
                  )}

                  {qrScanning && (
                    <video
                      ref={qrVideoRef}
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        borderRadius: '10px',
                        background: '#111827',
                        minHeight: '240px',
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>조회 결과</h2>
                  </div>
                </div>

                {!qrLookup ? (
                  <div className="memo-box">
                    조회된 코드가 없습니다.
                  </div>
                ) : qrLookup.type === 'ASSET' ? (
                  <div>
                    <h2
                      style={{
                        marginBottom: '12px',
                      }}
                    >
                      {qrLookup.asset.assetType}
                      {qrLookup.asset.model
                        ? ` · ${qrLookup.asset.model}`
                        : ''}
                    </h2>

                    <div className="info-grid">
                      <InfoItem
                        label="장비코드"
                        value={qrLookup.asset.assetCode}
                      />
                      <InfoItem
                        label="현장"
                        value={qrLookup.asset.site?.name}
                      />
                      <InfoItem
                        label="S/N"
                        value={qrLookup.asset.serialNumber || '-'}
                      />
                      <InfoItem
                        label="상태"
                        value={qrLookup.asset.status}
                      />
                      <InfoItem
                        label="위치"
                        value={qrLookup.asset.location || '-'}
                      />
                      <InfoItem
                        label="설치일"
                        value={qrLookup.asset.installedAt?.slice(0, 10) || '-'}
                      />
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      style={{
                        marginTop: '14px',
                      }}
                      onClick={() => {
                        setAssetSiteFilter(
                          String(qrLookup.asset.siteId)
                        )
                        setPage('assets')
                      }}
                    >
                      현장 장비대장 보기
                    </button>
                  </div>
                ) : (
                  <div>
                    <h2
                      style={{
                        marginBottom: '12px',
                      }}
                    >
                      {qrLookup.site.name}
                    </h2>

                    <div className="info-grid">
                      <InfoItem
                        label="지역"
                        value={qrLookup.site.region || qrLookup.site.area || '-'}
                      />
                      <InfoItem
                        label="주소"
                        value={qrLookup.site.address || '-'}
                      />
                      <InfoItem
                        label="상태"
                        value={qrLookup.site.status}
                      />
                      <InfoItem
                        label="장비"
                        value={`${qrLookup.site.assets?.length || 0}건`}
                      />
                      <InfoItem
                        label="최근 A/S"
                        value={`${qrLookup.site.serviceRequests?.length || 0}건`}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          openSiteDetail(
                            normalizeSite(qrLookup.site)
                          )
                        }
                      >
                        현장 상세
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setAssetSiteFilter(
                            String(qrLookup.site.id)
                          )
                          setPage('assets')
                        }}
                      >
                        장비대장
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {page === 'as-process' &&
          selectedAsCase &&
          (
            currentUser?.role === 'MASTER' ||
            currentUser?.department === 'AS팀'
          ) && (
          <>
            <div className="topbar">
              <div>
                <button
                  type="button"
                  className="back-button"
                  onClick={() => setPage('as-center')}
                >
                  ← A/S 접수센터
                </button>

                <h1>
                  {selectedAsCase.requestType} 처리 · #{selectedAsCase.id}
                </h1>

                <p>
                  {selectedAsCase.site?.name} · {selectedAsCase.customerName || '고객명 없음'} · {selectedAsCase.contact || '연락처 없음'}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '7px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {selectedAsCase.priority === '긴급' && (
                  <span
                    style={{
                      padding: '6px 9px',
                      borderRadius: '999px',
                      background: '#ffe6e6',
                      color: '#b52b2b',
                      fontSize: '10px',
                      fontWeight: 900,
                    }}
                  >
                    긴급
                  </span>
                )}

                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background:
                      selectedAsCase.status === '완료'
                        ? '#eaf8f0'
                        : selectedAsCase.status === '처리 중'
                          ? '#eaf2ff'
                          : selectedAsCase.status === '보류'
                            ? '#fff4df'
                            : '#f1f3f6',
                    color:
                      selectedAsCase.status === '완료'
                        ? '#187047'
                        : selectedAsCase.status === '처리 중'
                          ? '#2864c7'
                          : selectedAsCase.status === '보류'
                            ? '#98630e'
                            : '#596579',
                    fontSize: '11px',
                    fontWeight: 850,
                  }}
                >
                  {selectedAsCase.status}
                </span>
              </div>
            </div>

            {asProcessLoading ? (
              <div className="panel">
                불러오는 중...
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(300px, .9fr) minmax(0, 1.25fr)',
                    gap: '16px',
                    alignItems: 'start',
                  }}
                  className="as-process-layout"
                >
                  <div
                    style={{
                      display: 'grid',
                      gap: '16px',
                    }}
                  >
                    <div className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>접수 정보</h2>
                          <p>
                            고객센터에서 받은 최초 접수 내용입니다.
                          </p>
                        </div>
                      </div>

                      <div className="info-grid">
                        <InfoItem
                          label="접수 유형"
                          value={selectedAsCase.requestType}
                        />
                        <InfoItem
                          label="접수 경로"
                          value={selectedAsCase.intakeChannel || '-'}
                        />
                        <InfoItem
                          label="현장"
                          value={selectedAsCase.site?.name || '-'}
                        />
                        <InfoItem
                          label="고객/통화자"
                          value={selectedAsCase.customerName || '-'}
                        />
                        <InfoItem
                          label="연락처"
                          value={selectedAsCase.contact || '-'}
                        />
                        <InfoItem
                          label="접수자"
                          value={selectedAsCase.createdBy?.name || '-'}
                        />
                        <InfoItem
                          label="접수일"
                          value={formatDateTime(selectedAsCase.createdAt)}
                        />
                        <InfoItem
                          label="완료일"
                          value={formatDateTime(selectedAsCase.completedAt)}
                        />
                      </div>

                      <div
                        style={{
                          marginTop: '14px',
                          padding: '12px',
                          borderRadius: '10px',
                          background: '#f7f9fc',
                        }}
                      >
                        <strong
                          style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '12px',
                          }}
                        >
                          문의 / 증상
                        </strong>

                        <div
                          style={{
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.65,
                          }}
                        >
                          {selectedAsCase.requestContent}
                        </div>
                      </div>

                      {selectedAsCase.memo && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '10px 12px',
                            borderRadius: '9px',
                            background: '#fff8e8',
                            fontSize: '11px',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          <strong>접수/처리 메모</strong>
                          <br />
                          {selectedAsCase.memo}
                        </div>
                      )}
                    </div>

                    <div className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>처리 타임라인</h2>
                          <p>
                            접수부터 처리·보류·완료까지 기록됩니다.
                          </p>
                        </div>
                      </div>

                      {selectedAsCase.status !== '완료' && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '7px',
                            marginBottom: '13px',
                          }}
                        >
                          <input
                            value={asProcessNote}
                            onChange={(e) =>
                              setAsProcessNote(e.target.value)
                            }
                            placeholder="통화/원격지원 중 메모"
                            style={{
                              flex: 1,
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                addAsProcessNote()
                              }
                            }}
                          />

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={addAsProcessNote}
                          >
                            메모
                          </button>
                        </div>
                      )}

                      <div
                        style={{
                          display: 'grid',
                          gap: '8px',
                        }}
                      >
                        {(selectedAsCase.activities || []).map(
                          (activity) => (
                            <div
                              key={activity.id}
                              style={{
                                padding: '10px 11px',
                                borderLeft: '3px solid #6287c5',
                                borderRadius: '0 8px 8px 0',
                                background: '#f8fafc',
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: '12px',
                                }}
                              >
                                {activity.title}
                              </strong>

                              {activity.content && (
                                <div
                                  style={{
                                    marginTop: '4px',
                                    fontSize: '11px',
                                    lineHeight: 1.55,
                                    whiteSpace: 'pre-wrap',
                                  }}
                                >
                                  {activity.content}
                                </div>
                              )}

                              <div
                                style={{
                                  marginTop: '4px',
                                  color: '#8994a5',
                                  fontSize: '9px',
                                }}
                              >
                                {activity.user?.name || '시스템'} · {formatDateTime(activity.createdAt)}
                              </div>
                            </div>
                          )
                        )}

                        {!selectedAsCase.activities?.length && (
                          <div className="memo-box">
                            아직 처리 기록이 없습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '16px',
                    }}
                  >
                    <div className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>
                            {selectedAsCase.status === '완료'
                              ? '처리 결과'
                              : `${selectedAsCase.requestType} 처리`}
                          </h2>
                          <p>
                            {selectedAsCase.requestType === '상담'
                              ? '상담으로 해결하거나 필요하면 원격/방문 A/S로 넘길 수 있습니다.'
                              : '원격으로 해결하거나 해결이 어려우면 방문 A/S로 넘길 수 있습니다.'}
                          </p>
                        </div>
                      </div>

                      {selectedAsCase.status !== '완료' ? (
                        <>
                          <div className="form-field">
                            <label>처리 결과</label>
                            <textarea
                              value={asProcessResolution}
                              onChange={(e) =>
                                setAsProcessResolution(
                                  e.target.value
                                )
                              }
                              placeholder={
                                selectedAsCase.requestType === '상담'
                                  ? '안내한 내용과 최종 상담 결과를 기록하세요.'
                                  : '원격 접속/전화 조치 내용과 최종 결과를 기록하세요.'
                              }
                              style={{
                                minHeight: '180px',
                              }}
                            />
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: '8px',
                              flexWrap: 'wrap',
                              marginTop: '12px',
                            }}
                          >
                            {selectedAsCase.status !== '처리 중' && (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={startAsProcess}
                              >
                                처리 시작
                              </button>
                            )}

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={holdAsProcess}
                            >
                              보류
                            </button>

                            <button
                              type="button"
                              className="primary-button"
                              onClick={completeAsProcess}
                            >
                              {selectedAsCase.requestType} 완료
                            </button>
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            padding: '14px',
                            borderRadius: '10px',
                            background: '#f0faf4',
                            color: '#226546',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          <strong
                            style={{
                              display: 'block',
                              marginBottom: '6px',
                            }}
                          >
                            완료 처리 내용
                          </strong>

                          {selectedAsCase.resolution || '-'}
                        </div>
                      )}
                    </div>

                    {selectedAsCase.status !== '완료' && (
                      <div className="panel">
                        <div className="panel-header">
                          <div>
                            <h2>다른 처리 방식으로 전환</h2>
                            <p>
                              접수번호와 기존 이력은 그대로 유지됩니다.
                            </p>
                          </div>
                        </div>

                        {selectedAsCase.requestType === '상담' && (
                          <div
                            style={{
                              marginBottom: '14px',
                              paddingBottom: '14px',
                              borderBottom: '1px solid #e8edf2',
                            }}
                          >
                            <strong
                              style={{
                                display: 'block',
                                marginBottom: '5px',
                              }}
                            >
                              원격 지원이 필요한 경우
                            </strong>

                            <p
                              style={{
                                margin: '0 0 9px',
                                color: '#748095',
                                fontSize: '11px',
                              }}
                            >
                              상담 접수를 원격 A/S로 전환해 계속 처리합니다.
                            </p>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                convertAsProcess('원격A/S')
                              }
                            >
                              원격 A/S로 전환
                            </button>
                          </div>
                        )}

                        <div className="form-grid">
                          <div className="form-field">
                            <label>희망 방문일</label>
                            <input
                              type="date"
                              value={asConvertVisitDate}
                              onChange={(e) =>
                                setAsConvertVisitDate(
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          <div className="form-field">
                            <label>CS팀 전달 메모</label>
                            <input
                              value={asConvertReason}
                              onChange={(e) =>
                                setAsConvertReason(
                                  e.target.value
                                )
                              }
                              placeholder="예: 원격 조치 불가, 카메라 점검 필요"
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: '11px',
                            padding: '11px 12px',
                            borderRadius: '9px',
                            background: '#eef5ff',
                            color: '#285fb8',
                            fontSize: '11px',
                            lineHeight: 1.6,
                          }}
                        >
                          방문 A/S로 전환하면 <strong>CS팀 A/S 관리에 즉시 나타나고 CS팀/Master 알림센터에도 새 알림</strong>이 생성됩니다.
                        </div>

                        <button
                          type="button"
                          className="primary-button"
                          style={{
                            marginTop: '10px',
                          }}
                          onClick={() =>
                            convertAsProcess('방문A/S')
                          }
                        >
                          방문 A/S로 전환 → CS팀 전달
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {page === 'as-center' &&
          (
            currentUser?.role === 'MASTER' ||
            currentUser?.department === 'AS팀'
          ) && (
          <>
            <div className="topbar">
              <div>
                <h1>A/S 접수센터</h1>
                <p>
                  고객센터 전화 접수를 빠르게 등록합니다. 방문 A/S는 접수와 동시에 CS팀 A/S 관리로 전달됩니다.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    padding: '7px 10px',
                    borderRadius: '999px',
                    background: '#edf4ff',
                    color: '#285fb8',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  {currentUser?.name} · {currentUser?.department}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={loadAsCenter}
                >
                  새로고침
                </button>
              </div>
            </div>

            <section
              className="summary-grid"
              style={{
                marginBottom: '18px',
              }}
            >
              <div className="summary-card">
                <span>오늘 접수</span>
                <strong>{asCenterData.summary.total}</strong>
                <small>전체 접수</small>
              </div>

              <div className="summary-card">
                <span>원격 A/S</span>
                <strong>{asCenterData.summary.remote}</strong>
                <small>전화/원격 처리 접수</small>
              </div>

              <div className="summary-card">
                <span>방문 A/S</span>
                <strong>{asCenterData.summary.visit}</strong>
                <small>CS팀 전달 대상</small>
              </div>

              <div className="summary-card">
                <span>상담</span>
                <strong>{asCenterData.summary.consult}</strong>
                <small>제품/사용 문의</small>
              </div>

              <div className="summary-card">
                <span>미처리</span>
                <strong>{asCenterData.summary.pending || 0}</strong>
                <small>오늘 아직 완료되지 않은 건</small>
              </div>

              <div className="summary-card">
                <span>오늘 완료</span>
                <strong>{asCenterData.summary.completed || 0}</strong>
                <small>원격/상담 포함 완료</small>
              </div>

              <div className="summary-card danger">
                <span>긴급</span>
                <strong>{asCenterData.summary.urgent}</strong>
                <small>긴급 표시 접수</small>
              </div>
            </section>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(360px, .95fr) minmax(0, 1.35fr)',
                gap: '18px',
                alignItems: 'start',
              }}
              className="as-intake-layout"
            >
              <form
                className="panel"
                onSubmit={saveAsIntake}
              >
                <div className="panel-header">
                  <div>
                    <h2>전화 빠른접수</h2>
                    <p>
                      접수 유형을 먼저 선택한 뒤 전화받은 내용을 입력합니다.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(3, minmax(0, 1fr))',
                    gap: '8px',
                    marginBottom: '18px',
                  }}
                >
                  {[
                    {
                      value: '원격A/S',
                      icon: '💻',
                      text: '원격 A/S',
                      sub: '원격지원/전화조치',
                    },
                    {
                      value: '방문A/S',
                      icon: '🚗',
                      text: '방문 A/S',
                      sub: 'CS팀 현장 방문',
                    },
                    {
                      value: '상담',
                      icon: '☎',
                      text: '상담',
                      sub: '제품/사용 문의',
                    },
                  ].map((item) => {
                    const selected =
                      asIntakeForm.requestType ===
                      item.value

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() =>
                          selectAsRequestType(item.value)
                        }
                        style={{
                          minHeight: '94px',
                          padding: '12px 8px',
                          border:
                            selected
                              ? '2px solid #3977dc'
                              : '1px solid #dfe6ef',
                          borderRadius: '12px',
                          background:
                            selected
                              ? '#edf5ff'
                              : '#fff',
                          color:
                            selected
                              ? '#225fbf'
                              : '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '22px',
                            marginBottom: '5px',
                          }}
                        >
                          {item.icon}
                        </div>

                        <strong
                          style={{
                            display: 'block',
                            fontSize: '13px',
                          }}
                        >
                          {item.text}
                        </strong>

                        <small
                          style={{
                            display: 'block',
                            marginTop: '3px',
                            fontSize: '10px',
                            opacity: .72,
                          }}
                        >
                          {item.sub}
                        </small>
                      </button>
                    )
                  })}
                </div>

                <div className="form-grid">
                  <div className="form-field">
                    <label>접수 경로</label>
                    <select
                      value={asIntakeForm.intakeChannel}
                      onChange={(e) =>
                        setAsIntakeForm({
                          ...asIntakeForm,
                          intakeChannel:
                            e.target.value,
                        })
                      }
                    >
                      {optionValues('SERVICE_INTAKE_CHANNEL').map(
                        (value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {value}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>긴급도</label>
                    <select
                      value={asIntakeForm.priority}
                      onChange={(e) =>
                        setAsIntakeForm({
                          ...asIntakeForm,
                          priority:
                            e.target.value,
                        })
                      }
                    >
                      {optionValues('SERVICE_PRIORITY').map(
                        (value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {value}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-field full">
                    <label>현장명 *</label>
                    <input
                      required
                      list="as-intake-site-list"
                      value={asIntakeForm.siteName}
                      onChange={(e) =>
                        setAsIntakeForm({
                          ...asIntakeForm,
                          siteName:
                            e.target.value,
                        })
                      }
                      onBlur={applyAsSiteSuggestion}
                      placeholder="현장명을 입력하세요"
                    />

                    <datalist id="as-intake-site-list">
                      {sites.map((site) => (
                        <option
                          key={site.id}
                          value={site.name}
                        >
                          {site.region || site.area || ''}
                        </option>
                      ))}
                    </datalist>

                    <small
                      style={{
                        marginTop: '5px',
                        color: '#7b8798',
                      }}
                    >
                      기존 현장은 자동완성됩니다. 없는 현장명도 그대로 접수할 수 있습니다.
                    </small>
                  </div>

                  <div className="form-field">
                    <label>고객 / 통화자 이름</label>
                    <input
                      value={asIntakeForm.customerName}
                      onChange={(e) =>
                        setAsIntakeForm({
                          ...asIntakeForm,
                          customerName:
                            e.target.value,
                        })
                      }
                      placeholder="예: 관리소장 홍길동"
                    />
                  </div>

                  <div className="form-field">
                    <label>연락처</label>
                    <input
                      type="tel"
                      value={asIntakeForm.contact}
                      onChange={(e) =>
                        setAsIntakeForm({
                          ...asIntakeForm,
                          contact:
                            e.target.value,
                        })
                      }
                      placeholder="010-0000-0000"
                    />
                  </div>

                  {asIntakeForm.requestType === '방문A/S' && (
                    <div className="form-field full">
                      <label>희망 방문일</label>
                      <input
                        type="date"
                        value={asIntakeForm.visitDate}
                        onChange={(e) =>
                          setAsIntakeForm({
                            ...asIntakeForm,
                            visitDate:
                              e.target.value,
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="form-field full">
                    <label>
                      {asIntakeForm.requestType === '상담'
                        ? '문의 내용 *'
                        : '증상 / 요청 내용 *'}
                    </label>
                    <textarea
                      required
                      value={asIntakeForm.requestContent}
                      onChange={(e) =>
                        setAsIntakeForm({
                          ...asIntakeForm,
                          requestContent:
                            e.target.value,
                        })
                      }
                      placeholder={
                        asIntakeForm.requestType === '상담'
                          ? '고객이 문의한 내용을 입력하세요.'
                          : '증상, 발생 위치, 고객 요청사항 등을 입력하세요.'
                      }
                      style={{
                        minHeight: '120px',
                      }}
                    />
                  </div>

                  <div className="form-field full">
                    <label>접수 메모</label>
                    <textarea
                      value={asIntakeForm.memo}
                      onChange={(e) =>
                        setAsIntakeForm({
                          ...asIntakeForm,
                          memo:
                            e.target.value,
                        })
                      }
                      placeholder="내부 전달사항이 있으면 입력하세요."
                    />
                  </div>
                </div>

                {duplicateAsCandidates.length > 0 && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      border: '1px solid #f2cf8c',
                      borderRadius: '10px',
                      background: '#fff8e8',
                      color: '#7d5a10',
                    }}
                  >
                    <strong
                      style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '12px',
                      }}
                    >
                      ⚠ 중복 접수 가능성
                    </strong>

                    {duplicateAsCandidates.map((row) => (
                      <div
                        key={row.id}
                        style={{
                          fontSize: '11px',
                          lineHeight: 1.55,
                        }}
                      >
                        #{row.id} · {row.requestType} · {row.site?.name} · {row.requestContent}
                      </div>
                    ))}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setAsIntakeForm(
                        emptyAsIntakeForm()
                      )
                    }
                  >
                    초기화
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                  >
                    {asIntakeForm.requestType} 접수 완료
                  </button>
                </div>
              </form>

              <div>
                {lastAsIntakeResult && (
                  <div
                    className="panel"
                    style={{
                      marginBottom: '14px',
                      border:
                        lastAsIntakeResult.handedOffToCs
                          ? '1px solid #a8d2ff'
                          : '1px solid #b8e5ca',
                      background:
                        lastAsIntakeResult.handedOffToCs
                          ? '#f4f9ff'
                          : '#f5fcf7',
                    }}
                  >
                    <div className="panel-header">
                      <div>
                        <h2>
                          접수 #{lastAsIntakeResult.request.id} 완료
                        </h2>
                        <p>
                          {lastAsIntakeResult.request.requestType} · {lastAsIntakeResult.request.site?.name}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.65,
                      }}
                    >
                      {lastAsIntakeResult.handedOffToCs
                        ? '방문 A/S라서 CS팀의 A/S 관리 화면에도 자동으로 등록되었습니다.'
                        : 'A/S 접수센터에 정상 등록되었습니다.'}
                    </div>

                    {lastAsIntakeResult.duplicateCandidates?.length > 0 && (
                      <div
                        style={{
                          marginTop: '9px',
                          color: '#966515',
                          fontSize: '11px',
                        }}
                      >
                        최근 24시간 내 같은 현장/연락처의 미완료 접수가 {lastAsIntakeResult.duplicateCandidates.length}건 있습니다.
                      </div>
                    )}
                  </div>
                )}

                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>최근 접수</h2>
                      <p>
                        최근 100건을 빠르게 검색합니다.
                      </p>
                    </div>

                    {asCenterLoading && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#718096',
                        }}
                      >
                        불러오는 중...
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginBottom: '12px',
                    }}
                  >
                    <select
                      value={asRecentStatusFilter}
                      onChange={(e) =>
                        setAsRecentStatusFilter(
                          e.target.value
                        )
                      }
                    >
                      <option>미처리</option>
                      <option>전체</option>
                      <option>완료</option>
                    </select>

                    <select
                      value={asRecentTypeFilter}
                      onChange={(e) =>
                        setAsRecentTypeFilter(
                          e.target.value
                        )
                      }
                    >
                      <option>전체</option>
                      {optionValues('SERVICE_REQUEST_TYPE').map(
                        (value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {value}
                          </option>
                        )
                      )}
                    </select>

                    <input
                      value={asRecentSearch}
                      onChange={(e) =>
                        setAsRecentSearch(
                          e.target.value
                        )
                      }
                      placeholder="현장 / 연락처 / 내용 / 접수자 검색"
                      style={{
                        flex: '1 1 240px',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                      maxHeight: '760px',
                      overflowY: 'auto',
                      paddingRight: '2px',
                    }}
                  >
                    {filteredAsRecent.map((row) => {
                      const typeStyle =
                        row.requestType === '방문A/S'
                          ? {
                              background: '#eaf2ff',
                              color: '#245fc5',
                            }
                          : row.requestType === '원격A/S'
                            ? {
                                background: '#eef9f2',
                                color: '#19724a',
                              }
                            : {
                                background: '#f5efff',
                                color: '#6e44b5',
                              }

                      return (
                        <div
                          key={row.id}
                          style={{
                            padding: '12px',
                            border: '1px solid #e4e9ef',
                            borderRadius: '10px',
                            background:
                              row.priority === '긴급'
                                ? '#fff7f7'
                                : '#fff',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <strong>
                              #{row.id} · {row.site?.name}
                            </strong>

                            <span
                              style={{
                                ...typeStyle,
                                padding: '3px 7px',
                                borderRadius: '999px',
                                fontSize: '10px',
                                fontWeight: 800,
                              }}
                            >
                              {row.requestType || '방문A/S'}
                            </span>

                            <span
                              style={{
                                padding: '3px 7px',
                                borderRadius: '999px',
                                background: '#f1f3f6',
                                color: '#657085',
                                fontSize: '10px',
                                fontWeight: 750,
                              }}
                            >
                              {row.intakeChannel || '전화'}
                            </span>

                            {row.priority === '긴급' && (
                              <span
                                style={{
                                  padding: '3px 7px',
                                  borderRadius: '999px',
                                  background: '#ffe5e5',
                                  color: '#b32828',
                                  fontSize: '10px',
                                  fontWeight: 800,
                                }}
                              >
                                긴급
                              </span>
                            )}

                            {row.isAfterHours && (
                              <span style={{ padding: '3px 7px', borderRadius: '999px', background: '#2f3542', color: '#fff', fontSize: '10px', fontWeight: 800 }}>
                                야간/휴무
                              </span>
                            )}

                            {!row.acknowledgedAt && row.status !== '완료' && (
                              <span style={{ padding: '3px 7px', borderRadius: '999px', background: '#fff0c2', color: '#8a5a00', fontSize: '10px', fontWeight: 800 }}>
                                미확인
                              </span>
                            )}

                            <span
                              style={{
                                marginLeft: 'auto',
                                color: '#7d8899',
                                fontSize: '10px',
                              }}
                            >
                              {formatDateTime(row.createdAt)}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: '7px',
                              lineHeight: 1.55,
                              fontSize: '12px',
                            }}
                          >
                            {row.requestContent}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: '10px',
                              flexWrap: 'wrap',
                              marginTop: '7px',
                              color: '#768196',
                              fontSize: '10px',
                            }}
                          >
                            <span>
                              고객: {row.customerName || '-'}
                            </span>
                            <span>
                              연락처: {row.contact || '-'}
                            </span>
                            <span>
                              접수자: {row.createdBy?.name || '-'}
                            </span>
                            <span>
                              상태: {row.status}
                            </span>
                          </div>

                          {row.requestType === '방문A/S' && (
                            <div
                              style={{
                                marginTop: '7px',
                                color: '#2864c7',
                                fontSize: '10px',
                                fontWeight: 800,
                              }}
                            >
                              ✓ CS팀 A/S 관리에 자동 전달
                              {row.visitDate
                                ? ` · 희망방문 ${row.visitDate.slice(0, 10)}`
                                : ''}
                            </div>
                          )}

                          {row.requestType !== '방문A/S' && (
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                marginTop: '9px',
                              }}
                            >
                              <button
                                type="button"
                                className={
                                  row.status === '완료'
                                    ? 'secondary-button'
                                    : 'primary-button'
                                }
                                onClick={() =>
                                  loadAsProcessDetail(row)
                                }
                              >
                                {row.status === '완료'
                                  ? '처리내역 보기'
                                  : '처리하기'}
                              </button>
                            </div>
                          )}

                          {!row.acknowledgedAt && row.status !== '완료' && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '9px' }}>
                              <button type="button" className="secondary-button" onClick={() => acknowledgeAsRequest(row)}>
                                확인 완료
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {!filteredAsRecent.length && (
                      <div className="memo-box">
                        표시할 접수내역이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {page === 'option-admin' &&
          currentUser?.role === 'MASTER' && (
          <>
            <div className="topbar">
              <div>
                <h1>MASTER 관리자 모드</h1>
                <p>
                  각 메뉴의 선택창에 표시되는 항목을 한 곳에서 추가 · 수정 · 삭제합니다.
                </p>
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: '999px',
                  background: '#eef4ff',
                  color: '#285fb8',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                MASTER ONLY
              </span>
            </div>

            <div
              className="option-admin-grid"
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(230px, 320px) minmax(0, 1fr)',
                gap: '18px',
                alignItems: 'start',
              }}
            >
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>관리할 선택항목</h2>
                    <p>
                      그룹 자체도 MASTER가 추가하고 이름을 바꾸거나 삭제할 수 있습니다.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={addSystemOptionGroup}
                  style={{
                    display: 'flex',
                    gap: '7px',
                    marginBottom: '14px',
                  }}
                >
                  <input
                    value={newOptionGroupLabel}
                    onChange={(e) =>
                      setNewOptionGroupLabel(
                        e.target.value
                      )
                    }
                    placeholder="새 선택항목 그룹"
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  />

                  <button
                    type="submit"
                    className="primary-button"
                    title="관리할 선택항목 그룹 추가"
                  >
                    + 추가
                  </button>
                </form>

                <div
                  style={{
                    display: 'grid',
                    gap: '7px',
                  }}
                >
                  {systemOptionGroups.map(
                    (group) => {
                      const selected =
                        selectedOptionGroup ===
                        group.key

                      return (
                        <div
                          key={group.key}
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'minmax(0, 1fr) auto',
                            gap: '5px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedOptionGroup(
                                group.key
                              )
                            }
                            style={{
                              width: '100%',
                              minWidth: 0,
                              padding:
                                '10px 11px',
                              border:
                                selected
                                  ? '1px solid #377be8'
                                  : '1px solid #e1e6ed',
                              borderRadius:
                                '9px',
                              background:
                                selected
                                  ? '#eef5ff'
                                  : '#fff',
                              color:
                                selected
                                  ? '#225ebd'
                                  : '#334155',
                              textAlign:
                                'left',
                              cursor:
                                'pointer',
                              fontWeight:
                                750,
                            }}
                          >
                            <div
                              style={{
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                gap: '6px',
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  overflow:
                                    'hidden',
                                  textOverflow:
                                    'ellipsis',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {group.label}
                              </span>

                              {group.isSystem && (
                                <span
                                  style={{
                                    flex:
                                      '0 0 auto',
                                    padding:
                                      '2px 5px',
                                    borderRadius:
                                      '999px',
                                    background:
                                      '#f1f3f5',
                                    color:
                                      '#768194',
                                    fontSize:
                                      '9px',
                                  }}
                                >
                                  연결됨
                                </span>
                              )}

                              <span
                                style={{
                                  marginLeft:
                                    'auto',
                                  opacity:
                                    0.65,
                                  fontSize:
                                    '10px',
                                  whiteSpace:
                                    'nowrap',
                                }}
                              >
                                {
                                  optionRows(
                                    group.key
                                  ).length
                                }개
                              </span>
                            </div>
                          </button>

                          <div
                            style={{
                              display:
                                'flex',
                              gap: '4px',
                            }}
                          >
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                renameSystemOptionGroup(
                                  group
                                )
                              }
                              title="그룹 이름 변경"
                              style={{
                                minWidth:
                                  '38px',
                                padding:
                                  '7px',
                              }}
                            >
                              수정
                            </button>

                            <button
                              type="button"
                              className="danger-button"
                              disabled={
                                group.isSystem
                              }
                              onClick={() =>
                                deleteSystemOptionGroup(
                                  group
                                )
                              }
                              title={
                                group.isSystem
                                  ? '기본 연결 그룹은 삭제할 수 없습니다.'
                                  : '그룹 삭제'
                              }
                              style={{
                                minWidth:
                                  '38px',
                                padding:
                                  '7px',
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      {systemOptionGroups.find(
                        (group) =>
                          group.key ===
                          selectedOptionGroup
                      )?.label ||
                        '선택항목'}
                    </h2>
                    <p>
                      항목을 추가하면 일반 직원에게도 해당 선택창에 표시됩니다.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={addSystemOption}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                  }}
                >
                  <input
                    value={newSystemOptionValue}
                    onChange={(e) =>
                      setNewSystemOptionValue(
                        e.target.value
                      )
                    }
                    placeholder={
                      selectedOptionGroup ===
                      'INSTALL_DAYS'
                        ? '예: 14'
                        : '새 선택항목 입력'
                    }
                    style={{
                      flex: '1 1 240px',
                    }}
                  />

                  <button
                    type="submit"
                    className="primary-button"
                  >
                    + 새 항목 추가
                  </button>
                </form>

                <div
                  style={{
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  {optionRows(
                    selectedOptionGroup
                  ).length ? (
                    optionRows(
                      selectedOptionGroup
                    ).map(
                      (option, index) => (
                        <div
                          key={option.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            minHeight: '48px',
                            padding: '9px 11px',
                            border:
                              '1px solid #e4e9ef',
                            borderRadius:
                              '9px',
                            background:
                              '#fff',
                          }}
                        >
                          <span
                            style={{
                              minWidth: '28px',
                              color:
                                '#8a96a7',
                              fontSize:
                                '11px',
                            }}
                          >
                            {index + 1}
                          </span>

                          <strong
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {selectedOptionGroup ===
                            'INSTALL_DAYS'
                              ? `${option.value}일`
                              : option.value}
                          </strong>

                          {option.isLocked && (
                            <span
                              style={{
                                padding:
                                  '4px 7px',
                                borderRadius:
                                  '999px',
                                background:
                                  '#f2f4f7',
                                color:
                                  '#667085',
                                fontSize:
                                  '10px',
                                fontWeight:
                                  800,
                              }}
                            >
                              기본값
                            </span>
                          )}

                          <button
                            type="button"
                            className="secondary-button"
                            disabled={
                              option.isLocked
                            }
                            onClick={() =>
                              renameSystemOption(
                                option
                              )
                            }
                          >
                            이름 변경
                          </button>

                          <button
                            type="button"
                            className="danger-button"
                            disabled={
                              option.isLocked
                            }
                            onClick={() =>
                              deleteSystemOption(
                                option
                              )
                            }
                          >
                            삭제
                          </button>
                        </div>
                      )
                    )
                  ) : (
                    <div className="memo-box">
                      등록된 항목이 없습니다. 위에서 새 항목을 추가하세요.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#fff8e8',
                    color: '#795a13',
                    fontSize: '12px',
                    lineHeight: 1.65,
                  }}
                >
                  <strong>참고</strong><br />
                  기존 업무 데이터는 선택항목을 삭제해도 지워지지 않습니다.
                  “연결됨” 표시가 있는 기본 그룹은 실제 화면 필드와 연결되어 있어서
                  그룹 자체 삭제는 막아두고, 이름 변경과 내부 항목 관리는 가능합니다.
                  MASTER가 새 그룹을 만드는 것도 가능합니다.
                  단, 새 그룹을 만든 것만으로 새 입력칸이 화면에 자동 생성되지는 않습니다.
                  새 입력칸까지 자동으로 만드는 기능은 별도의 “사용자 정의 필드” 기능입니다.
                </div>
              </div>
            </div>
          </>
        )}

        {page === 'profile' && (
          <>
            <div className="topbar">

              <div>
                <h1>내 정보</h1>

                <p>
                  로그인 사용자 정보를 확인합니다.
                </p>
              </div>

            </div>

            <div className="profile-layout">

              <div className="panel profile-card">

                <div className="profile-avatar">
                  {currentUser?.name?.slice(0, 1) || 'U'}
                </div>

                <h2>{currentUser?.name || '사용자'}</h2>

                <p>{currentUser?.department || '-'}</p>

                <span className="profile-role">
                  {currentUser?.role || 'USER'}
                </span>

              </div>


              <div className="panel">

                <div className="panel-header">
                  <div>
                    <h2>계정 정보</h2>
                    <p>
                      사용자 기본 정보
                    </p>
                  </div>

                  <button className="secondary-button">
                    수정
                  </button>
                </div>

                <div className="info-grid">

                  <InfoItem
                    label="이름"
                    value={currentUser?.name}
                  />

                  <InfoItem
                    label="아이디"
                    value={currentUser?.username}
                  />

                  <InfoItem
                    label="소속"
                    value={currentUser?.department}
                  />

                  <InfoItem
                    label="직급"
                    value={currentUser?.position}
                  />

                  <InfoItem
                    label="휴대전화"
                    value={currentUser?.phone}
                  />

                  <InfoItem
                    label="이메일"
                    value={currentUser?.email}
                  />

                </div>

                <div
                  className="memo-box"
                  style={{ marginTop: '20px' }}
                >
                  <strong>남은 연차</strong>
                  <div style={{ marginTop: '8px', fontSize: '24px' }}>
                    {leaveSummary.remainingDays || 0}일
                  </div>
                </div>

                <div className="profile-actions">

                  <button
                    className="secondary-button"
                    onClick={changeMyPassword}
                  >
                    비밀번호 변경
                  </button>

                  <button
                    className="danger-button"
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>

                </div>

              </div>

            </div>
          </>
        )}

      </main>

    </div>
  )
}


function FormInput({
  label,
  required,
  ...props
}) {
  return (
    <div className="form-field">

      <label>
        {label}
        {required && <span> *</span>}
      </label>

      <input
        required={required}
        {...props}
      />

    </div>
  )
}


function InfoItem({ label, value }) {
  return (
    <div className="info-item">

      <span>{label}</span>

      <strong>
        {value || '-'}
      </strong>

    </div>
  )
}


function TimelineItem({
  title,
  text,
  date,
}) {
  return (
    <div className="timeline-item">

      <div className="timeline-line-wrap">
        <div className="timeline-dot" />
        <div className="timeline-line" />
      </div>

      <div className="timeline-content">

        <strong>{title}</strong>

        <p>{text}</p>

        <small>{date}</small>

      </div>

    </div>
  )
}


function FileRow({ file }) {
  return (
    <div className="file-item">

      <div className="file-icon">
        FILE
      </div>

      <div className="file-info">
        <strong>
          {file.name}
        </strong>

        <small>
          {file.size}
        </small>
      </div>

      <button
        className="detail-button"
        onClick={() =>
          alert(
            '실제 다운로드 기능은 서버 연결 단계에서 붙입니다.'
          )
        }
      >
        다운로드
      </button>

    </div>
  )
}

export default App
