import "dotenv/config"
import express from "express"
import cors from "cors"
import multer from "multer"
import path from "path"
import fs from "fs"
import { randomUUID } from "crypto"
import { fileURLToPath } from "url"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import QRCode from "qrcode"
import { normalizeWorkEntries, WorkLogEntryError } from "./worklog-entries.mjs"

import { PrismaClient } from "../generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
})

const prisma = new PrismaClient({
  adapter,
})

const app = express()

app.use(cors())
app.use(express.json())

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "DEV_ONLY_CHANGE_THIS_SECRET_BEFORE_DEPLOY"

const MASTER_USERNAME =
  process.env.MASTER_USERNAME || "master"

const MASTER_PASSWORD =
  process.env.MASTER_PASSWORD || "ChangeMe123!"

const MASTER_NAME =
  process.env.MASTER_NAME || "최고관리자"

const MASTER_RESET_ON_START =
  process.env.MASTER_RESET_ON_START === "true"


const SYSTEM_OPTION_GROUPS = [
  { key: "SITE_REGION", label: "현장 · 지역", values: ["서울", "경기", "인천", "강원", "충청", "전라", "경상", "제주"] },
  {
    key: "SITE_STATUS",
    label: "현장/설치 · 상태",
    values: ["설치 예정", "설치 중", "설치 완료", "점검 필요"],
    lockedValues: ["설치 예정", "설치 중", "설치 완료", "점검 필요"],
  },
  { key: "FILE_CATEGORY", label: "자료실 · 분류", values: ["설치 매뉴얼", "프로그램", "드라이버", "문서", "기타"] },
  { key: "INSTALL_CATEGORY", label: "설치 관리 · 분류", values: ["아파트", "관공서", "개인", "연습장", "기타"] },
  { key: "INSTALL_DAYS", label: "설치 관리 · 작업 일수", values: Array.from({ length: 10 }, (_, i) => String(i + 1)) },
  { key: "INSTALL_KIOSK_MODEL", label: "설치 관리 · 키오스크 모델", values: ["DSR2-3000T", "DSR1-3000T", "파크골프", "기타"] },
  { key: "INSTALL_SENSOR_TYPE", label: "설치 관리 · 센서 타입", values: ["없음", "천장센서", "좌타센서", "기타"] },
  { key: "YES_NO", label: "공통 · 유무", values: ["유", "무"] },
  { key: "INSTALL_CAMERA_MODEL", label: "설치 관리 · 카메라", values: ["MV-GE40GM", "없음", "기타"] },
  {
    key: "SERVICE_STATUS",
    label: "A/S 관리 · 상태",
    values: ["접수", "방문 예정", "처리 중", "완료", "보류"],
    lockedValues: ["접수", "완료"],
  },
  {
    key: "BILLING_TYPE",
    label: "A/S 관리 · 청구 구분",
    values: ["무상", "유상"],
    lockedValues: ["무상", "유상"],
  },
  { key: "MATERIAL_USAGE_TYPE", label: "업무일지 · 자재 사용 유형", values: ["신규설치", "AS교체", "추가설치", "현장지급", "불량교환", "기타"] },
  { key: "LEAVE_TYPE", label: "연차 관리 · 종류", values: ["연차", "오전 반차", "오후 반차"] },
  { key: "INVENTORY_CATEGORY", label: "재고 관리 · 분류", values: ["기타", "키오스크", "센서", "카메라", "PC/부품", "케이블", "소모품"] },
  { key: "INVENTORY_UNIT", label: "재고 관리 · 단위", values: ["개", "대", "EA", "SET", "M", "BOX"] },
  { key: "ASSET_TYPE", label: "장비 대장 · 장비 종류", values: ["키오스크", "카메라", "센서", "관리PC", "프로젝터", "오토티업", "네트워크장비", "기타"] },
  { key: "ASSET_STATUS", label: "장비 대장 · 상태", values: ["사용중", "예비", "수리중", "교체", "폐기"] },
  { key: "SERVICE_ATTACHMENT_KIND", label: "A/S · 첨부 분류", values: ["작업 전", "작업 중", "작업 후", "문서", "기타"] },
  {
    key: "SERVICE_REQUEST_TYPE",
    label: "A/S 접수센터 · 접수 유형",
    values: ["원격A/S", "방문A/S", "상담"],
    lockedValues: ["원격A/S", "방문A/S", "상담"],
  },
  {
    key: "SERVICE_INTAKE_CHANNEL",
    label: "A/S 접수센터 · 접수 경로",
    values: ["전화", "카카오톡", "직접등록", "기타"],
    lockedValues: ["전화"],
  },
  {
    key: "SERVICE_PRIORITY",
    label: "A/S 접수센터 · 긴급도",
    values: ["일반", "긴급"],
    lockedValues: ["일반"],
  },
] as const

function optionGroupDefinition(groupKey: string) {
  return SYSTEM_OPTION_GROUPS.find((group) => group.key === groupKey)
}

async function ensureSystemOptions() {
  for (
    let groupIndex = 0;
    groupIndex < SYSTEM_OPTION_GROUPS.length;
    groupIndex += 1
  ) {
    const group =
      SYSTEM_OPTION_GROUPS[groupIndex]

    let storedGroup =
      await prisma.systemOptionGroup.findUnique({
        where: {
          key: group.key,
        },
      })

    if (!storedGroup) {
      storedGroup =
        await prisma.systemOptionGroup.create({
          data: {
            key: group.key,
            label: group.label,
            isSystem: true,
            isActive: true,
            sortOrder:
              (groupIndex + 1) * 10,
          },
        })
    }

    const lockedValues: string[] =
      "lockedValues" in group
        ? Array.from(
            group.lockedValues
          ).map(String)
        : []

    for (
      let index = 0;
      index < group.values.length;
      index += 1
    ) {
      const value =
        group.values[index]

      const existing =
        await prisma.systemOption.findUnique({
          where: {
            groupKey_value: {
              groupKey:
                group.key,
              value,
            },
          },
        })

      if (!existing) {
        await prisma.systemOption.create({
          data: {
            groupKey:
              group.key,
            groupLabel:
              storedGroup.label,
            value,
            sortOrder:
              (index + 1) * 10,
            isActive: true,
            isLocked:
              lockedValues.includes(
                String(value)
              ),
          },
        })
      }
    }
  }
}

function publicUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    department: user.department,
    position: user.position,
    phone: user.phone,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }
}

async function ensureMasterAccount() {
  const existing = await prisma.user.findUnique({
    where: {
      username: MASTER_USERNAME,
    },
  })

  if (existing) {
    const updateData: any = {
      role: "MASTER",
      isActive: true,
    }

    // 초기 구축/복구용.
    // .env에 MASTER_RESET_ON_START="true"가 있을 때만
    // 기존 MASTER 비밀번호를 .env 값으로 다시 맞춥니다.
    if (MASTER_RESET_ON_START) {
      updateData.passwordHash = await bcrypt.hash(
        MASTER_PASSWORD,
        12
      )
    }

    return prisma.user.update({
      where: {
        id: existing.id,
      },
      data: updateData,
    })
  }

  const passwordHash = await bcrypt.hash(
    MASTER_PASSWORD,
    12
  )

  return prisma.user.create({
    data: {
      username: MASTER_USERNAME,
      passwordHash,
      name: MASTER_NAME,
      department: "관리",
      position: "MASTER",
      role: "MASTER",
      isActive: true,
    },
  })
}

function createToken(user: any) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "12h",
    }
  )
}

const SEOUL_TIME_ZONE = "Asia/Seoul"

function seoulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date)
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value || ""
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
    weekday: weekdayMap[value("weekday")],
  }
}

async function getAsOperatingSetting() {
  return prisma.asOperatingSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })
}

async function isAfterAsOperatingHours(date = new Date()) {
  const setting = await getAsOperatingSetting()
  const local = seoulDateParts(date)
  const workingDays = Array.isArray(setting.workingDays)
    ? setting.workingDays.map(Number)
    : [1, 2, 3, 4, 5]
  const holidays = Array.isArray(setting.holidays)
    ? setting.holidays.map(String)
    : []
  return (
    !workingDays.includes(local.weekday) ||
    holidays.includes(local.date) ||
    local.time < setting.startTime ||
    local.time >= setting.endTime
  )
}

app.post("/api/auth/login", async (req, res) => {
  try {
    await ensureMasterAccount()

    const {
      username,
      password,
    } = req.body

    if (!username || !password) {
      return res.status(400).json({
        error: "아이디와 비밀번호를 입력해주세요.",
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    })

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "아이디 또는 비밀번호가 올바르지 않습니다.",
      })
    }

    const matched = await bcrypt.compare(
      password,
      user.passwordHash
    )

    if (!matched) {
      return res.status(401).json({
        error: "아이디 또는 비밀번호가 올바르지 않습니다.",
      })
    }

    const loginAt = new Date()
    const previousLoginAt = user.lastLoginAt
    const isFirstLoginToday =
      !previousLoginAt ||
      seoulDateParts(previousLoginAt).date !== seoulDateParts(loginAt).date

    const unacknowledgedWhere: any = {
      acknowledgedAt: null,
      status: { not: "완료" },
    }
    const [unconfirmed, nightNew, urgent] = isFirstLoginToday
      ? await Promise.all([
          prisma.serviceRequest.count({ where: unacknowledgedWhere }),
          prisma.serviceRequest.count({
            where: {
              ...unacknowledgedWhere,
              isAfterHours: true,
              ...(previousLoginAt && { createdAt: { gt: previousLoginAt } }),
            },
          }),
          prisma.serviceRequest.count({
            where: { ...unacknowledgedWhere, priority: "긴급" },
          }),
        ])
      : [0, 0, 0]

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: loginAt },
    })

    res.json({
      token: createToken(user),
      user: publicUser(user),
      asLoginBrief: isFirstLoginToday
        ? { nightNew, urgent, unconfirmed }
        : null,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "로그인 중 오류가 발생했습니다.",
    })
  }
})

// 다운로드 주소는 브라우저가 직접 열기 때문에 로그인 토큰 없이 허용.
// 나머지 /api 요청은 로그인 토큰이 필요합니다.
app.use("/api", async (req, res, next) => {
  try {
    if (
      req.path === "/auth/login" ||
      /^\/files\/\d+\/download$/.test(req.path) ||
      /^\/assets\/\d+\/qr\.svg$/.test(req.path) ||
      /^\/sites\/\d+\/qr\.svg$/.test(req.path)
    ) {
      return next()
    }

    const authorization =
      req.headers.authorization || ""

    const token =
      authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : ""

    if (!token) {
      return res.status(401).json({
        error: "로그인이 필요합니다.",
      })
    }

    const payload = jwt.verify(
      token,
      JWT_SECRET
    ) as any

    const user = await prisma.user.findUnique({
      where: {
        id: Number(payload.userId),
      },
    })

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "사용할 수 없는 계정입니다.",
      })
    }

    ;(req as any).currentUser = user

    next()
  } catch (error) {
    return res.status(401).json({
      error: "로그인이 만료되었습니다.",
    })
  }
})

function getCurrentUser(req: any) {
  return req.currentUser
}

function canManageUsers(user: any) {
  return (
    user.role === "MASTER" ||
    user.role === "ADMIN"
  )
}

function isMaster(user: any) {
  return user?.role === "MASTER"
}


function canUseAsIntakeCenter(user: any) {
  return (
    user?.role === "MASTER" ||
    user?.department === "AS팀"
  )
}


async function createAsIntakeNotifications(
  service: any
) {
  const isVisit =
    service.requestType ===
    "방문A/S"

  const targetDepartment =
    isVisit
      ? "CS팀"
      : "AS팀"

  const recipients =
    await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          {
            role: "MASTER",
          },
          {
            department:
              targetDepartment,
            role: {
              in: [
                "USER",
                "ADMIN",
              ],
            },
          },
        ],
      },
      select: {
        id: true,
      },
    })

  const title =
    service.priority ===
    "긴급"
      ? `🚨 긴급 ${service.requestType} 접수`
      : `신규 ${service.requestType} 접수`

  const messageParts = [
    service.site?.name,
    service.customerName,
    service.contact,
    service.requestContent,
  ]
    .filter(Boolean)
    .map(String)

  const message =
    messageParts
      .join(" · ")
      .slice(0, 300)

  for (const recipient of recipients) {
    const targetType =
      isVisit
        ? "SERVICE"
        : "AS_INTAKE"

    await prisma.notification.upsert({
      where: {
        userId_eventKey: {
          userId:
            recipient.id,
          eventKey:
            `AS_INTAKE_${service.id}`,
        },
      },
      update: {
        level:
          service.priority ===
          "긴급"
            ? "danger"
            : "info",
        title,
        message,
        targetType,
        targetId:
          service.id,
        source:
          "AS_CENTER",
        readAt:
          null,
      },
      create: {
        userId:
          recipient.id,
        eventKey:
          `AS_INTAKE_${service.id}`,
        type:
          "AS_INTAKE",
        level:
          service.priority ===
          "긴급"
            ? "danger"
            : "info",
        title,
        message,
        targetType,
        targetId:
          service.id,
        source:
          "AS_CENTER",
      },
    })
  }
}



async function createVisitHandoffNotifications(
  service: any,
  fromType: string
) {
  const recipients =
    await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          {
            role: "MASTER",
          },
          {
            department: "CS팀",
            role: {
              in: [
                "USER",
                "ADMIN",
              ],
            },
          },
        ],
      },
      select: {
        id: true,
      },
    })

  const title =
    service.priority === "긴급"
      ? `🚨 ${fromType} → 방문A/S 전환`
      : `${fromType} → 방문A/S 전환`

  const message =
    [
      service.site?.name,
      service.customerName,
      service.contact,
      service.requestContent,
      service.visitDate
        ? `희망방문 ${dateKey(service.visitDate)}`
        : null,
    ]
      .filter(Boolean)
      .map(String)
      .join(" · ")
      .slice(0, 300)

  for (const recipient of recipients) {
    await prisma.notification.upsert({
      where: {
        userId_eventKey: {
          userId:
            recipient.id,
          eventKey:
            `AS_HANDOFF_${service.id}`,
        },
      },
      update: {
        level:
          service.priority === "긴급"
            ? "danger"
            : "info",
        title,
        message,
        targetType:
          "SERVICE",
        targetId:
          service.id,
        source:
          "AS_CENTER",
        readAt:
          null,
      },
      create: {
        userId:
          recipient.id,
        eventKey:
          `AS_HANDOFF_${service.id}`,
        type:
          "AS_HANDOFF",
        level:
          service.priority === "긴급"
            ? "danger"
            : "info",
        title,
        message,
        targetType:
          "SERVICE",
        targetId:
          service.id,
        source:
          "AS_CENTER",
      },
    })
  }
}

function normalizePositiveIdList(value: any) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter(
          (item) =>
            Number.isInteger(item) &&
            item > 0
        )
    )
  )
}

function parseOptionalDate(value: any) {
  if (!value) return null

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}


function dateKey(value: Date | string | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function dayRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function installDaysFromSite(site: any) {
  const extra =
    site?.extraData &&
    typeof site.extraData === "object"
      ? site.extraData as Record<string, any>
      : {}

  return Math.min(
    31,
    Math.max(
      1,
      Math.floor(Number(extra.installDays) || 1)
    )
  )
}

function installOverlapsDate(site: any, targetDate: Date) {
  if (!site?.installDate) return false

  const start = new Date(site.installDate)
  const end = new Date(start)
  end.setDate(end.getDate() + installDaysFromSite(site) - 1)

  const targetKey = dateKey(targetDate)
  const startKey = dateKey(start)
  const endKey = dateKey(end)

  return Boolean(
    targetKey &&
    startKey &&
    endKey &&
    targetKey >= startKey &&
    targetKey <= endKey
  )
}

async function ensureDefaultChecklistTemplates() {
  const count =
    await prisma.checklistTemplate.count()

  if (count > 0) return

  const defaults = [
    {
      name: "A/S 기본 체크리스트",
      workType: "SERVICE",
      items: [
        "출발 전 현장/증상 정보 확인",
        "현장에서 증상 재현 및 원인 확인",
        "수리/교체 후 정상 동작 확인",
        "사용 자재 기록",
        "작업 사진 또는 증빙 첨부",
        "고객/현장 담당자에게 처리 결과 안내",
      ],
    },
    {
      name: "설치 기본 체크리스트",
      workType: "INSTALL",
      items: [
        "설치 장비 및 수량 확인",
        "키오스크 전원/부팅 확인",
        "센서 동작 확인",
        "카메라 동작 확인",
        "네트워크/인터넷 연결 확인",
        "관리 프로그램 실행 확인",
        "전체 기능 최종 테스트",
        "현장 정리 및 담당자 확인",
      ],
    },
  ]

  for (const template of defaults) {
    await prisma.checklistTemplate.create({
      data: {
        name: template.name,
        workType: template.workType,
        items: {
          create: template.items.map((label, index) => ({
            label,
            sortOrder: (index + 1) * 10,
            required: true,
          })),
        },
      },
    })
  }
}

async function ensureServiceChecklist(serviceRequestId: number) {
  const existing =
    await prisma.serviceChecklistItem.count({
      where: { serviceRequestId },
    })

  if (existing > 0) return

  const templates =
    await prisma.checklistTemplate.findMany({
      where: {
        workType: "SERVICE",
        isActive: true,
      },
      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    })

  let order = 10

  for (const template of templates) {
    for (const item of template.items) {
      await prisma.serviceChecklistItem.create({
        data: {
          serviceRequestId,
          label: item.label,
          sortOrder: order,
          required: item.required,
        },
      })
      order += 10
    }
  }
}

async function ensureSiteInstallChecklist(siteId: number) {
  const existing =
    await prisma.siteChecklistItem.count({
      where: { siteId },
    })

  if (existing > 0) return

  const templates =
    await prisma.checklistTemplate.findMany({
      where: {
        workType: "INSTALL",
        isActive: true,
      },
      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    })

  let order = 10

  for (const template of templates) {
    for (const item of template.items) {
      await prisma.siteChecklistItem.create({
        data: {
          siteId,
          label: item.label,
          sortOrder: order,
          required: item.required,
        },
      })
      order += 10
    }
  }
}


const resourceUploadDir = path.join(projectRoot, "uploads", "files")
fs.mkdirSync(resourceUploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, resourceUploadDir)
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname)
    cb(null, `${randomUUID()}${extension}`)
  },
})

const upload = multer({
  storage,
})

app.get("/api/health", (_req, res) => {
  res.json({
    message: "CS Manager API 서버가 정상 실행 중입니다.",
  })
})

// 현장 목록 조회
app.get("/api/sites", async (_req, res) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: {
        id: "desc",
      },
    })

    res.json(sites)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "현장 목록을 불러오지 못했습니다.",
    })
  }
})

// 현장 상세 조회
app.get("/api/sites/:id", async (req, res) => {
  try {
    const id = Number(req.params.id)

    const site = await prisma.site.findUnique({
      where: {
        id,
      },

      include: {
        histories: true,
        photos: true,

        siteFiles: {
          include: {
            file: true,
          },
        },

        managers: {
          include: {
            user: true,
          },
        },

        assets: {
          orderBy: {
            id: "desc",
          },
        },

        installChecklistItems: {
          include: {
            checkedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    })

    if (!site) {
      return res.status(404).json({
        error: "현장을 찾을 수 없습니다.",
      })
    }

    res.json(site)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "현장 정보를 불러오지 못했습니다.",
    })
  }
})

// 현장 등록
app.post("/api/sites", async (req, res) => {
  try {
    const {
      name,
      region,
      area,
      address,
      customerName,
      customerPhone,
      installDate,
      status,
      equipment,
      memo,
      extraData,
    } = req.body

    if (!name || !address) {
      return res.status(400).json({
        error: "현장명과 주소는 필수입니다.",
      })
    }

    const site = await prisma.site.create({
      data: {
        name,
        region: region || null,
        area: area || null,
        address,
        customerName: customerName || null,
        customerPhone: customerPhone || null,

        installDate: installDate
          ? new Date(installDate)
          : null,

        status: status || "설치 예정",
        equipment: equipment || null,
        memo: memo || null,
        extraData: extraData || null,
      },
    })

    res.status(201).json(site)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "현장을 등록하지 못했습니다.",
    })
  }
})

// 현장 수정
app.put("/api/sites/:id", async (req, res) => {
  try {
    const id = Number(req.params.id)

    const {
      name,
      region,
      area,
      address,
      customerName,
      customerPhone,
      installDate,
      status,
      equipment,
      memo,
      extraData,
    } = req.body

    const site = await prisma.site.update({
      where: {
        id,
      },

      data: {
        ...(name !== undefined && { name }),
        ...(region !== undefined && {
          region: region || null,
        }),
        ...(area !== undefined && {
          area: area || null,
        }),
        ...(address !== undefined && { address }),
        ...(customerName !== undefined && {
          customerName: customerName || null,
        }),
        ...(customerPhone !== undefined && {
          customerPhone: customerPhone || null,
        }),
        ...(installDate !== undefined && {
          installDate: installDate
            ? new Date(installDate)
            : null,
        }),
        ...(status !== undefined && { status }),
        ...(equipment !== undefined && {
          equipment: equipment || null,
        }),
        ...(memo !== undefined && {
          memo: memo || null,
        }),
        ...(extraData !== undefined && { extraData }),
      },
    })

    res.json(site)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "현장 정보를 수정하지 못했습니다.",
    })
  }
})

// 현장 삭제
app.delete("/api/sites/:id", async (req, res) => {
  try {
    const id = Number(req.params.id)

    await prisma.site.delete({
      where: {
        id,
      },
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "현장을 삭제하지 못했습니다.",
    })
  }
})

// 자료실 목록
app.get("/api/files", async (_req, res) => {
  try {
    const files = await prisma.file.findMany({
      orderBy: {
        id: "desc",
      },
    })

    res.json(files)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "자료실 목록을 불러오지 못했습니다.",
    })
  }
})

// 자료실 파일 업로드
app.post("/api/files/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "업로드할 파일이 없습니다.",
      })
    }

    const category = req.body.category || "기타"

    const relativePath = path
      .relative(projectRoot, req.file.path)
      .replaceAll("\\", "/")

    const savedFile = await prisma.file.create({
      data: {
        category,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        storagePath: relativePath,
        mimeType: req.file.mimetype || null,
        size: req.file.size,
      },
    })

    res.status(201).json(savedFile)
  } catch (error) {
    console.error(error)

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }

    res.status(500).json({
      error: "파일을 업로드하지 못했습니다.",
    })
  }
})

// 자료실 파일 다운로드
app.get("/api/files/:id/download", async (req, res) => {
  try {
    const id = Number(req.params.id)

    const file = await prisma.file.findUnique({
      where: {
        id,
      },
    })

    if (!file) {
      return res.status(404).json({
        error: "파일 정보를 찾을 수 없습니다.",
      })
    }

    const absolutePath = path.resolve(projectRoot, file.storagePath)

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        error: "서버에서 실제 파일을 찾을 수 없습니다.",
      })
    }

    res.download(absolutePath, file.originalName)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "파일을 다운로드하지 못했습니다.",
    })
  }
})


// 자료실 파일 분류 변경
app.patch("/api/files/:id", async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { category } = req.body

    if (!category) {
      return res.status(400).json({
        error: "변경할 분류가 필요합니다.",
      })
    }

    const file = await prisma.file.update({
      where: { id },
      data: { category },
    })

    res.json(file)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "파일 분류를 변경하지 못했습니다.",
    })
  }
})

// 자료실 파일을 특정 현장에 연결
app.post("/api/files/:id/sites", async (req, res) => {
  try {
    const fileId = Number(req.params.id)
    const siteId = Number(req.body.siteId)

    if (!siteId) {
      return res.status(400).json({
        error: "연결할 현장을 선택해주세요.",
      })
    }

    const linked = await prisma.siteFile.upsert({
      where: {
        siteId_fileId: {
          siteId,
          fileId,
        },
      },
      update: {},
      create: {
        siteId,
        fileId,
      },
      include: {
        site: true,
        file: true,
      },
    })

    res.status(201).json(linked)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "파일을 현장에 연결하지 못했습니다.",
    })
  }
})

// 현장 상세페이지에서 파일 연결 해제
app.delete("/api/site-files/:id", async (req, res) => {
  try {
    const id = Number(req.params.id)

    await prisma.siteFile.delete({
      where: { id },
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "파일 연결을 해제하지 못했습니다.",
    })
  }
})

// 자료실 파일 삭제
app.delete("/api/files/:id", async (req, res) => {
  try {
    const id = Number(req.params.id)

    const file = await prisma.file.findUnique({
      where: { id },
    })

    if (!file) {
      return res.status(404).json({
        error: "파일을 찾을 수 없습니다.",
      })
    }

    const absolutePath = path.resolve(projectRoot, file.storagePath)

    // 연결된 현장 자료 관계를 먼저 제거
    await prisma.siteFile.deleteMany({
      where: {
        fileId: id,
      },
    })

    // DB 기록 삭제
    await prisma.file.delete({
      where: { id },
    })

    // 실제 파일 삭제
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath)
    }

    res.json({
      success: true,
      message: "파일이 삭제되었습니다.",
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "파일을 삭제하지 못했습니다.",
    })
  }
})



const CURRENT_YEAR = new Date().getFullYear()

// ======================================================
// 로그인 사용자 / 비밀번호
// ======================================================

app.get("/api/me", async (req, res) => {
  res.json(
    publicUser(
      getCurrentUser(req)
    )
  )
})

app.post(
  "/api/auth/change-password",
  async (req, res) => {
    try {
      const user = getCurrentUser(req)

      const {
        currentPassword,
        newPassword,
      } = req.body

      if (
        !currentPassword ||
        !newPassword ||
        String(newPassword).length < 6
      ) {
        return res.status(400).json({
          error:
            "현재 비밀번호와 6자 이상의 새 비밀번호를 입력해주세요.",
        })
      }

      const matched = await bcrypt.compare(
        currentPassword,
        user.passwordHash
      )

      if (!matched) {
        return res.status(400).json({
          error: "현재 비밀번호가 맞지 않습니다.",
        })
      }

      const passwordHash = await bcrypt.hash(
        newPassword,
        12
      )

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,
        },
      })

      res.json({
        success: true,
      })
    } catch (error) {
      console.error(error)

      res.status(500).json({
        error: "비밀번호를 변경하지 못했습니다.",
      })
    }
  }
)

// ======================================================
// 직원 계정 관리
// ======================================================

app.get("/api/users", async (req, res) => {
  try {
    const me = getCurrentUser(req)

    if (!canManageUsers(me)) {
      return res.status(403).json({
        error: "직원 관리 권한이 없습니다.",
      })
    }

    const users = await prisma.user.findMany({
      orderBy: [
        {
          isActive: "desc",
        },
        {
          name: "asc",
        },
      ],
    })

    res.json(
      users.map(publicUser)
    )
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "직원 목록을 불러오지 못했습니다.",
    })
  }
})

app.post("/api/users", async (req, res) => {
  try {
    const me = getCurrentUser(req)

    if (!canManageUsers(me)) {
      return res.status(403).json({
        error: "직원 계정을 만들 권한이 없습니다.",
      })
    }

    const {
      username,
      password,
      name,
      department,
      position,
      phone,
      email,
      role,
      grantedDays,
    } = req.body

    if (
      !username ||
      !password ||
      !name
    ) {
      return res.status(400).json({
        error:
          "아이디, 비밀번호, 이름은 필수입니다.",
      })
    }

    const requestedRole =
      role || "USER"

    if (
      me.role !== "MASTER" &&
      requestedRole !== "USER"
    ) {
      return res.status(403).json({
        error:
          "ADMIN은 일반 직원 계정만 만들 수 있습니다.",
      })
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      )

    const user =
      await prisma.user.create({
        data: {
          username,
          passwordHash,
          name,
          department:
            department || null,
          position:
            position || null,
          phone:
            phone || null,
          email:
            email || null,
          role:
            requestedRole,
          isActive:
            true,
        },
      })

    await prisma.leaveBalance.create({
      data: {
        userId:
          user.id,
        year:
          CURRENT_YEAR,
        grantedDays:
          Number(grantedDays) || 15,
      },
    })

    res.status(201).json(
      publicUser(user)
    )
  } catch (error: any) {
    console.error(error)

    if (
      String(error?.message || "").includes(
        "Unique constraint"
      )
    ) {
      return res.status(409).json({
        error: "이미 사용 중인 아이디입니다.",
      })
    }

    res.status(500).json({
      error: "직원 계정을 만들지 못했습니다.",
    })
  }
})

app.put("/api/users/:id", async (req, res) => {
  try {
    const me = getCurrentUser(req)
    const id = Number(req.params.id)

    if (!canManageUsers(me)) {
      return res.status(403).json({
        error: "직원 수정 권한이 없습니다.",
      })
    }

    const target =
      await prisma.user.findUnique({
        where: {
          id,
        },
      })

    if (!target) {
      return res.status(404).json({
        error: "직원을 찾을 수 없습니다.",
      })
    }

    if (
      target.role === "MASTER" &&
      me.role !== "MASTER"
    ) {
      return res.status(403).json({
        error: "MASTER 계정은 수정할 수 없습니다.",
      })
    }

    const {
      name,
      department,
      position,
      phone,
      email,
      role,
      isActive,
    } = req.body

    let nextRole =
      role === undefined
        ? target.role
        : role

    if (
      me.role !== "MASTER" &&
      nextRole !== "USER"
    ) {
      return res.status(403).json({
        error:
          "ADMIN은 USER 권한만 관리할 수 있습니다.",
      })
    }

    if (
      target.id === me.id &&
      isActive === false
    ) {
      return res.status(400).json({
        error: "자기 계정은 비활성화할 수 없습니다.",
      })
    }

    const user =
      await prisma.user.update({
        where: {
          id,
        },
        data: {
          ...(name !== undefined && {
            name,
          }),
          ...(department !== undefined && {
            department:
              department || null,
          }),
          ...(position !== undefined && {
            position:
              position || null,
          }),
          ...(phone !== undefined && {
            phone:
              phone || null,
          }),
          ...(email !== undefined && {
            email:
              email || null,
          }),
          role:
            nextRole,
          ...(isActive !== undefined && {
            isActive:
              Boolean(isActive),
          }),
        },
      })

    res.json(
      publicUser(user)
    )
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "직원 정보를 수정하지 못했습니다.",
    })
  }
})

app.post(
  "/api/users/:id/reset-password",
  async (req, res) => {
    try {
      const me = getCurrentUser(req)
      const id = Number(req.params.id)

      if (!canManageUsers(me)) {
        return res.status(403).json({
          error: "비밀번호 초기화 권한이 없습니다.",
        })
      }

      const target =
        await prisma.user.findUnique({
          where: {
            id,
          },
        })

      if (!target) {
        return res.status(404).json({
          error: "직원을 찾을 수 없습니다.",
        })
      }

      if (
        target.role === "MASTER" &&
        me.role !== "MASTER"
      ) {
        return res.status(403).json({
          error: "MASTER 계정은 초기화할 수 없습니다.",
        })
      }

      const {
        password,
      } = req.body

      if (
        !password ||
        String(password).length < 6
      ) {
        return res.status(400).json({
          error: "새 비밀번호는 6자 이상이어야 합니다.",
        })
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        )

      await prisma.user.update({
        where: {
          id,
        },
        data: {
          passwordHash,
        },
      })

      res.json({
        success: true,
      })
    } catch (error) {
      console.error(error)

      res.status(500).json({
        error: "비밀번호를 초기화하지 못했습니다.",
      })
    }
  }
)

// ======================================================
// 공지사항
// ======================================================

app.get("/api/notices", async (_req, res) => {
  try {
    const notices =
      await prisma.notice.findMany({
        include: {
          author: {
            select: {
              id: true,
              name: true,
              department: true,
            },
          },
        },
        orderBy: [
          {
            isPinned: "desc",
          },
          {
            id: "desc",
          },
        ],
      })

    res.json(notices)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "공지사항을 불러오지 못했습니다.",
    })
  }
})

app.post("/api/notices", async (req, res) => {
  try {
    const {
      title,
      content,
      isPinned,
    } = req.body

    if (!title || !content) {
      return res.status(400).json({
        error: "공지 제목과 내용을 입력해주세요.",
      })
    }

    const user =
      getCurrentUser(req)

    const notice =
      await prisma.notice.create({
        data: {
          title,
          content,
          isPinned:
            Boolean(isPinned),
          authorId:
            user.id,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              department: true,
            },
          },
        },
      })

    res.status(201).json(notice)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "공지사항을 등록하지 못했습니다.",
    })
  }
})

app.put("/api/notices/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const {
      title,
      content,
      isPinned,
    } = req.body

    const notice =
      await prisma.notice.update({
        where: {
          id,
        },
        data: {
          ...(title !== undefined && {
            title,
          }),
          ...(content !== undefined && {
            content,
          }),
          ...(isPinned !== undefined && {
            isPinned:
              Boolean(isPinned),
          }),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              department: true,
            },
          },
        },
      })

    res.json(notice)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "공지사항을 수정하지 못했습니다.",
    })
  }
})

app.delete("/api/notices/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    await prisma.notice.delete({
      where: {
        id,
      },
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "공지사항을 삭제하지 못했습니다.",
    })
  }
})

// ======================================================
// 설치 관리
// 현장명 입력 + 설치 세부정보 저장
// ======================================================

app.post("/api/installations/save", async (req, res) => {
  try {
    const {
      siteId,
      siteName,
      installDate,
      status,
      equipment,
      installCategory,
      installDays,
      kioskModel,
      kioskCount,
      beamModel,
      sensorType,
      matUse,
      autoTeeUse,
      autoTeeMaker,
      managementProgram,
      cameraModel,
      internetInstall,
      partnerCompany,
      assigneeIds,
      installMemo,
    } = req.body

    const cleanSiteName =
      String(siteName || "").trim()

    if (!cleanSiteName) {
      return res.status(400).json({
        error: "현장명을 입력해주세요.",
      })
    }

    if (!installDate) {
      return res.status(400).json({
        error: "설치 예정일을 입력해주세요.",
      })
    }

    const parsedInstallDate =
      new Date(installDate)

    if (
      Number.isNaN(
        parsedInstallDate.getTime()
      )
    ) {
      return res.status(400).json({
        error: "설치 예정일을 확인해주세요.",
      })
    }

    const normalizedDays =
      Math.min(
        31,
        Math.max(
          1,
          Math.floor(
            Number(installDays) || 1
          )
        )
      )

    const normalizedAssigneeIds =
      Array.isArray(assigneeIds)
        ? Array.from(
            new Set(
              assigneeIds
                .map(Number)
                .filter(
                  (id) =>
                    Number.isInteger(id) &&
                    id > 0
                )
            )
          )
        : []

    let site =
      siteId
        ? await prisma.site.findUnique({
            where: {
              id: Number(siteId),
            },
          })
        : null

    if (!site) {
      site =
        await prisma.site.findFirst({
          where: {
            name: cleanSiteName,
          },
          orderBy: {
            id: "desc",
          },
        })
    }

    const previousExtra =
      site?.extraData &&
      typeof site.extraData === "object"
        ? (site.extraData as Record<string, any>)
        : {}

    const extraData = {
      ...previousExtra,

      installCategory:
        String(installCategory || "").trim(),

      installDays:
        normalizedDays,

      kioskModel:
        String(kioskModel || "").trim(),

      kioskCount:
        Math.max(
          0,
          Math.floor(
            Number(kioskCount) || 0
          )
        ),

      beamModel:
        String(beamModel || "").trim(),

      sensorType:
        String(sensorType || "").trim(),

      // 예전 버전과의 호환용
      ceilingSensor:
        String(sensorType || "").trim(),

      matUse:
        String(matUse || "").trim(),

      // 예전 버전과의 호환용
      mat:
        String(matUse || "").trim(),

      autoTeeUse:
        String(autoTeeUse || "").trim(),

      // 예전 버전과의 호환용
      autoTee:
        String(autoTeeUse || "").trim(),

      autoTeeMaker:
        String(autoTeeMaker || "").trim(),

      managementProgram:
        String(managementProgram || "").trim(),

      cameraModel:
        String(cameraModel || "").trim(),

      internetInstall:
        String(internetInstall || "").trim(),

      partnerCompany:
        String(partnerCompany || "").trim(),

      installAssigneeIds:
        normalizedAssigneeIds,

      installMemo:
        String(installMemo || "").trim(),
    }

    const savedSite =
      site
        ? await prisma.site.update({
            where: {
              id: site.id,
            },
            data: {
              name:
                cleanSiteName,
              installDate:
                parsedInstallDate,
              status:
                String(
                  status ||
                  "설치 예정"
                ),
              equipment:
                String(
                  equipment || ""
                ).trim() || null,
              extraData,
            },
          })
        : await prisma.site.create({
            data: {
              name:
                cleanSiteName,

              // 설치관리에서 현장명을 바로 입력해 만드는 경우
              // 주소/지역은 현장 상세에서 나중에 보완할 수 있습니다.
              address: "",

              installDate:
                parsedInstallDate,

              status:
                String(
                  status ||
                  "설치 예정"
                ),

              equipment:
                String(
                  equipment || ""
                ).trim() || null,

              extraData,
            },
          })

    res.json(savedSite)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "설치 정보를 저장하지 못했습니다.",
    })
  }
})

// ======================================================
// MASTER 선택항목 관리자
// ======================================================

app.get("/api/system-options", async (_req, res) => {
  try {
    const [
      groups,
      options,
    ] =
      await Promise.all([
        prisma.systemOptionGroup.findMany({
          where: {
            isActive: true,
          },
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              id: "asc",
            },
          ],
        }),

        prisma.systemOption.findMany({
          where: {
            isActive: true,
          },
          orderBy: [
            {
              groupKey: "asc",
            },
            {
              sortOrder: "asc",
            },
            {
              id: "asc",
            },
          ],
        }),
      ])

    res.json({
      groups,
      options,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "선택항목을 불러오지 못했습니다.",
    })
  }
})

app.post("/api/system-option-groups", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!isMaster(user)) {
      return res.status(403).json({
        error: "MASTER 계정만 선택항목 그룹을 추가할 수 있습니다.",
      })
    }

    const label =
      String(
        req.body.label || ""
      ).trim()

    if (!label) {
      return res.status(400).json({
        error: "선택항목 그룹 이름을 입력해주세요.",
      })
    }

    const existingGroups =
      await prisma.systemOptionGroup.findMany({
        where: {
          isActive: true,
        },
        select: {
          label: true,
        },
      })

    if (
      existingGroups.some(
        (group) =>
          group.label
            .trim()
            .toLowerCase() ===
          label.toLowerCase()
      )
    ) {
      return res.status(409).json({
        error: "같은 이름의 선택항목 그룹이 이미 있습니다.",
      })
    }

    const last =
      await prisma.systemOptionGroup.findFirst({
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: "desc",
        },
      })

    const key =
      `CUSTOM_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)
        .toUpperCase()}`

    const created =
      await prisma.systemOptionGroup.create({
        data: {
          key,
          label,
          isSystem: false,
          isActive: true,
          sortOrder:
            (last?.sortOrder || 0) +
            10,
        },
      })

    res.status(201).json(created)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "선택항목 그룹을 추가하지 못했습니다.",
    })
  }
})

app.put("/api/system-option-groups/:key", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!isMaster(user)) {
      return res.status(403).json({
        error: "MASTER 계정만 선택항목 그룹을 수정할 수 있습니다.",
      })
    }

    const key =
      String(
        req.params.key || ""
      ).trim()

    const label =
      String(
        req.body.label || ""
      ).trim()

    if (!label) {
      return res.status(400).json({
        error: "변경할 그룹 이름을 입력해주세요.",
      })
    }

    const existing =
      await prisma.systemOptionGroup.findUnique({
        where: {
          key,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "선택항목 그룹을 찾을 수 없습니다.",
      })
    }

    const renamed =
      await prisma.$transaction(async (tx) => {
        const group =
          await tx.systemOptionGroup.update({
            where: {
              key,
            },
            data: {
              label,
            },
          })

        await tx.systemOption.updateMany({
          where: {
            groupKey: key,
          },
          data: {
            groupLabel: label,
          },
        })

        return group
      })

    res.json(renamed)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "선택항목 그룹 이름을 변경하지 못했습니다.",
    })
  }
})

app.delete("/api/system-option-groups/:key", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!isMaster(user)) {
      return res.status(403).json({
        error: "MASTER 계정만 선택항목 그룹을 삭제할 수 있습니다.",
      })
    }

    const key =
      String(
        req.params.key || ""
      ).trim()

    const existing =
      await prisma.systemOptionGroup.findUnique({
        where: {
          key,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "선택항목 그룹을 찾을 수 없습니다.",
      })
    }

    if (existing.isSystem) {
      return res.status(400).json({
        error: "실제 화면과 연결된 기본 그룹은 삭제할 수 없습니다. 이름 변경은 가능합니다.",
      })
    }

    await prisma.$transaction([
      prisma.systemOptionGroup.update({
        where: {
          key,
        },
        data: {
          isActive: false,
        },
      }),

      prisma.systemOption.updateMany({
        where: {
          groupKey: key,
        },
        data: {
          isActive: false,
        },
      }),
    ])

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "선택항목 그룹을 삭제하지 못했습니다.",
    })
  }
})

app.post("/api/system-options", async (req, res) => {
  try {
    const user = getCurrentUser(req)

    if (!isMaster(user)) {
      return res.status(403).json({
        error: "MASTER 계정만 선택항목을 추가할 수 있습니다.",
      })
    }

    const groupKey = String(req.body.groupKey || "").trim()
    const value = String(req.body.value || "").trim()
    const group =
      await prisma.systemOptionGroup.findUnique({
        where: {
          key: groupKey,
        },
      })

    if (
      !group ||
      !group.isActive
    ) {
      return res.status(400).json({
        error: "선택항목 그룹을 확인해주세요.",
      })
    }

    if (!value) {
      return res.status(400).json({ error: "추가할 항목명을 입력해주세요." })
    }

    if (groupKey === "INSTALL_DAYS") {
      const days = Number(value)
      if (!Number.isInteger(days) || days < 1 || days > 31) {
        return res.status(400).json({
          error: "설치 작업 일수는 1~31 사이의 숫자로 입력해주세요.",
        })
      }
    }

    const existing = await prisma.systemOption.findUnique({
      where: {
        groupKey_value: { groupKey, value },
      },
    })

    if (existing) {
      const restored = await prisma.systemOption.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          groupLabel:
            group.label,
        },
      })
      return res.json(restored)
    }

    const last = await prisma.systemOption.findFirst({
      where: { groupKey, isActive: true },
      orderBy: { sortOrder: "desc" },
    })

    const created = await prisma.systemOption.create({
      data: {
        groupKey,
        groupLabel: group.label,
        value,
        sortOrder: (last?.sortOrder || 0) + 10,
        isActive: true,
        isLocked: false,
      },
    })

    res.status(201).json(created)
  } catch (error: any) {
    console.error(error)
    if (String(error?.code || "") === "P2002") {
      return res.status(409).json({ error: "이미 등록된 항목입니다." })
    }
    res.status(500).json({ error: "선택항목을 추가하지 못했습니다." })
  }
})

app.put("/api/system-options/:id", async (req, res) => {
  try {
    const user = getCurrentUser(req)

    if (!isMaster(user)) {
      return res.status(403).json({
        error: "MASTER 계정만 선택항목을 수정할 수 있습니다.",
      })
    }

    const id = Number(req.params.id)
    const existing = await prisma.systemOption.findUnique({ where: { id } })

    if (!existing) {
      return res.status(404).json({ error: "선택항목을 찾을 수 없습니다." })
    }

    if (existing.isLocked) {
      return res.status(400).json({
        error: "시스템 기본 항목은 이름을 변경할 수 없습니다.",
      })
    }

    const value = String(req.body.value || "").trim()

    if (!value) {
      return res.status(400).json({ error: "항목명을 입력해주세요." })
    }

    if (existing.groupKey === "INSTALL_DAYS") {
      const days = Number(value)
      if (!Number.isInteger(days) || days < 1 || days > 31) {
        return res.status(400).json({
          error: "설치 작업 일수는 1~31 사이의 숫자로 입력해주세요.",
        })
      }
    }

    const updated = await prisma.systemOption.update({
      where: { id },
      data: { value },
    })

    res.json(updated)
  } catch (error: any) {
    console.error(error)
    if (String(error?.code || "") === "P2002") {
      return res.status(409).json({
        error: "같은 그룹에 이미 존재하는 항목명입니다.",
      })
    }
    res.status(500).json({ error: "선택항목을 수정하지 못했습니다." })
  }
})

app.delete("/api/system-options/:id", async (req, res) => {
  try {
    const user = getCurrentUser(req)

    if (!isMaster(user)) {
      return res.status(403).json({
        error: "MASTER 계정만 선택항목을 삭제할 수 있습니다.",
      })
    }

    const id = Number(req.params.id)
    const existing = await prisma.systemOption.findUnique({ where: { id } })

    if (!existing) {
      return res.status(404).json({ error: "선택항목을 찾을 수 없습니다." })
    }

    if (existing.isLocked) {
      return res.status(400).json({
        error: "시스템 동작에 필요한 기본 항목은 삭제할 수 없습니다.",
      })
    }

    await prisma.systemOption.update({
      where: { id },
      data: { isActive: false },
    })

    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "선택항목을 삭제하지 못했습니다." })
  }
})

// ======================================================
// 월간 통합 일정
// 설치 + A/S 방문 + 승인 연차
// ======================================================

app.get("/api/schedule/month", async (req, res) => {
  try {
    const now = new Date()

    const year =
      Number(req.query.year) ||
      now.getFullYear()

    const month =
      Number(req.query.month) ||
      now.getMonth() + 1

    if (
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({
        error: "월 정보를 확인해주세요.",
      })
    }

    const from =
      new Date(
        year,
        month - 1,
        1
      )

    const to =
      new Date(
        year,
        month,
        1
      )

    const [
      installationSites,
      serviceVisits,
      leaveRequests,
    ] =
      await Promise.all([
        prisma.site.findMany({
          where: {
            // 최대 31일 작업을 지원하므로
            // 이전 달 말에 시작해 이번 달로 넘어오는 작업도 가져옵니다.
            installDate: {
              gte: new Date(
                from.getFullYear(),
                from.getMonth(),
                from.getDate() - 31
              ),
              lt: to,
            },
          },
          orderBy: {
            installDate: "asc",
          },
        }),

        prisma.serviceRequest.findMany({
          where: {
            visitDate: {
              gte: from,
              lt: to,
            },
          },
          include: {
            site: {
              select: {
                id: true,
                name: true,
                region: true,
                address: true,
              },
            },
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    position: true,
                  },
                },
              },
              orderBy: {
                id: "asc",
              },
            },
          },
          orderBy: {
            visitDate: "asc",
          },
        }),

        prisma.leaveRequest.findMany({
          where: {
            status: "APPROVED",
            AND: [
              {
                startDate: {
                  lt: to,
                },
              },
              {
                endDate: {
                  gte: from,
                },
              },
            ],
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                department: true,
                position: true,
              },
            },
          },
          orderBy: {
            startDate: "asc",
          },
        }),
      ])

    const dateOnly = (
      value: Date | null
    ) =>
      value
        ? value
            .toISOString()
            .slice(0, 10)
        : null

    const events: any[] = []

    const installationEvents =
      installationSites
        .map((site) => {
          if (!site.installDate) {
            return null
          }

          const extra =
            site.extraData &&
            typeof site.extraData === "object"
              ? (site.extraData as Record<string, any>)
              : {}

          const installDays =
            Math.min(
              31,
              Math.max(
                1,
                Math.floor(
                  Number(
                    extra.installDays
                  ) || 1
                )
              )
            )

          const start =
            new Date(
              site.installDate
            )

          const end =
            new Date(start)

          end.setDate(
            end.getDate() +
              installDays -
              1
          )

          // 이번 달과 하나도 겹치지 않는 작업은 제외
          if (
            end < from ||
            start >= to
          ) {
            return null
          }

          const startDate =
            dateOnly(start)

          const endDate =
            dateOnly(end)

          if (
            !startDate ||
            !endDate
          ) {
            return null
          }

          return {
            id:
              `install-${site.id}`,
            type:
              "INSTALL",
            date:
              startDate,
            startDate,
            endDate,
            installDays,
            title:
              site.name,
            subtitle:
              `${site.status || "설치 예정"} · ${installDays}일 작업`,
            status:
              site.status ||
              "설치 예정",
            siteId:
              site.id,
            region:
              site.region,
            address:
              site.address,
            equipment:
              site.equipment,
          }
        })
        .filter(Boolean)

    events.push(
      ...installationEvents
    )

    for (
      const service of
      serviceVisits
    ) {
      const date =
        dateOnly(
          service.visitDate
        )

      if (!date) continue

      events.push({
        id:
          `service-${service.id}`,
        type:
          "SERVICE",
        date,
        startDate:
          date,
        endDate:
          date,
        title:
          service.site?.name ||
          "A/S",
        subtitle:
          service.requestContent,
        status:
          service.status,
        serviceRequestId:
          service.id,
        siteId:
          service.siteId,
        region:
          service.site?.region ||
          null,
        address:
          service.site?.address ||
          null,
        assignees:
          service.assignees
            .map(
              (item) =>
                item.user?.name
            )
            .filter(Boolean),
      })
    }

    for (
      const leave of
      leaveRequests
    ) {
      const startDate =
        dateOnly(
          leave.startDate
        )

      const endDate =
        dateOnly(
          leave.endDate
        )

      if (
        !startDate ||
        !endDate
      ) {
        continue
      }

      events.push({
        id:
          `leave-${leave.id}`,
        type:
          "LEAVE",
        startDate,
        endDate,
        title:
          leave.user?.name ||
          "직원",
        subtitle:
          leave.leaveType ||
          "연차",
        status:
          leave.status,
        leaveRequestId:
          leave.id,
        userId:
          leave.userId,
        days:
          leave.days,
      })
    }

    res.json({
      year,
      month,
      summary: {
        installations:
          installationEvents.length,
        scheduledInstallations:
          installationEvents.filter(
            (event: any) =>
              event.status ===
              "설치 예정"
          ).length,
        serviceVisits:
          serviceVisits.length,
        leaves:
          leaveRequests.length,
      },
      events,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "월간 통합 일정을 불러오지 못했습니다.",
    })
  }
})

// ======================================================
// A/S 관리
// ======================================================

const serviceRequestInclude = {
  site: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      department: true,
      position: true,
    },
  },
  assignees: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          department: true,
          position: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
} as const

const serviceRequestDetailInclude = {
  site: {
    include: {
      assets: {
        orderBy: {
          id: "desc",
        },
      },
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      department: true,
      position: true,
    },
  },
  assignees: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          department: true,
          position: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
  files: {
    include: {
      file: true,
    },
    orderBy: {
      id: "desc",
    },
  },
  activities: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  checklistItems: {
    include: {
      checkedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      sortOrder: "asc",
    },
  },
  workLog: {
    include: {
      materials: {
        include: {
          item: true,
        },
      },
    },
  },
} as const

app.get("/api/team-members", async (_req, res) => {
  try {
    const members =
      await prisma.user.findMany({
        where: {
          isActive: true,
          role: {
            in: ["USER", "ADMIN"],
          },
        },
        select: {
          id: true,
          name: true,
          department: true,
          position: true,
          role: true,
        },
        orderBy: [
          {
            department: "asc",
          },
          {
            name: "asc",
          },
        ],
      })

    res.json(members)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "담당자 목록을 불러오지 못했습니다.",
    })
  }
})

// ======================================================
// A/S팀 전용 접수센터
// ======================================================

app.get("/api/as-center", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({
        error: "A/S 접수센터 접근 권한이 없습니다.",
      })
    }

    const dateText =
      String(
        req.query.date ||
        dateKey(new Date()) ||
        ""
      )

    const { start, end } =
      dayRange(dateText)

    const [
      todayRows,
      recentRows,
      operatingSetting,
    ] =
      await Promise.all([
        prisma.serviceRequest.findMany({
          where: {
            receivedDate: {
              gte: start,
              lt: end,
            },
          },
          include:
            serviceRequestInclude,
          orderBy: [
            { createdAt: "desc" },
            { id: "desc" },
          ],
        }),

        prisma.serviceRequest.findMany({
          include:
            serviceRequestInclude,
          orderBy: [
            { createdAt: "desc" },
            { id: "desc" },
          ],
          take: 100,
        }),
        getAsOperatingSetting(),
      ])

    const countType =
      (type: string) =>
        todayRows.filter(
          (row) =>
            row.requestType ===
            type
        ).length

    res.json({
      date:
        dateText,
      summary: {
        total:
          todayRows.length,
        remote:
          countType("원격A/S"),
        visit:
          countType("방문A/S"),
        consult:
          countType("상담"),
        pending:
          todayRows.filter(
            (row) =>
              row.status !==
              "완료"
          ).length,
        completed:
          todayRows.filter(
            (row) =>
              row.status ===
              "완료"
          ).length,
        urgent:
          todayRows.filter(
            (row) =>
              row.priority ===
              "긴급"
          ).length,
        afterHours:
          todayRows.filter((row) => row.isAfterHours).length,
        unconfirmed:
          recentRows.filter((row) => !row.acknowledgedAt && row.status !== "완료").length,
      },
      operatingSetting,
      today:
        todayRows,
      recent:
        recentRows,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 접수센터 정보를 불러오지 못했습니다.",
    })
  }
})

app.post("/api/as-center/intake", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({
        error: "A/S 접수센터 등록 권한이 없습니다.",
      })
    }

    const siteName =
      String(
        req.body.siteName || ""
      ).trim()

    const requestType =
      String(
        req.body.requestType ||
        "방문A/S"
      ).trim() || "방문A/S"

    const intakeChannel =
      String(
        req.body.intakeChannel ||
        "전화"
      ).trim() || "전화"

    const customerName =
      String(
        req.body.customerName || ""
      ).trim() || null

    const contact =
      String(
        req.body.contact || ""
      ).trim() || null

    const requestContent =
      String(
        req.body.requestContent || ""
      ).trim()

    const priority =
      String(
        req.body.priority ||
        "일반"
      ).trim() || "일반"

    const memo =
      String(
        req.body.memo || ""
      ).trim() || null

    const visitDate =
      req.body.visitDate
        ? parseOptionalDate(
            req.body.visitDate
          )
        : null

    if (
      !siteName ||
      !requestContent
    ) {
      return res.status(400).json({
        error: "현장명과 문의/증상 내용은 필수입니다.",
      })
    }

    if (
      req.body.visitDate &&
      !visitDate
    ) {
      return res.status(400).json({
        error: "희망 방문일을 확인해주세요.",
      })
    }

    let site =
      await prisma.site.findFirst({
        where: {
          name:
            siteName,
        },
        orderBy: {
          id: "desc",
        },
      })

    if (!site) {
      site =
        await prisma.site.create({
          data: {
            name:
              siteName,
            address: "",
            customerName,
            customerPhone:
              contact,
            status:
              "설치 완료",
            extraData: {
              createdFrom:
                "AS_INTAKE_CENTER",
            },
          },
        })
    } else if (
      customerName ||
      contact
    ) {
      site =
        await prisma.site.update({
          where: {
            id:
              site.id,
          },
          data: {
            ...(customerName && {
              customerName,
            }),
            ...(contact && {
              customerPhone:
                contact,
            }),
          },
        })
    }

    const oneDayAgo =
      new Date()

    oneDayAgo.setHours(
      oneDayAgo.getHours() -
      24
    )

    const duplicateCandidates =
      await prisma.serviceRequest.findMany({
        where: {
          createdAt: {
            gte:
              oneDayAgo,
          },
          status: {
            not:
              "완료",
          },
          OR: [
            {
              siteId:
                site.id,
            },
            ...(contact
              ? [
                  {
                    contact,
                  },
                ]
              : []),
          ],
        },
        include:
          serviceRequestInclude,
        orderBy: {
          createdAt:
            "desc",
        },
        take: 5,
      })

    const receivedAt = new Date()
    const isAfterHours =
      await isAfterAsOperatingHours(receivedAt)

    const created =
      await prisma.serviceRequest.create({
        data: {
          siteId:
            site.id,
          createdById:
            user.id,
          receivedDate:
            receivedAt,
          isAfterHours,
          visitDate:
            requestType ===
              "방문A/S"
              ? visitDate
              : null,
          requestContent,
          requestType,
          intakeChannel,
          customerName,
          priority,
          contact:
            contact ||
            site.customerPhone ||
            null,
          billingType:
            "무상",
          billingAmount:
            0,
          status:
            "접수",
          memo,
        },
        include:
          serviceRequestInclude,
      })

    await prisma.serviceActivity.create({
      data: {
        serviceRequestId:
          created.id,
        userId:
          user.id,
        type:
          "INTAKE",
        title:
          `${requestType} 접수`,
        content:
          `${intakeChannel} 접수 · ${requestContent}`,
      },
    })

    if (
      requestType ===
      "방문A/S"
    ) {
      await prisma.serviceActivity.create({
        data: {
          serviceRequestId:
            created.id,
          userId:
            user.id,
          type:
            "HANDOFF",
          title:
            "CS팀 방문 A/S 접수 생성",
          content:
            "CS팀 A/S 관리 화면에 자동 등록되었습니다.",
        },
      })
    }

    await createAsIntakeNotifications(
      created
    )

    res.status(201).json({
      request:
        created,
      duplicateCandidates,
      handedOffToCs:
        requestType ===
        "방문A/S",
      notificationCreated:
        true,
      isAfterHours,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 접수를 등록하지 못했습니다.",
    })
  }
})

app.get("/api/as-operating-setting", async (req, res) => {
  try {
    const user = getCurrentUser(req)
    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({ error: "A/S 운영 설정 조회 권한이 없습니다." })
    }
    res.json(await getAsOperatingSetting())
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "A/S 운영 설정을 불러오지 못했습니다." })
  }
})

app.put("/api/as-operating-setting", async (req, res) => {
  try {
    const user = getCurrentUser(req)
    if (!isMaster(user)) {
      return res.status(403).json({ error: "MASTER만 A/S 운영 설정을 변경할 수 있습니다." })
    }
    const startTime = String(req.body.startTime || "")
    const endTime = String(req.body.endTime || "")
    const workingDays = Array.isArray(req.body.workingDays)
      ? req.body.workingDays.map(Number).filter((day: number) => day >= 0 && day <= 6)
      : []
    const holidays = Array.isArray(req.body.holidays)
      ? [...new Set(req.body.holidays.map((value: any) => String(value).trim()).filter(Boolean))]
      : []
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
        startTime >= endTime || !workingDays.length) {
      return res.status(400).json({ error: "업무시간과 근무 요일을 확인해주세요." })
    }
    const setting = await prisma.asOperatingSetting.upsert({
      where: { id: 1 },
      update: { startTime, endTime, workingDays, holidays },
      create: { id: 1, startTime, endTime, workingDays, holidays },
    })
    res.json(setting)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "A/S 운영 설정을 저장하지 못했습니다." })
  }
})

app.post("/api/as-center/:id/acknowledge", async (req, res) => {
  try {
    const user = getCurrentUser(req)
    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({ error: "A/S 접수 확인 권한이 없습니다." })
    }
    const id = Number(req.params.id)
    const existing = await prisma.serviceRequest.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: "접수 건을 찾을 수 없습니다." })
    }
    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: { acknowledgedAt: new Date(), acknowledgedById: user.id },
      include: serviceRequestInclude,
    })
    await prisma.serviceActivity.create({
      data: {
        serviceRequestId: id,
        userId: user.id,
        type: "ACKNOWLEDGE",
        title: "접수 확인 완료",
        content: `${user.name}님이 접수 내용을 확인했습니다.`,
      },
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "접수 확인 상태를 저장하지 못했습니다." })
  }
})

app.get("/api/as-center/:id", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({
        error: "A/S 접수센터 접근 권한이 없습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const row =
      await prisma.serviceRequest.findUnique({
        where: {
          id,
        },
        include: {
          site: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
            },
          },
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  department: true,
                  position: true,
                },
              },
            },
            orderBy: {
              id: "asc",
            },
          },
          activities: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      })

    if (!row) {
      return res.status(404).json({
        error: "접수 건을 찾을 수 없습니다.",
      })
    }

    res.json(row)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 처리 정보를 불러오지 못했습니다.",
    })
  }
})

app.post("/api/as-center/:id/start", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({
        error: "A/S 처리 권한이 없습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const existing =
      await prisma.serviceRequest.findUnique({
        where: {
          id,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "접수 건을 찾을 수 없습니다.",
      })
    }

    if (
      existing.requestType ===
      "방문A/S"
    ) {
      return res.status(400).json({
        error: "방문 A/S는 CS팀 A/S 관리에서 처리해주세요.",
      })
    }

    if (
      existing.status ===
      "완료"
    ) {
      return res.status(400).json({
        error: "이미 완료된 접수입니다.",
      })
    }

    const updated =
      await prisma.serviceRequest.update({
        where: {
          id,
        },
        data: {
          status:
            "처리 중",
        },
      })

    await prisma.serviceActivity.create({
      data: {
        serviceRequestId:
          id,
        userId:
          user.id,
        type:
          "STATUS",
        title:
          "처리 시작",
        content:
          `${user.name}님이 ${existing.requestType} 처리를 시작했습니다.`,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "처리 시작을 반영하지 못했습니다.",
    })
  }
})

app.post("/api/as-center/:id/hold", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({
        error: "A/S 처리 권한이 없습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const reason =
      String(
        req.body.reason || ""
      ).trim()

    const existing =
      await prisma.serviceRequest.findUnique({
        where: {
          id,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "접수 건을 찾을 수 없습니다.",
      })
    }

    if (
      existing.requestType ===
      "방문A/S"
    ) {
      return res.status(400).json({
        error: "방문 A/S는 CS팀 A/S 관리에서 처리해주세요.",
      })
    }

    if (
      existing.status ===
      "완료"
    ) {
      return res.status(400).json({
        error: "이미 완료된 접수입니다.",
      })
    }

    const updated =
      await prisma.serviceRequest.update({
        where: {
          id,
        },
        data: {
          status:
            "보류",
          memo:
            reason
              ? [
                  existing.memo,
                  `[보류] ${reason}`,
                ]
                  .filter(Boolean)
                  .join("\n")
              : existing.memo,
        },
      })

    await prisma.serviceActivity.create({
      data: {
        serviceRequestId:
          id,
        userId:
          user.id,
        type:
          "STATUS",
        title:
          "처리 보류",
        content:
          reason || "보류 처리",
      },
    })

    res.json(updated)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "보류 처리를 반영하지 못했습니다.",
    })
  }
})

app.post("/api/as-center/:id/complete", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({
        error: "A/S 완료 권한이 없습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const resolution =
      String(
        req.body.resolution || ""
      ).trim()

    if (!resolution) {
      return res.status(400).json({
        error: "처리 결과를 입력해주세요.",
      })
    }

    const existing =
      await prisma.serviceRequest.findUnique({
        where: {
          id,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "접수 건을 찾을 수 없습니다.",
      })
    }

    if (
      existing.requestType ===
      "방문A/S"
    ) {
      return res.status(400).json({
        error: "방문 A/S는 CS팀 A/S 상세에서 완료해주세요.",
      })
    }

    if (
      existing.status ===
      "완료"
    ) {
      return res.status(400).json({
        error: "이미 완료된 접수입니다.",
      })
    }

    const updated =
      await prisma.serviceRequest.update({
        where: {
          id,
        },
        data: {
          resolution,
          status:
            "완료",
          completedAt:
            new Date(),
        },
        include: {
          site: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
            },
          },
        },
      })

    await prisma.serviceActivity.create({
      data: {
        serviceRequestId:
          id,
        userId:
          user.id,
        type:
          "COMPLETE",
        title:
          `${existing.requestType} 완료`,
        content:
          resolution,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "완료 처리를 반영하지 못했습니다.",
    })
  }
})

app.post("/api/as-center/:id/convert", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canUseAsIntakeCenter(user)) {
      return res.status(403).json({
        error: "A/S 유형 전환 권한이 없습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const targetType =
      String(
        req.body.targetType || ""
      ).trim()

    const visitDate =
      req.body.visitDate
        ? parseOptionalDate(
            req.body.visitDate
          )
        : null

    const reason =
      String(
        req.body.reason || ""
      ).trim()

    if (
      ![
        "원격A/S",
        "방문A/S",
      ].includes(
        targetType
      )
    ) {
      return res.status(400).json({
        error: "전환할 A/S 유형을 확인해주세요.",
      })
    }

    if (
      targetType ===
        "방문A/S" &&
      req.body.visitDate &&
      !visitDate
    ) {
      return res.status(400).json({
        error: "희망 방문일을 확인해주세요.",
      })
    }

    const existing =
      await prisma.serviceRequest.findUnique({
        where: {
          id,
        },
        include: {
          site: true,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "접수 건을 찾을 수 없습니다.",
      })
    }

    if (
      existing.status ===
      "완료"
    ) {
      return res.status(400).json({
        error: "완료된 접수는 유형을 변경할 수 없습니다.",
      })
    }

    if (
      existing.requestType ===
      targetType
    ) {
      return res.status(400).json({
        error: "현재와 같은 유형입니다.",
      })
    }

    if (
      existing.requestType ===
        "원격A/S" &&
      targetType !==
        "방문A/S"
    ) {
      return res.status(400).json({
        error: "원격 A/S는 방문 A/S로만 전환할 수 있습니다.",
      })
    }

    if (
      existing.requestType ===
        "방문A/S"
    ) {
      return res.status(400).json({
        error: "이미 CS팀 방문 A/S로 전달된 건입니다.",
      })
    }

    const updated =
      await prisma.serviceRequest.update({
        where: {
          id,
        },
        data: {
          requestType:
            targetType,
          status:
            "접수",
          visitDate:
            targetType ===
            "방문A/S"
              ? visitDate
              : null,
          memo:
            reason
              ? [
                  existing.memo,
                  `[${existing.requestType} → ${targetType}] ${reason}`,
                ]
                  .filter(Boolean)
                  .join("\n")
              : existing.memo,
        },
        include: {
          site: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
            },
          },
        },
      })

    await prisma.serviceActivity.create({
      data: {
        serviceRequestId:
          id,
        userId:
          user.id,
        type:
          targetType ===
          "방문A/S"
            ? "HANDOFF"
            : "STATUS",
        title:
          `${existing.requestType} → ${targetType} 전환`,
        content:
          reason ||
          (
            targetType ===
            "방문A/S"
              ? "원격/상담 처리로 해결되지 않아 CS팀 방문 A/S로 전달했습니다."
              : "상담 중 원격지원이 필요해 원격 A/S로 전환했습니다."
          ),
      },
    })

    if (
      targetType ===
      "방문A/S"
    ) {
      await createVisitHandoffNotifications(
        updated,
        existing.requestType
      )
    }

    res.json({
      request:
        updated,
      handedOffToCs:
        targetType ===
        "방문A/S",
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 유형을 전환하지 못했습니다.",
    })
  }
})

app.get("/api/service-requests", async (req, res) => {
  try {
    const status =
      String(req.query.status || "").trim()

    const q =
      String(req.query.q || "").trim()

    const requestType =
      String(
        req.query.requestType || ""
      ).trim()

    const rows =
      await prisma.serviceRequest.findMany({
        where: {
          ...(status &&
            status !== "전체" && {
              status,
            }),
          ...(requestType &&
            requestType !== "전체" && {
              requestType,
            }),
          ...(q && {
            OR: [
              {
                requestContent: {
                  contains: q,
                },
              },
              {
                resolution: {
                  contains: q,
                },
              },
              {
                contact: {
                  contains: q,
                },
              },
              {
                site: {
                  is: {
                    OR: [
                      {
                        name: {
                          contains: q,
                        },
                      },
                      {
                        address: {
                          contains: q,
                        },
                      },
                      {
                        region: {
                          contains: q,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }),
        },
        include:
          serviceRequestInclude,
        orderBy: [
          {
            status: "asc",
          },
          {
            visitDate: "asc",
          },
          {
            receivedDate: "desc",
          },
          {
            id: "desc",
          },
        ],
        take: 500,
      })

    res.json(rows)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 현황을 불러오지 못했습니다.",
    })
  }
})

app.get("/api/service-requests/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const exists =
      await prisma.serviceRequest.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
        },
      })

    if (!exists) {
      return res.status(404).json({
        error: "A/S 건을 찾을 수 없습니다.",
      })
    }

    await ensureServiceChecklist(id)

    const row =
      await prisma.serviceRequest.findUnique({
        where: {
          id,
        },
        include:
          serviceRequestDetailInclude,
      })

    if (!row) {
      return res.status(404).json({
        error: "A/S 건을 찾을 수 없습니다.",
      })
    }

    res.json(row)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 정보를 불러오지 못했습니다.",
    })
  }
})

app.post("/api/service-requests", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    const siteId =
      Number(req.body.siteId)

    const receivedDate =
      parseOptionalDate(
        req.body.receivedDate
      )

    const visitDate =
      req.body.visitDate
        ? parseOptionalDate(
            req.body.visitDate
          )
        : null

    const requestContent =
      String(
        req.body.requestContent || ""
      ).trim()

    const requestType =
      String(
        req.body.requestType ||
        "방문A/S"
      ).trim() || "방문A/S"

    const intakeChannel =
      String(
        req.body.intakeChannel ||
        "직접등록"
      ).trim() || "직접등록"

    const customerName =
      String(
        req.body.customerName || ""
      ).trim() || null

    const priority =
      String(
        req.body.priority ||
        "일반"
      ).trim() || "일반"

    const resolution =
      String(
        req.body.resolution || ""
      ).trim() || null

    const contact =
      String(
        req.body.contact || ""
      ).trim() || null

    const billingType =
      String(
        req.body.billingType ||
        "무상"
      ).trim() || "무상"

    const billingAmount =
      billingType !== "무상"
        ? Math.max(
            0,
            Math.floor(
              Number(
                req.body.billingAmount
              ) || 0
            )
          )
        : 0

    const status =
      String(
        req.body.status ||
        "접수"
      ).trim() || "접수"

    const memo =
      String(
        req.body.memo || ""
      ).trim() || null

    const assigneeIds =
      normalizePositiveIdList(
        req.body.assigneeIds
      )

    if (
      !Number.isInteger(siteId) ||
      siteId <= 0 ||
      !receivedDate ||
      !requestContent
    ) {
      return res.status(400).json({
        error: "현장, 접수일, 요청/증상 내용은 필수입니다.",
      })
    }

    if (
      req.body.visitDate &&
      !visitDate
    ) {
      return res.status(400).json({
        error: "방문일을 확인해주세요.",
      })
    }

    const site =
      await prisma.site.findUnique({
        where: {
          id: siteId,
        },
      })

    if (!site) {
      return res.status(404).json({
        error: "선택한 현장을 찾을 수 없습니다.",
      })
    }

    const created =
      await prisma.serviceRequest.create({
        data: {
          siteId,
          createdById:
            user.id,
          receivedDate,
          isAfterHours:
            await isAfterAsOperatingHours(new Date()),
          visitDate,
          requestContent,
          requestType,
          intakeChannel,
          customerName,
          priority,
          resolution,
          contact:
            contact ||
            site.customerPhone ||
            null,
          billingType,
          billingAmount,
          status,
          memo,
          assignees: {
            create:
              assigneeIds.map(
                (userId) => ({
                  userId,
                })
              ),
          },
        },
        include:
          serviceRequestInclude,
      })

    await prisma.serviceActivity.create({
      data: {
        serviceRequestId:
          created.id,
        userId:
          user.id,
        type:
          "STATUS",
        title:
          "A/S 접수",
        content:
          requestContent,
      },
    })

    await ensureServiceChecklist(
      created.id
    )

    if (
      requestType === "원격A/S" ||
      requestType === "상담"
    ) {
      await createAsIntakeNotifications(created)
    }

    res.status(201).json(created)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 건을 등록하지 못했습니다.",
    })
  }
})

app.put("/api/service-requests/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const siteId =
      Number(req.body.siteId)

    const receivedDate =
      parseOptionalDate(
        req.body.receivedDate
      )

    const visitDate =
      req.body.visitDate
        ? parseOptionalDate(
            req.body.visitDate
          )
        : null

    const requestContent =
      String(
        req.body.requestContent || ""
      ).trim()

    const requestType =
      String(
        req.body.requestType ||
        "방문A/S"
      ).trim() || "방문A/S"

    const intakeChannel =
      String(
        req.body.intakeChannel ||
        "직접등록"
      ).trim() || "직접등록"

    const customerName =
      String(
        req.body.customerName || ""
      ).trim() || null

    const priority =
      String(
        req.body.priority ||
        "일반"
      ).trim() || "일반"

    const resolution =
      String(
        req.body.resolution || ""
      ).trim() || null

    const contact =
      String(
        req.body.contact || ""
      ).trim() || null

    const billingType =
      String(
        req.body.billingType ||
        "무상"
      ).trim() || "무상"

    const billingAmount =
      billingType !== "무상"
        ? Math.max(
            0,
            Math.floor(
              Number(
                req.body.billingAmount
              ) || 0
            )
          )
        : 0

    const status =
      String(
        req.body.status ||
        "접수"
      ).trim() || "접수"

    const memo =
      String(
        req.body.memo || ""
      ).trim() || null

    const assigneeIds =
      normalizePositiveIdList(
        req.body.assigneeIds
      )

    if (
      !Number.isInteger(siteId) ||
      siteId <= 0 ||
      !receivedDate ||
      !requestContent
    ) {
      return res.status(400).json({
        error: "현장, 접수일, 요청/증상 내용은 필수입니다.",
      })
    }

    if (
      req.body.visitDate &&
      !visitDate
    ) {
      return res.status(400).json({
        error: "방문일을 확인해주세요.",
      })
    }

    const existing =
      await prisma.serviceRequest.findUnique({
        where: {
          id,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "A/S 건을 찾을 수 없습니다.",
      })
    }

    const updated =
      await prisma.serviceRequest.update({
        where: {
          id,
        },
        data: {
          siteId,
          receivedDate,
          visitDate,
          requestContent,
          requestType,
          intakeChannel,
          customerName,
          priority,
          resolution,
          contact,
          billingType,
          billingAmount,
          status,
          memo,
          completedAt:
            status === "완료"
              ? existing.completedAt || new Date()
              : null,
          assignees: {
            deleteMany: {},
            create:
              assigneeIds.map(
                (userId) => ({
                  userId,
                })
              ),
          },
        },
        include:
          serviceRequestInclude,
      })

    if (
      existing.status !==
      updated.status
    ) {
      await prisma.serviceActivity.create({
        data: {
          serviceRequestId:
            updated.id,
          userId:
            getCurrentUser(req)?.id ||
            null,
          type:
            "STATUS",
          title:
            `상태 변경: ${existing.status} → ${updated.status}`,
          content:
            updated.resolution ||
            null,
        },
      })
    }

    res.json(updated)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 건을 수정하지 못했습니다.",
    })
  }
})

app.delete("/api/service-requests/:id", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error: "A/S 삭제는 MASTER 또는 ADMIN만 할 수 있습니다.",
      })
    }

    const id =
      Number(req.params.id)

    await prisma.serviceRequest.delete({
      where: {
        id,
      },
    })

    res.json({
      success: true,
    })
  } catch (error: any) {
    console.error(error)

    if (
      String(
        error?.code || ""
      ) === "P2025"
    ) {
      return res.status(404).json({
        error: "A/S 건을 찾을 수 없습니다.",
      })
    }

    res.status(500).json({
      error: "A/S 건을 삭제하지 못했습니다.",
    })
  }
})

// ======================================================
// FSM BETA: A/S 상세 / 장비 / 체크리스트 / 배차 / 알림 / KPI / QR
// ======================================================

// A/S 첨부파일 연결
app.post("/api/service-requests/:id/files", async (req, res) => {
  try {
    const serviceRequestId =
      Number(req.params.id)

    const fileId =
      Number(req.body.fileId)

    const kind =
      String(
        req.body.kind || "파일"
      ).trim() || "파일"

    const linked =
      await prisma.serviceFile.create({
        data: {
          serviceRequestId,
          fileId,
          kind,
        },
        include: {
          file: true,
        },
      })

    const user =
      getCurrentUser(req)

    await prisma.serviceActivity.create({
      data: {
        serviceRequestId,
        userId:
          user?.id || null,
        type:
          "FILE",
        title:
          `${kind} 첨부`,
        content:
          linked.file.originalName,
      },
    })

    res.status(201).json(linked)
  } catch (error: any) {
    console.error(error)

    if (
      String(error?.code || "") ===
      "P2002"
    ) {
      return res.status(409).json({
        error: "이미 연결된 파일입니다.",
      })
    }

    res.status(500).json({
      error: "A/S 파일을 연결하지 못했습니다.",
    })
  }
})

app.delete("/api/service-files/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    await prisma.serviceFile.delete({
      where: {
        id,
      },
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 파일 연결을 해제하지 못했습니다.",
    })
  }
})

// A/S 메모/활동 기록
app.post("/api/service-requests/:id/activities", async (req, res) => {
  try {
    const serviceRequestId =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const title =
      String(
        req.body.title || "업무 메모"
      ).trim() || "업무 메모"

    const content =
      String(
        req.body.content || ""
      ).trim()

    if (!content) {
      return res.status(400).json({
        error: "메모 내용을 입력해주세요.",
      })
    }

    const activity =
      await prisma.serviceActivity.create({
        data: {
          serviceRequestId,
          userId:
            user.id,
          type:
            "NOTE",
          title,
          content,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

    res.status(201).json(activity)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 메모를 저장하지 못했습니다.",
    })
  }
})

// A/S 체크리스트
app.get("/api/service-requests/:id/checklist", async (req, res) => {
  try {
    const serviceRequestId =
      Number(req.params.id)

    const exists =
      await prisma.serviceRequest.findUnique({
        where: {
          id:
            serviceRequestId,
        },
        select: {
          id: true,
        },
      })

    if (!exists) {
      return res.status(404).json({
        error: "A/S 건을 찾을 수 없습니다.",
      })
    }

    await ensureServiceChecklist(
      serviceRequestId
    )

    const items =
      await prisma.serviceChecklistItem.findMany({
        where: {
          serviceRequestId,
        },
        include: {
          checkedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      })

    res.json(items)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "A/S 체크리스트를 불러오지 못했습니다.",
    })
  }
})

app.put("/api/service-checklist/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const checked =
      Boolean(
        req.body.checked
      )

    const note =
      String(
        req.body.note || ""
      ).trim() || null

    const item =
      await prisma.serviceChecklistItem.update({
        where: {
          id,
        },
        data: {
          checked,
          note,
          checkedById:
            checked
              ? user.id
              : null,
          checkedAt:
            checked
              ? new Date()
              : null,
        },
        include: {
          checkedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

    res.json(item)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "체크리스트를 수정하지 못했습니다.",
    })
  }
})

// 설치 체크리스트
app.get("/api/sites/:id/install-checklist", async (req, res) => {
  try {
    const siteId =
      Number(req.params.id)

    const exists =
      await prisma.site.findUnique({
        where: {
          id:
            siteId,
        },
        select: {
          id: true,
        },
      })

    if (!exists) {
      return res.status(404).json({
        error: "현장을 찾을 수 없습니다.",
      })
    }

    await ensureSiteInstallChecklist(
      siteId
    )

    const items =
      await prisma.siteChecklistItem.findMany({
        where: {
          siteId,
        },
        include: {
          checkedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      })

    res.json(items)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "설치 체크리스트를 불러오지 못했습니다.",
    })
  }
})

app.put("/api/site-checklist/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const checked =
      Boolean(
        req.body.checked
      )

    const note =
      String(
        req.body.note || ""
      ).trim() || null

    const item =
      await prisma.siteChecklistItem.update({
        where: {
          id,
        },
        data: {
          checked,
          note,
          checkedById:
            checked
              ? user.id
              : null,
          checkedAt:
            checked
              ? new Date()
              : null,
        },
        include: {
          checkedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

    res.json(item)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "설치 체크리스트를 수정하지 못했습니다.",
    })
  }
})

// 체크리스트 템플릿
app.get("/api/checklist-templates", async (req, res) => {
  try {
    const workType =
      String(
        req.query.workType || ""
      ).trim()

    const templates =
      await prisma.checklistTemplate.findMany({
        where: {
          ...(workType && {
            workType,
          }),
          isActive: true,
        },
        include: {
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          id: "desc",
        },
      })

    res.json(templates)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "체크리스트 템플릿을 불러오지 못했습니다.",
    })
  }
})

app.post("/api/checklist-templates", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error: "MASTER 또는 ADMIN만 템플릿을 만들 수 있습니다.",
      })
    }

    const name =
      String(
        req.body.name || ""
      ).trim()

    const workType =
      req.body.workType ===
      "INSTALL"
        ? "INSTALL"
        : "SERVICE"

    const items =
      Array.isArray(
        req.body.items
      )
        ? req.body.items
            .map(
              (value: any) =>
                String(value || "").trim()
            )
            .filter(Boolean)
        : []

    if (
      !name ||
      !items.length
    ) {
      return res.status(400).json({
        error: "템플릿 이름과 체크 항목을 입력해주세요.",
      })
    }

    const template =
      await prisma.checklistTemplate.create({
        data: {
          name,
          workType,
          createdById:
            user.id,
          items: {
            create:
              items.map(
                (label: string, index: number) => ({
                  label,
                  sortOrder:
                    (index + 1) * 10,
                  required:
                    true,
                })
              ),
          },
        },
        include: {
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      })

    res.status(201).json(template)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "체크리스트 템플릿을 만들지 못했습니다.",
    })
  }
})

app.delete("/api/checklist-templates/:id", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error: "MASTER 또는 ADMIN만 템플릿을 삭제할 수 있습니다.",
      })
    }

    const id =
      Number(req.params.id)

    await prisma.checklistTemplate.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "체크리스트 템플릿을 삭제하지 못했습니다.",
    })
  }
})

// 현장 장비대장
app.get("/api/assets", async (req, res) => {
  try {
    const siteId =
      Number(
        req.query.siteId || 0
      )

    const q =
      String(
        req.query.q || ""
      ).trim()

    const assets =
      await prisma.siteAsset.findMany({
        where: {
          ...(siteId > 0 && {
            siteId,
          }),
          ...(q && {
            OR: [
              {
                assetCode: {
                  contains: q,
                },
              },
              {
                assetType: {
                  contains: q,
                },
              },
              {
                model: {
                  contains: q,
                },
              },
              {
                serialNumber: {
                  contains: q,
                },
              },
              {
                site: {
                  is: {
                    name: {
                      contains: q,
                    },
                  },
                },
              },
            ],
          }),
        },
        include: {
          site: {
            select: {
              id: true,
              name: true,
              region: true,
              address: true,
            },
          },
        },
        orderBy: {
          id: "desc",
        },
      })

    res.json(assets)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "장비대장을 불러오지 못했습니다.",
    })
  }
})

app.post("/api/assets", async (req, res) => {
  try {
    const siteId =
      Number(req.body.siteId)

    const assetType =
      String(
        req.body.assetType || ""
      ).trim()

    const model =
      String(
        req.body.model || ""
      ).trim() || null

    const serialNumber =
      String(
        req.body.serialNumber || ""
      ).trim() || null

    if (
      !Number.isInteger(siteId) ||
      siteId <= 0 ||
      !assetType
    ) {
      return res.status(400).json({
        error: "현장과 장비 종류는 필수입니다.",
      })
    }

    const assetCode =
      `ASSET-${siteId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`

    const asset =
      await prisma.siteAsset.create({
        data: {
          siteId,
          assetCode,
          assetType,
          model,
          serialNumber,
          quantity:
            Math.max(
              1,
              Math.floor(
                Number(
                  req.body.quantity
                ) || 1
              )
            ),
          installedAt:
            req.body.installedAt
              ? new Date(
                  req.body.installedAt
                )
              : null,
          status:
            String(
              req.body.status ||
              "사용중"
            ).trim() || "사용중",
          location:
            String(
              req.body.location || ""
            ).trim() || null,
          memo:
            String(
              req.body.memo || ""
            ).trim() || null,
        },
        include: {
          site: true,
        },
      })

    res.status(201).json(asset)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "장비를 등록하지 못했습니다.",
    })
  }
})

app.put("/api/assets/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const asset =
      await prisma.siteAsset.update({
        where: {
          id,
        },
        data: {
          ...(req.body.assetType !== undefined && {
            assetType:
              String(
                req.body.assetType || ""
              ).trim(),
          }),
          ...(req.body.model !== undefined && {
            model:
              String(
                req.body.model || ""
              ).trim() || null,
          }),
          ...(req.body.serialNumber !== undefined && {
            serialNumber:
              String(
                req.body.serialNumber || ""
              ).trim() || null,
          }),
          ...(req.body.quantity !== undefined && {
            quantity:
              Math.max(
                1,
                Math.floor(
                  Number(
                    req.body.quantity
                  ) || 1
                )
              ),
          }),
          ...(req.body.installedAt !== undefined && {
            installedAt:
              req.body.installedAt
                ? new Date(
                    req.body.installedAt
                  )
                : null,
          }),
          ...(req.body.status !== undefined && {
            status:
              String(
                req.body.status || ""
              ).trim(),
          }),
          ...(req.body.location !== undefined && {
            location:
              String(
                req.body.location || ""
              ).trim() || null,
          }),
          ...(req.body.memo !== undefined && {
            memo:
              String(
                req.body.memo || ""
              ).trim() || null,
          }),
        },
        include: {
          site: true,
        },
      })

    res.json(asset)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "장비 정보를 수정하지 못했습니다.",
    })
  }
})

app.delete("/api/assets/:id", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error: "MASTER 또는 ADMIN만 장비를 삭제할 수 있습니다.",
      })
    }

    const id =
      Number(req.params.id)

    await prisma.siteAsset.delete({
      where: {
        id,
      },
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "장비를 삭제하지 못했습니다.",
    })
  }
})

// QR 이미지 - 출력/라벨 테스트용
app.get("/api/assets/:id/qr.svg", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const asset =
      await prisma.siteAsset.findUnique({
        where: {
          id,
        },
      })

    if (!asset) {
      return res.status(404).send("Not found")
    }

    const svg =
      await QRCode.toString(
        `CSW-ASSET:${asset.assetCode}`,
        {
          type: "svg",
          margin: 1,
          width: 240,
        }
      )

    res.type("image/svg+xml").send(svg)
  } catch (error) {
    console.error(error)
    res.status(500).send("QR error")
  }
})

app.get("/api/sites/:id/qr.svg", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const site =
      await prisma.site.findUnique({
        where: {
          id,
        },
      })

    if (!site) {
      return res.status(404).send("Not found")
    }

    const svg =
      await QRCode.toString(
        `CSW-SITE:${site.id}`,
        {
          type: "svg",
          margin: 1,
          width: 240,
        }
      )

    res.type("image/svg+xml").send(svg)
  } catch (error) {
    console.error(error)
    res.status(500).send("QR error")
  }
})

app.get("/api/lookup-code", async (req, res) => {
  try {
    const code =
      String(
        req.query.code || ""
      ).trim()

    if (!code) {
      return res.status(400).json({
        error: "QR/장비 코드를 입력해주세요.",
      })
    }

    if (
      code.startsWith(
        "CSW-ASSET:"
      )
    ) {
      const assetCode =
        code.slice(
          "CSW-ASSET:".length
        )

      const asset =
        await prisma.siteAsset.findUnique({
          where: {
            assetCode,
          },
          include: {
            site: true,
          },
        })

      if (!asset) {
        return res.status(404).json({
          error: "장비를 찾을 수 없습니다.",
        })
      }

      return res.json({
        type: "ASSET",
        asset,
      })
    }

    if (
      code.startsWith(
        "CSW-SITE:"
      )
    ) {
      const siteId =
        Number(
          code.slice(
            "CSW-SITE:".length
          )
        )

      const site =
        await prisma.site.findUnique({
          where: {
            id: siteId,
          },
          include: {
            assets: {
              orderBy: {
                id: "desc",
              },
            },
            serviceRequests: {
              orderBy: {
                id: "desc",
              },
              take: 10,
            },
          },
        })

      if (!site) {
        return res.status(404).json({
          error: "현장을 찾을 수 없습니다.",
        })
      }

      return res.json({
        type: "SITE",
        site,
      })
    }

    // 장비 코드만 직접 입력한 경우도 허용
    const asset =
      await prisma.siteAsset.findUnique({
        where: {
          assetCode:
            code,
        },
        include: {
          site: true,
        },
      })

    if (asset) {
      return res.json({
        type: "ASSET",
        asset,
      })
    }

    return res.status(404).json({
      error: "해당 코드를 찾을 수 없습니다.",
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "코드를 조회하지 못했습니다.",
    })
  }
})

// A/S 완료 + 업무일지 + 재고 자동차감
app.post("/api/service-requests/:id/complete", async (req, res) => {
  try {
    const serviceRequestId =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const service =
      await prisma.serviceRequest.findUnique({
        where: {
          id:
            serviceRequestId,
        },
        include: {
          site: true,
        },
      })

    if (!service) {
      return res.status(404).json({
        error: "A/S 건을 찾을 수 없습니다.",
      })
    }

    if (service.workLogId) {
      return res.status(409).json({
        error: "이미 완료 처리되어 업무일지와 재고에 반영된 A/S입니다.",
      })
    }

    const resolution =
      String(
        req.body.resolution ||
        service.resolution ||
        ""
      ).trim()

    if (!resolution) {
      return res.status(400).json({
        error: "처리 내용을 입력해주세요.",
      })
    }

    const materials =
      normalizeMaterialList(
        req.body.materials
      )

    const billingType =
      String(
        req.body.billingType ||
        service.billingType ||
        "무상"
      ).trim() || "무상"

    const billingAmount =
      billingType === "무상"
        ? 0
        : Math.max(
            0,
            Math.floor(
              Number(
                req.body.billingAmount ??
                service.billingAmount ??
                0
              ) || 0
            )
          )

    const workDate =
      service.visitDate ||
      new Date()

    const result =
      await prisma.$transaction(async (tx) => {
        for (const material of materials) {
          const item =
            await tx.inventoryItem.findUnique({
              where: {
                id:
                  material.itemId,
              },
            })

          if (
            !item ||
            !item.isActive
          ) {
            throw new Error(
              "ITEM_NOT_FOUND"
            )
          }

          if (
            item.currentStock <
            material.quantity
          ) {
            throw new Error(
              `INSUFFICIENT_STOCK:${item.name}:${item.currentStock}:${material.quantity}`
            )
          }
        }

        const workLog =
          await tx.workLog.create({
            data: {
              authorId:
                user.id,
              workDate,
              title:
                `[A/S] ${service.site.name}`,
              completedWork:
                resolution,
              memo:
                `A/S #${service.id} 자동 생성 업무일지`,
              status:
                "SUBMITTED",
              sites: {
                create: [
                  {
                    siteId:
                      service.siteId,
                  },
                ],
              },
              materials: {
                create:
                  materials.map(
                    (material) => ({
                      itemId:
                        material.itemId,
                      quantity:
                        material.quantity,
                      usageType:
                        material.usageType,
                      deducted:
                        true,
                    })
                  ),
              },
            },
          })

        for (const material of materials) {
          const updatedItem =
            await tx.inventoryItem.update({
              where: {
                id:
                  material.itemId,
              },
              data: {
                currentStock: {
                  decrement:
                    material.quantity,
                },
              },
            })

          await tx.inventoryTransaction.create({
            data: {
              itemId:
                material.itemId,
              userId:
                user.id,
              siteId:
                service.siteId,
              workLogId:
                workLog.id,
              type:
                "SERVICE_OUT",
              quantity:
                -material.quantity,
              balanceAfter:
                updatedItem.currentStock,
              reason:
                `A/S #${service.id} ${service.site.name}`,
              usageType:
                material.usageType,
            },
          })
        }

        const updatedService =
          await tx.serviceRequest.update({
            where: {
              id:
                serviceRequestId,
            },
            data: {
              resolution,
              billingType,
              billingAmount,
              status:
                "완료",
              completedAt:
                new Date(),
              workLogId:
                workLog.id,
            },
          })

        await tx.serviceActivity.create({
          data: {
            serviceRequestId,
            userId:
              user.id,
            type:
              "COMPLETE",
            title:
              "A/S 완료 처리",
            content:
              `${resolution}${materials.length ? ` / 사용 자재 ${materials.length}종` : ""}`,
          },
        })

        return {
          service:
            updatedService,
          workLog,
        }
      })

    res.json(result)
  } catch (error: any) {
    console.error(error)

    if (
      String(
        error?.message || ""
      ).startsWith(
        "INSUFFICIENT_STOCK:"
      )
    ) {
      const [
        ,
        name,
        stock,
        requested,
      ] =
        String(
          error.message
        ).split(":")

      return res.status(400).json({
        error:
          `${name} 재고가 부족합니다. 현재 ${stock} / 사용 ${requested}`,
      })
    }

    if (
      error?.message ===
      "ITEM_NOT_FOUND"
    ) {
      return res.status(400).json({
        error: "선택한 사용 자재를 찾을 수 없습니다.",
      })
    }

    res.status(500).json({
      error: "A/S 완료 처리를 하지 못했습니다.",
    })
  }
})

// 팀 배차판
app.get("/api/dispatch", async (req, res) => {
  try {
    const requestedDate =
      String(
        req.query.date ||
        dateKey(new Date()) ||
        ""
      )

    const {
      start,
      end,
    } =
      dayRange(
        requestedDate
      )

    const [
      members,
      services,
      sites,
      leaves,
    ] =
      await Promise.all([
        prisma.user.findMany({
          where: {
            isActive: true,
            role: {
              in: [
                "USER",
                "ADMIN",
              ],
            },
          },
          select: {
            id: true,
            name: true,
            department: true,
            position: true,
          },
          orderBy: {
            name: "asc",
          },
        }),

        prisma.serviceRequest.findMany({
          where: {
            visitDate: {
              gte: start,
              lt: end,
            },
          },
          include: {
            site: true,
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            id: "asc",
          },
        }),

        prisma.site.findMany({
          where: {
            installDate: {
              not: null,
            },
          },
          orderBy: {
            installDate: "asc",
          },
        }),

        prisma.leaveRequest.findMany({
          where: {
            status: "APPROVED",
            startDate: {
              lt: end,
            },
            endDate: {
              gte: start,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ])

    const target =
      new Date(
        `${requestedDate}T12:00:00`
      )

    const installations =
      sites
        .filter(
          (site) =>
            installOverlapsDate(
              site,
              target
            )
        )
        .map((site) => {
          const extra =
            site.extraData &&
            typeof site.extraData ===
              "object"
              ? site.extraData as Record<string, any>
              : {}

          const assigneeIds =
            Array.isArray(
              extra.installAssigneeIds
            )
              ? extra.installAssigneeIds
                  .map(Number)
                  .filter(Boolean)
              : []

          return {
            id:
              site.id,
            title:
              site.name,
            status:
              site.status,
            region:
              site.region,
            assigneeIds,
            installDays:
              installDaysFromSite(
                site
              ),
          }
        })

    const memberRows =
      members.map((member) => ({
        ...member,
        leave:
          leaves.find(
            (leave) =>
              leave.userId ===
              member.id
          ) || null,
        services:
          services.filter(
            (service) =>
              service.assignees.some(
                (assignment) =>
                  assignment.userId ===
                  member.id
              )
          ),
        installations:
          installations.filter(
            (installation) =>
              installation.assigneeIds.includes(
                member.id
              )
          ),
      }))

    res.json({
      date:
        requestedDate,
      members:
        memberRows,
      unassigned: {
        services:
          services.filter(
            (service) =>
              !service.assignees.length
          ),
        installations:
          installations.filter(
            (installation) =>
              !installation.assigneeIds.length
          ),
      },
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "팀 배차 정보를 불러오지 못했습니다.",
    })
  }
})

// 알림센터 - 현재 데이터에서 즉시 계산
app.get("/api/alerts", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    const now =
      new Date()

    const todayStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      )

    const threeDays =
      new Date(todayStart)

    threeDays.setDate(
      threeDays.getDate() + 4
    )

    const [
      services,
      lowStock,
      sites,
      leaveAgreements,
      storedNotifications,
    ] =
      await Promise.all([
        prisma.serviceRequest.findMany({
          where: {
            status: {
              not: "완료",
            },
          },
          include: {
            site: true,
            assignees: true,
          },
          orderBy: {
            visitDate: "asc",
          },
          take: 100,
        }),

        prisma.inventoryItem.findMany({
          where: {
            isActive: true,
          },
          orderBy: {
            currentStock: "asc",
          },
        }),

        prisma.site.findMany({
          where: {
            installDate: {
              gte: todayStart,
              lt: threeDays,
            },
            status: {
              not: "설치 완료",
            },
          },
          orderBy: {
            installDate: "asc",
          },
          take: 50,
        }),

        prisma.leaveAgreement.findMany({
          where: {
            approverId:
              user.id,
            status:
              "PENDING",
          },
          include: {
            leaveRequest: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),

        prisma.notification.findMany({
          where: {
            userId:
              user.id,
          },
          orderBy: {
            createdAt:
              "desc",
          },
          take: 100,
        }),
      ])

    const alerts: any[] = []

    for (
      const notification of
      storedNotifications
    ) {
      alerts.push({
        id:
          `notification-${notification.id}`,
        notificationId:
          notification.id,
        level:
          notification.level,
        type:
          notification.targetType ||
          notification.type,
        title:
          notification.title,
        message:
          notification.message,
        targetId:
          notification.targetId,
        source:
          notification.source,
        createdAt:
          notification.createdAt,
        isRead:
          Boolean(
            notification.readAt
          ),
      })
    }

    const isAsOnlyWorkspaceUser =
      user.department ===
        "AS팀" &&
      user.role !==
        "MASTER"

    if (!isAsOnlyWorkspaceUser) {
      for (const service of services) {
        if (!service.visitDate) continue

      const visit =
        new Date(
          service.visitDate
        )

      const isAssigned =
        service.assignees.some(
          (assignment) =>
            assignment.userId ===
            user.id
        )

      if (
        visit < todayStart
      ) {
        alerts.push({
          id:
            `service-overdue-${service.id}`,
          level:
            "danger",
          type:
            "SERVICE",
          title:
            "기한이 지난 A/S",
          message:
            `${service.site.name} · ${dateKey(visit)} · ${service.status}`,
          targetId:
            service.id,
        })
      } else if (
        visit < threeDays &&
        (
          isAssigned ||
          canManageUsers(user)
        )
      ) {
        alerts.push({
          id:
            `service-upcoming-${service.id}`,
          level:
            "info",
          type:
            "SERVICE",
          title:
            "다가오는 A/S 방문",
          message:
            `${service.site.name} · ${dateKey(visit)}`,
          targetId:
            service.id,
        })
      }
    }

    for (const item of lowStock) {
      if (
        item.currentStock <=
        item.minStock
      ) {
        alerts.push({
          id:
            `stock-${item.id}`,
          level:
            item.currentStock === 0
              ? "danger"
              : "warning",
          type:
            "INVENTORY",
          title:
            "재고 부족",
          message:
            `${item.name} · 현재 ${item.currentStock}${item.unit} / 최소 ${item.minStock}${item.unit}`,
          targetId:
            item.id,
        })
      }
    }

    for (const site of sites) {
      alerts.push({
        id:
          `install-${site.id}`,
        level:
          "info",
        type:
          "INSTALL",
        title:
          "다가오는 설치",
        message:
          `${site.name} · ${dateKey(site.installDate)}`,
        targetId:
          site.id,
      })
    }

    }

    for (const agreement of leaveAgreements) {
      alerts.push({
        id:
          `leave-${agreement.id}`,
        level:
          "warning",
        type:
          "LEAVE",
        title:
          "연차 동의 대기",
        message:
          `${agreement.leaveRequest.user.name} · ${dateKey(agreement.leaveRequest.startDate)}`,
        targetId:
          agreement.leaveRequestId,
      })
    }

    res.json({
      generatedAt:
        new Date().toISOString(),
      unreadCount:
        storedNotifications.filter(
          (notification) =>
            !notification.readAt
        ).length,
      alerts,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "알림을 불러오지 못했습니다.",
    })
  }
})

app.post("/api/alerts/:id/read", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    const id =
      Number(req.params.id)

    const notification =
      await prisma.notification.findFirst({
        where: {
          id,
          userId:
            user.id,
        },
      })

    if (!notification) {
      return res.status(404).json({
        error: "알림을 찾을 수 없습니다.",
      })
    }

    const updated =
      await prisma.notification.update({
        where: {
          id,
        },
        data: {
          readAt:
            notification.readAt ||
            new Date(),
        },
      })

    res.json(updated)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "알림 읽음 처리를 하지 못했습니다.",
    })
  }
})

app.post("/api/alerts/read-all", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    await prisma.notification.updateMany({
      where: {
        userId:
          user.id,
        readAt:
          null,
      },
      data: {
        readAt:
          new Date(),
      },
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "알림 전체 읽음 처리를 하지 못했습니다.",
    })
  }
})

// KPI / 통계
app.get("/api/kpi", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error: "MASTER 또는 ADMIN만 통계를 볼 수 있습니다.",
      })
    }

    const now =
      new Date()

    const defaultFrom =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )

    const from =
      req.query.from
        ? new Date(
            `${String(req.query.from)}T00:00:00`
          )
        : defaultFrom

    const to =
      req.query.to
        ? new Date(
            `${String(req.query.to)}T23:59:59`
          )
        : now

    const [
      services,
      workLogs,
      inventoryItems,
      inventoryTransactions,
      installations,
    ] =
      await Promise.all([
        prisma.serviceRequest.findMany({
          where: {
            receivedDate: {
              gte: from,
              lte: to,
            },
          },
          include: {
            site: true,
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),

        prisma.workLog.findMany({
          where: {
            workDate: {
              gte: from,
              lte: to,
            },
            status:
              "SUBMITTED",
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),

        prisma.inventoryItem.findMany({
          where: {
            isActive:
              true,
          },
        }),

        prisma.inventoryTransaction.findMany({
          where: {
            createdAt: {
              gte: from,
              lte: to,
            },
            quantity: {
              lt: 0,
            },
          },
          include: {
            item: true,
          },
        }),

        prisma.site.findMany({
          where: {
            installDate: {
              gte: from,
              lte: to,
            },
          },
        }),
      ])

    const completed =
      services.filter(
        (service) =>
          service.status ===
          "완료"
      )

    const billingAmount =
      services.reduce(
        (sum, service) =>
          sum +
          (
            service.billingType ===
            "무상"
              ? 0
              : Number(
                  service.billingAmount ||
                  0
                )
          ),
        0
      )

    const completionHours =
      completed
        .map((service) => {
          const end =
            service.completedAt ||
            service.updatedAt

          return (
            new Date(end).getTime() -
            new Date(
              service.receivedDate
            ).getTime()
          ) /
            1000 /
            60 /
            60
        })
        .filter(
          (hours) =>
            Number.isFinite(hours) &&
            hours >= 0
        )

    const avgCompletionHours =
      completionHours.length
        ? completionHours.reduce(
            (a, b) => a + b,
            0
          ) /
          completionHours.length
        : 0

    const siteCounter =
      new Map<string, number>()

    for (const service of services) {
      siteCounter.set(
        service.site.name,
        (
          siteCounter.get(
            service.site.name
          ) || 0
        ) + 1
      )
    }

    const topServiceSites =
      Array.from(
        siteCounter.entries()
      )
        .map(
          ([name, count]) => ({
            name,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count -
            a.count
        )
        .slice(0, 10)

    const materialCounter =
      new Map<
        number,
        {
          id: number
          name: string
          quantity: number
          unit: string
        }
      >()

    for (
      const transaction of
      inventoryTransactions
    ) {
      const current =
        materialCounter.get(
          transaction.itemId
        ) || {
          id:
            transaction.itemId,
          name:
            transaction.item.name,
          quantity:
            0,
          unit:
            transaction.item.unit,
        }

      current.quantity +=
        Math.abs(
          transaction.quantity
        )

      materialCounter.set(
        transaction.itemId,
        current
      )
    }

    const topMaterials =
      Array.from(
        materialCounter.values()
      )
        .sort(
          (a, b) =>
            b.quantity -
            a.quantity
        )
        .slice(0, 10)

    const userMap =
      new Map<
        number,
        {
          id: number
          name: string
          serviceCount: number
          completedServiceCount: number
          workLogCount: number
        }
      >()

    for (const service of services) {
      for (
        const assignment of
        service.assignees
      ) {
        const member =
          assignment.user

        const row =
          userMap.get(
            member.id
          ) || {
            id:
              member.id,
            name:
              member.name,
            serviceCount:
              0,
            completedServiceCount:
              0,
            workLogCount:
              0,
          }

        row.serviceCount += 1

        if (
          service.status ===
          "완료"
        ) {
          row.completedServiceCount +=
            1
        }

        userMap.set(
          member.id,
          row
        )
      }
    }

    for (const log of workLogs) {
      const row =
        userMap.get(
          log.author.id
        ) || {
          id:
            log.author.id,
          name:
            log.author.name,
          serviceCount:
            0,
          completedServiceCount:
            0,
          workLogCount:
            0,
        }

      row.workLogCount += 1

      userMap.set(
        log.author.id,
        row
      )
    }

    res.json({
      from:
        dateKey(from),
      to:
        dateKey(to),
      summary: {
        serviceCount:
          services.length,
        completedServiceCount:
          completed.length,
        openServiceCount:
          services.length -
          completed.length,
        completionRate:
          services.length
            ? Math.round(
                (
                  completed.length /
                  services.length
                ) *
                  1000
              ) /
              10
            : 0,
        avgCompletionHours:
          Math.round(
            avgCompletionHours *
              10
          ) / 10,
        billingAmount,
        installationCount:
          installations.length,
        workLogCount:
          workLogs.length,
        lowStockCount:
          inventoryItems.filter(
            (item) =>
              item.currentStock <=
              item.minStock
          ).length,
      },
      topServiceSites,
      topMaterials,
      users:
        Array.from(
          userMap.values()
        ).sort(
          (a, b) =>
            b.completedServiceCount -
              a.completedServiceCount ||
            b.workLogCount -
              a.workLogCount
        ),
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "통계를 불러오지 못했습니다.",
    })
  }
})

// ======================================================
// 재고 관리
// ======================================================

function normalizeMaterialList(value: any) {
  if (!Array.isArray(value)) return []

  const byItem = new Map<number, any>()

  for (const row of value) {
    const itemId = Number(row?.itemId)
    const quantity = Number(row?.quantity)

    if (
      !Number.isInteger(itemId) ||
      itemId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      continue
    }

    byItem.set(itemId, {
      itemId,
      quantity,
      usageType:
        String(row?.usageType || "AS교체").trim() ||
        "AS교체",
    })
  }

  return Array.from(byItem.values())
}

app.get("/api/inventory/items", async (_req, res) => {
  try {
    const items =
      await prisma.inventoryItem.findMany({
        where: {
          isActive: true,
        },
        orderBy: [
          {
            category: "asc",
          },
          {
            name: "asc",
          },
        ],
      })

    res.json(items)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "재고 품목을 불러오지 못했습니다.",
    })
  }
})

app.get("/api/inventory/transactions", async (req, res) => {
  try {
    const itemId =
      req.query.itemId
        ? Number(req.query.itemId)
        : undefined

    const transactions =
      await prisma.inventoryTransaction.findMany({
        where:
          itemId && Number.isInteger(itemId)
            ? {
                itemId,
              }
            : undefined,
        include: {
          item: true,
          user: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
            },
          },
          workLog: {
            select: {
              id: true,
              title: true,
              workDate: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 300,
      })

    res.json(transactions)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "재고 이력을 불러오지 못했습니다.",
    })
  }
})

app.post("/api/inventory/items", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error: "재고 품목 등록은 MASTER 또는 ADMIN만 할 수 있습니다.",
      })
    }

    const name =
      String(req.body.name || "").trim()

    const category =
      String(req.body.category || "기타").trim() ||
      "기타"

    const unit =
      String(req.body.unit || "개").trim() ||
      "개"

    const code =
      String(req.body.code || "").trim() ||
      null

    const location =
      String(req.body.location || "").trim() ||
      null

    const memo =
      String(req.body.memo || "").trim() ||
      null

    const initialStock =
      Math.max(
        0,
        Math.floor(Number(req.body.initialStock) || 0)
      )

    const minStock =
      Math.max(
        0,
        Math.floor(Number(req.body.minStock) || 0)
      )

    if (!name) {
      return res.status(400).json({
        error: "품목명을 입력해주세요.",
      })
    }

    const item =
      await prisma.$transaction(async (tx) => {
        const created =
          await tx.inventoryItem.create({
            data: {
              code,
              name,
              category,
              unit,
              currentStock:
                initialStock,
              minStock,
              location,
              memo,
            },
          })

        if (initialStock > 0) {
          await tx.inventoryTransaction.create({
            data: {
              itemId:
                created.id,
              userId:
                user.id,
              type:
                "INITIAL",
              quantity:
                initialStock,
              balanceAfter:
                initialStock,
              reason:
                "초기 재고 등록",
            },
          })
        }

        return created
      })

    res.status(201).json(item)
  } catch (error: any) {
    console.error(error)

    if (
      String(error?.message || "").includes("Unique constraint")
    ) {
      return res.status(400).json({
        error: "이미 사용 중인 품목 코드입니다.",
      })
    }

    res.status(500).json({
      error: "재고 품목을 등록하지 못했습니다.",
    })
  }
})

app.put("/api/inventory/items/:id", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error: "재고 품목 수정 권한이 없습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const item =
      await prisma.inventoryItem.update({
        where: {
          id,
        },
        data: {
          ...(req.body.name !== undefined && {
            name:
              String(req.body.name).trim(),
          }),
          ...(req.body.code !== undefined && {
            code:
              String(req.body.code).trim() || null,
          }),
          ...(req.body.category !== undefined && {
            category:
              String(req.body.category).trim() || "기타",
          }),
          ...(req.body.unit !== undefined && {
            unit:
              String(req.body.unit).trim() || "개",
          }),
          ...(req.body.minStock !== undefined && {
            minStock:
              Math.max(
                0,
                Math.floor(Number(req.body.minStock) || 0)
              ),
          }),
          ...(req.body.location !== undefined && {
            location:
              String(req.body.location).trim() || null,
          }),
          ...(req.body.memo !== undefined && {
            memo:
              String(req.body.memo).trim() || null,
          }),
          ...(req.body.isActive !== undefined && {
            isActive:
              Boolean(req.body.isActive),
          }),
        },
      })

    res.json(item)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "재고 품목을 수정하지 못했습니다.",
    })
  }
})

app.post("/api/inventory/items/:id/move", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error: "수동 입출고는 MASTER 또는 ADMIN만 할 수 있습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const type =
      String(req.body.type || "").toUpperCase()

    const rawQuantity =
      Math.floor(Number(req.body.quantity) || 0)

    const reason =
      String(req.body.reason || "").trim() ||
      "수동 재고 처리"

    if (
      !["IN", "OUT", "ADJUST_IN", "ADJUST_OUT"].includes(type) ||
      rawQuantity <= 0
    ) {
      return res.status(400).json({
        error: "입출고 유형과 수량을 확인해주세요.",
      })
    }

    const direction =
      ["IN", "ADJUST_IN"].includes(type)
        ? 1
        : -1

    const item =
      await prisma.$transaction(async (tx) => {
        const current =
          await tx.inventoryItem.findUnique({
            where: {
              id,
            },
          })

        if (!current) {
          throw new Error("ITEM_NOT_FOUND")
        }

        const nextStock =
          current.currentStock +
          direction * rawQuantity

        if (nextStock < 0) {
          throw new Error("INSUFFICIENT_STOCK")
        }

        const updated =
          await tx.inventoryItem.update({
            where: {
              id,
            },
            data: {
              currentStock:
                nextStock,
            },
          })

        await tx.inventoryTransaction.create({
          data: {
            itemId:
              id,
            userId:
              user.id,
            type,
            quantity:
              direction * rawQuantity,
            balanceAfter:
              nextStock,
            reason,
          },
        })

        return updated
      })

    res.json(item)
  } catch (error: any) {
    console.error(error)

    if (error?.message === "ITEM_NOT_FOUND") {
      return res.status(404).json({
        error: "재고 품목을 찾을 수 없습니다.",
      })
    }

    if (error?.message === "INSUFFICIENT_STOCK") {
      return res.status(400).json({
        error: "현재 재고보다 많은 수량을 출고할 수 없습니다.",
      })
    }

    res.status(500).json({
      error: "재고를 처리하지 못했습니다.",
    })
  }
})

// ======================================================
// 업무일지
// ======================================================

const workLogInclude = {
  author: {
    select: {
      id: true,
      name: true,
      username: true,
      department: true,
      position: true,
    },
  },
  sites: {
    include: {
      site: {
        select: {
          id: true,
          name: true,
          region: true,
          address: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
  comments: {
    include: {
      author: {
        select: {
          id: true,
          name: true,
          department: true,
          position: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  manualCandidates: {
    orderBy: {
      createdAt: "desc",
    },
  },
  materials: {
    include: {
      item: true,
    },
    orderBy: {
      id: "asc",
    },
  },
} as const

function normalizeIdList(value: any) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter(
          (item) =>
            Number.isInteger(item) &&
            item > 0
        )
    )
  )
}

function parseWorkDate(value: any) {
  if (!value) {
    return null
  }

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`
  )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date
}

function hasWorkLogContent(body: any) {
  return [
    ...(Array.isArray(body.workEntries) ? body.workEntries.flatMap((entry: any) => [entry?.workContent, entry?.followUp]) : []),
    body.title,
    body.completedWork,
    body.pendingWork,
    body.nextPlan,
    body.issues,
    body.handover,
    body.memo,
  ].some(
    (value) =>
      String(value || "").trim()
  )
}

app.get("/api/worklogs", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    const mine =
      String(req.query.mine || "") === "true"

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit) || 60,
          1
        ),
        200
      )

    const where: any = {}

    if (mine) {
      where.authorId =
        user.id
    }

    if (req.query.status) {
      where.status =
        String(req.query.status)
    }

    const workLogs =
      await prisma.workLog.findMany({
        where,
        include:
          workLogInclude,
        orderBy: [
          {
            workDate:
              "desc",
          },
          {
            createdAt:
              "desc",
          },
        ],
        take:
          limit,
      })

    res.json(workLogs)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "업무일지를 불러오지 못했습니다.",
    })
  }
})

// ======================================================
// 대시보드 주간 업무
// 월요일 ~ 일요일: 설치 / 방문 A/S / 승인 연차
// ======================================================

app.get("/api/dashboard/week-summary", async (req, res) => {
  try {
    const anchorText =
      String(
        req.query.date ||
        dateKey(new Date()) ||
        ""
      )

    const anchor =
      new Date(
        `${anchorText}T12:00:00`
      )

    if (
      Number.isNaN(
        anchor.getTime()
      )
    ) {
      return res.status(400).json({
        error: "기준 날짜를 확인해주세요.",
      })
    }

    const day =
      anchor.getDay()

    const mondayOffset =
      day === 0
        ? -6
        : 1 - day

    const weekStart =
      new Date(anchor)

    weekStart.setDate(
      weekStart.getDate() +
      mondayOffset
    )
    weekStart.setHours(
      0,
      0,
      0,
      0
    )

    const weekEndExclusive =
      new Date(
        weekStart
      )

    weekEndExclusive.setDate(
      weekEndExclusive.getDate() +
      7
    )

    const weekEnd =
      new Date(
        weekEndExclusive
      )

    weekEnd.setDate(
      weekEnd.getDate() -
      1
    )
    weekEnd.setHours(
      23,
      59,
      59,
      999
    )

    const installLookback =
      new Date(
        weekStart
      )

    installLookback.setDate(
      installLookback.getDate() -
      31
    )

    const [
      installationSites,
      serviceVisits,
      leaveRequests,
    ] =
      await Promise.all([
        prisma.site.findMany({
          where: {
            installDate: {
              gte:
                installLookback,
              lt:
                weekEndExclusive,
            },
          },
          orderBy: {
            installDate:
              "asc",
          },
        }),

        prisma.serviceRequest.findMany({
          where: {
            visitDate: {
              gte:
                weekStart,
              lt:
                weekEndExclusive,
            },
            requestType:
              "방문A/S",
          },
          include: {
            site: {
              select: {
                id: true,
                name: true,
                region: true,
                address: true,
              },
            },
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    position: true,
                  },
                },
              },
              orderBy: {
                id: "asc",
              },
            },
          },
          orderBy: {
            visitDate:
              "asc",
          },
        }),

        prisma.leaveRequest.findMany({
          where: {
            status:
              "APPROVED",
            startDate: {
              lt:
                weekEndExclusive,
            },
            endDate: {
              gte:
                weekStart,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                department: true,
                position: true,
              },
            },
          },
          orderBy: {
            startDate:
              "asc",
          },
        }),
      ])

    const installationEvents =
      installationSites
        .map((site) => {
          if (
            !site.installDate
          ) {
            return null
          }

          const start =
            new Date(
              site.installDate
            )

          const installDays =
            installDaysFromSite(
              site
            )

          const end =
            new Date(start)

          end.setDate(
            end.getDate() +
            installDays -
            1
          )

          if (
            end < weekStart ||
            start >=
              weekEndExclusive
          ) {
            return null
          }

          const extra =
            site.extraData &&
            typeof site.extraData ===
              "object"
              ? site.extraData as Record<string, any>
              : {}

          const assigneeIds =
            Array.isArray(
              extra.installAssigneeIds
            )
              ? extra.installAssigneeIds
                  .map(Number)
                  .filter(Boolean)
              : []

          return {
            id:
              `install-${site.id}`,
            type:
              "INSTALL",
            title:
              site.name,
            subtitle:
              `${site.status || "설치 예정"} · ${installDays}일`,
            status:
              site.status ||
              "설치 예정",
            siteId:
              site.id,
            startDate:
              dateKey(start),
            endDate:
              dateKey(end),
            region:
              site.region ||
              null,
            assigneeIds,
          }
        })
        .filter(Boolean) as any[]

    const serviceEvents =
      serviceVisits
        .map((service) => {
          const date =
            dateKey(
              service.visitDate
            )

          if (!date) {
            return null
          }

          return {
            id:
              `service-${service.id}`,
            type:
              "SERVICE",
            title:
              service.site?.name ||
              "A/S",
            subtitle:
              service.requestContent,
            status:
              service.status,
            priority:
              service.priority,
            serviceRequestId:
              service.id,
            siteId:
              service.siteId,
            startDate:
              date,
            endDate:
              date,
            assignees:
              service.assignees
                .map(
                  (row) =>
                    row.user?.name
                )
                .filter(Boolean),
          }
        })
        .filter(Boolean) as any[]

    const leaveEvents =
      leaveRequests
        .map((leave) => {
          const startDate =
            dateKey(
              leave.startDate
            )

          const endDate =
            dateKey(
              leave.endDate
            )

          if (
            !startDate ||
            !endDate
          ) {
            return null
          }

          return {
            id:
              `leave-${leave.id}`,
            type:
              "LEAVE",
            title:
              leave.user?.name ||
              "직원",
            subtitle:
              leave.leaveType ||
              "연차",
            status:
              leave.status,
            leaveRequestId:
              leave.id,
            userId:
              leave.userId,
            startDate,
            endDate,
          }
        })
        .filter(Boolean) as any[]

    const allEvents = [
      ...installationEvents,
      ...serviceEvents,
      ...leaveEvents,
    ]

    const days: any[] = []

    for (
      let index = 0;
      index < 7;
      index += 1
    ) {
      const date =
        new Date(
          weekStart
        )

      date.setDate(
        date.getDate() +
        index
      )

      const key =
        dateKey(date)

      if (!key) {
        continue
      }

      const events =
        allEvents.filter(
          (event) =>
            key >=
              event.startDate &&
            key <=
              event.endDate
        )

      days.push({
        date:
          key,
        events,
      })
    }

    res.json({
      anchorDate:
        anchorText,
      startDate:
        dateKey(
          weekStart
        ),
      endDate:
        dateKey(
          weekEnd
        ),
      summary: {
        installations:
          installationEvents.length,
        serviceVisits:
          serviceEvents.length,
        leaves:
          leaveEvents.length,
        urgentServices:
          serviceEvents.filter(
            (event) =>
              event.priority ===
              "긴급"
          ).length,
      },
      days,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "주간 업무를 불러오지 못했습니다.",
    })
  }
})

app.get("/api/worklogs/today-summary", async (req, res) => {
  try {
    const dateText =
      String(req.query.date || "").slice(0, 10)

    const targetDate =
      parseWorkDate(
        dateText ||
          new Date().toISOString().slice(0, 10)
      )

    if (!targetDate) {
      return res.status(400).json({
        error: "날짜를 확인해주세요.",
      })
    }

    const nextDate =
      new Date(targetDate)

    nextDate.setDate(
      nextDate.getDate() + 1
    )

    const members =
      await prisma.user.findMany({
        where: {
          isActive: true,
          role: {
            in: ["USER", "ADMIN"],
          },
        },
        select: {
          id: true,
          username: true,
          name: true,
          department: true,
          position: true,
        },
        orderBy: {
          name: "asc",
        },
      })

    const logs =
      await prisma.workLog.findMany({
        where: {
          status: "SUBMITTED",
          workDate: {
            gte: targetDate,
            lt: nextDate,
          },
        },
        include:
          workLogInclude,
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
      })

    const result =
      members.map(
        (member) => {
          const memberLogs =
            logs.filter(
              (log) =>
                log.authorId === member.id
            )

          return {
            ...member,
            submitted:
              memberLogs.length > 0,
            logs:
              memberLogs,
          }
        }
      )

    res.json({
      date:
        targetDate
          .toISOString()
          .slice(0, 10),
      members:
        result,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "오늘 팀 업무를 불러오지 못했습니다.",
    })
  }
})

app.get("/api/worklogs/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const workLog =
      await prisma.workLog.findUnique({
        where: {
          id,
        },
        include:
          workLogInclude,
      })

    if (!workLog) {
      return res.status(404).json({
        error: "업무일지를 찾을 수 없습니다.",
      })
    }

    res.json(workLog)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "업무일지를 불러오지 못했습니다.",
    })
  }
})

app.post("/api/worklogs", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    const {
      workDate,
      title,
      completedWork,
      pendingWork,
      nextPlan,
      issues,
      handover,
      memo,
      status,
      isImportant,
      siteIds,
      materials,
    } = req.body

    const parsedDate =
      parseWorkDate(workDate)

    if (!parsedDate) {
      return res.status(400).json({
        error: "업무일지 날짜를 확인해주세요.",
      })
    }

    if (!hasWorkLogContent(req.body)) {
      return res.status(400).json({
        error: "업무 내용을 한 가지 이상 입력해주세요.",
      })
    }

    const workEntries = req.body.workEntries === undefined
      ? []
      : await normalizeWorkEntries(req.body.workEntries, prisma)
    const normalizedSiteIds = normalizeIdList([
      ...normalizeIdList(siteIds), ...workEntries.map((entry: any) => entry.siteId),
    ])

    const normalizedMaterials =
      normalizeMaterialList(materials)

    const finalStatus =
      status === "DRAFT"
        ? "DRAFT"
        : "SUBMITTED"

    const primarySiteId =
      normalizedSiteIds[0] || null

    const workLog =
      await prisma.$transaction(async (tx) => {
        if (finalStatus === "SUBMITTED") {
          for (const material of normalizedMaterials) {
            const item =
              await tx.inventoryItem.findUnique({
                where: {
                  id: material.itemId,
                },
              })

            if (!item || !item.isActive) {
              throw new Error("ITEM_NOT_FOUND")
            }

            if (item.currentStock < material.quantity) {
              throw new Error(
                `INSUFFICIENT_STOCK:${item.name}:${item.currentStock}:${material.quantity}`
              )
            }
          }
        }

        const created =
          await tx.workLog.create({
            data: {
              authorId: user.id,
              extraData: { workEntries },
              workDate: parsedDate,
              title: title?.trim() || null,
              completedWork: completedWork?.trim() || null,
              pendingWork: pendingWork?.trim() || null,
              nextPlan: nextPlan?.trim() || null,
              issues: issues?.trim() || null,
              handover: handover?.trim() || null,
              memo: memo?.trim() || null,
              status: finalStatus,
              isImportant: Boolean(isImportant),
              sites: {
                create:
                  normalizedSiteIds.map(
                    (siteId) => ({
                      siteId,
                    })
                  ),
              },
              materials: {
                create:
                  normalizedMaterials.map(
                    (material) => ({
                      itemId:
                        material.itemId,
                      quantity:
                        material.quantity,
                      usageType:
                        material.usageType,
                      deducted:
                        finalStatus === "SUBMITTED",
                    })
                  ),
              },
            },
          })

        if (finalStatus === "SUBMITTED") {
          for (const material of normalizedMaterials) {
            const updated =
              await tx.inventoryItem.update({
                where: {
                  id: material.itemId,
                },
                data: {
                  currentStock: {
                    decrement:
                      material.quantity,
                  },
                },
              })

            await tx.inventoryTransaction.create({
              data: {
                itemId:
                  material.itemId,
                userId:
                  user.id,
                siteId:
                  primarySiteId,
                workLogId:
                  created.id,
                type:
                  "WORKLOG_OUT",
                quantity:
                  -material.quantity,
                balanceAfter:
                  updated.currentStock,
                reason:
                  title?.trim() ||
                  "업무일지 사용 자재",
                usageType:
                  material.usageType,
              },
            })
          }
        }

        return tx.workLog.findUnique({
          where: {
            id: created.id,
          },
          include:
            workLogInclude,
        })
      })

    res.status(201).json(workLog)
  } catch (error: any) {
    console.error(error)
    if (error instanceof WorkLogEntryError) return res.status(400).json({ error: error.message })

    if (
      String(error?.message || "").startsWith("INSUFFICIENT_STOCK:")
    ) {
      const [
        ,
        name,
        stock,
        requested,
      ] =
        String(error.message).split(":")

      return res.status(400).json({
        error:
          `${name} 재고가 부족합니다. 현재 ${stock}개 / 사용 ${requested}개`,
      })
    }

    if (error?.message === "ITEM_NOT_FOUND") {
      return res.status(400).json({
        error: "사용 자재 중 등록되지 않은 품목이 있습니다.",
      })
    }

    res.status(500).json({
      error: "업무일지를 저장하지 못했습니다.",
    })
  }
})

app.put("/api/worklogs/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const existing =
      await prisma.workLog.findUnique({
        where: {
          id,
        },
        include: {
          materials: true,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "업무일지를 찾을 수 없습니다.",
      })
    }

    if (
      existing.authorId !== user.id &&
      !canManageUsers(user)
    ) {
      return res.status(403).json({
        error: "본인이 작성한 업무일지만 수정할 수 있습니다.",
      })
    }

    const {
      workDate,
      title,
      completedWork,
      pendingWork,
      nextPlan,
      issues,
      handover,
      memo,
      status,
      isImportant,
      siteIds,
      materials,
    } = req.body

    const parsedDate =
      parseWorkDate(workDate)

    if (!parsedDate) {
      return res.status(400).json({
        error: "업무일지 날짜를 확인해주세요.",
      })
    }

    if (!hasWorkLogContent(req.body)) {
      return res.status(400).json({
        error: "업무 내용을 한 가지 이상 입력해주세요.",
      })
    }

    const workEntries = req.body.workEntries === undefined
      ? ((existing.extraData as any)?.workEntries || [])
      : await normalizeWorkEntries(req.body.workEntries, prisma)
    const normalizedSiteIds = normalizeIdList([
      ...normalizeIdList(siteIds), ...workEntries.map((entry: any) => entry.siteId),
    ])

    const normalizedMaterials =
      normalizeMaterialList(materials)

    const finalStatus =
      status === "DRAFT"
        ? "DRAFT"
        : "SUBMITTED"

    const primarySiteId =
      normalizedSiteIds[0] || null

    const workLog =
      await prisma.$transaction(async (tx) => {
        // 먼저 기존 업무일지에서 실제 차감했던 자재를 모두 복구한다.
        for (const oldMaterial of existing.materials) {
          if (!oldMaterial.deducted) continue

          const restored =
            await tx.inventoryItem.update({
              where: {
                id:
                  oldMaterial.itemId,
              },
              data: {
                currentStock: {
                  increment:
                    oldMaterial.quantity,
                },
              },
            })

          await tx.inventoryTransaction.create({
            data: {
              itemId:
                oldMaterial.itemId,
              userId:
                user.id,
              siteId:
                primarySiteId,
              workLogId:
                id,
              type:
                "WORKLOG_RESTORE",
              quantity:
                oldMaterial.quantity,
              balanceAfter:
                restored.currentStock,
              reason:
                "업무일지 수정으로 기존 사용 자재 복구",
              usageType:
                oldMaterial.usageType,
            },
          })
        }

        if (finalStatus === "SUBMITTED") {
          for (const material of normalizedMaterials) {
            const item =
              await tx.inventoryItem.findUnique({
                where: {
                  id:
                    material.itemId,
                },
              })

            if (!item || !item.isActive) {
              throw new Error("ITEM_NOT_FOUND")
            }

            if (item.currentStock < material.quantity) {
              throw new Error(
                `INSUFFICIENT_STOCK:${item.name}:${item.currentStock}:${material.quantity}`
              )
            }
          }
        }

        await tx.workLogMaterial.deleteMany({
          where: {
            workLogId:
              id,
          },
        })

        await tx.workLog.update({
          where: {
            id,
          },
          data: {
            extraData: { ...((existing.extraData as any) || {}), workEntries },
            workDate:
              parsedDate,
            title:
              title?.trim() || null,
            completedWork:
              completedWork?.trim() || null,
            pendingWork:
              pendingWork?.trim() || null,
            nextPlan:
              nextPlan?.trim() || null,
            issues:
              issues?.trim() || null,
            handover:
              handover?.trim() || null,
            memo:
              memo?.trim() || null,
            status:
              finalStatus,
            isImportant:
              Boolean(isImportant),
            sites: {
              deleteMany: {},
              create:
                normalizedSiteIds.map(
                  (siteId) => ({
                    siteId,
                  })
                ),
            },
            materials: {
              create:
                normalizedMaterials.map(
                  (material) => ({
                    itemId:
                      material.itemId,
                    quantity:
                      material.quantity,
                    usageType:
                      material.usageType,
                    deducted:
                      finalStatus === "SUBMITTED",
                  })
                ),
            },
          },
        })

        if (finalStatus === "SUBMITTED") {
          for (const material of normalizedMaterials) {
            const updated =
              await tx.inventoryItem.update({
                where: {
                  id:
                    material.itemId,
                },
                data: {
                  currentStock: {
                    decrement:
                      material.quantity,
                  },
                },
              })

            await tx.inventoryTransaction.create({
              data: {
                itemId:
                  material.itemId,
                userId:
                  user.id,
                siteId:
                  primarySiteId,
                workLogId:
                  id,
                type:
                  "WORKLOG_OUT",
                quantity:
                  -material.quantity,
                balanceAfter:
                  updated.currentStock,
                reason:
                  title?.trim() ||
                  "업무일지 사용 자재",
                usageType:
                  material.usageType,
              },
            })
          }
        }

        return tx.workLog.findUnique({
          where: {
            id,
          },
          include:
            workLogInclude,
        })
      })

    res.json(workLog)
  } catch (error: any) {
    console.error(error)
    if (error instanceof WorkLogEntryError) return res.status(400).json({ error: error.message })

    if (
      String(error?.message || "").startsWith("INSUFFICIENT_STOCK:")
    ) {
      const [
        ,
        name,
        stock,
        requested,
      ] =
        String(error.message).split(":")

      return res.status(400).json({
        error:
          `${name} 재고가 부족합니다. 현재 ${stock}개 / 사용 ${requested}개`,
      })
    }

    if (error?.message === "ITEM_NOT_FOUND") {
      return res.status(400).json({
        error: "사용 자재 중 등록되지 않은 품목이 있습니다.",
      })
    }

    res.status(500).json({
      error: "업무일지를 수정하지 못했습니다.",
    })
  }
})

app.delete("/api/worklogs/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const existing =
      await prisma.workLog.findUnique({
        where: {
          id,
        },
        include: {
          materials: true,
          sites: true,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "업무일지를 찾을 수 없습니다.",
      })
    }

    if (
      existing.authorId !== user.id &&
      !canManageUsers(user)
    ) {
      return res.status(403).json({
        error: "본인이 작성한 업무일지만 삭제할 수 있습니다.",
      })
    }

    await prisma.$transaction(async (tx) => {
      for (const material of existing.materials) {
        if (!material.deducted) continue

        const restored =
          await tx.inventoryItem.update({
            where: {
              id:
                material.itemId,
            },
            data: {
              currentStock: {
                increment:
                  material.quantity,
              },
            },
          })

        await tx.inventoryTransaction.create({
          data: {
            itemId:
              material.itemId,
            userId:
              user.id,
            siteId:
              existing.sites[0]?.siteId ||
              null,
            workLogId:
              null,
            type:
              "WORKLOG_RESTORE",
            quantity:
              material.quantity,
            balanceAfter:
              restored.currentStock,
            reason:
              `업무일지 삭제 복구 #${id}`,
            usageType:
              material.usageType,
          },
        })
      }

      await tx.workLog.delete({
        where: {
          id,
        },
      })
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "업무일지를 삭제하지 못했습니다.",
    })
  }
})

app.post("/api/worklogs/:id/comments", async (req, res) => {
  try {
    const workLogId =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const content =
      String(
        req.body.content || ""
      ).trim()

    if (!content) {
      return res.status(400).json({
        error: "댓글 내용을 입력해주세요.",
      })
    }

    const workLog =
      await prisma.workLog.findUnique({
        where: {
          id:
            workLogId,
        },
      })

    if (!workLog) {
      return res.status(404).json({
        error: "업무일지를 찾을 수 없습니다.",
      })
    }

    const comment =
      await prisma.workLogComment.create({
        data: {
          workLogId,
          authorId:
            user.id,
          content,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
            },
          },
        },
      })

    res.status(201).json(
      comment
    )
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "댓글을 등록하지 못했습니다.",
    })
  }
})

app.post(
  "/api/worklogs/:id/manual-candidate",
  async (req, res) => {
    try {
      const workLogId =
        Number(req.params.id)

      const workLog =
        await prisma.workLog.findUnique({
          where: {
            id:
              workLogId,
          },
        })

      if (!workLog) {
        return res.status(404).json({
          error: "업무일지를 찾을 수 없습니다.",
        })
      }

      const title =
        String(
          req.body.title ||
          workLog.title ||
          "업무 매뉴얼 후보"
        ).trim()

      const content =
        String(
          req.body.content ||
          workLog.issues ||
          workLog.completedWork ||
          ""
        ).trim()

      const candidate =
        await prisma.manualCandidate.create({
          data: {
            workLogId,
            title,
            content:
              content || null,
            status:
              "CANDIDATE",
          },
        })

      res.status(201).json(
        candidate
      )
    } catch (error) {
      console.error(error)

      res.status(500).json({
        error: "매뉴얼 후보로 등록하지 못했습니다.",
      })
    }
  }
)

// ======================================================
// 업무 매뉴얼
// ======================================================

app.get("/api/manual-candidates", async (req, res) => {
  try {
    const status =
      String(
        req.query.status ||
        "CANDIDATE"
      )

    const candidates =
      await prisma.manualCandidate.findMany({
        where: {
          status,
        },
        include: {
          workLog: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  department: true,
                  position: true,
                },
              },
              sites: {
                include: {
                  site: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          manual: true,
        },
        orderBy: {
          createdAt:
            "desc",
        },
      })

    res.json(candidates)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "매뉴얼 후보를 불러오지 못했습니다.",
    })
  }
})

app.get("/api/manuals", async (req, res) => {
  try {
    const manuals =
      await prisma.manual.findMany({
        where: {
          status: "ACTIVE",
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
            },
          },
          sourceCandidate: {
            include: {
              workLog: {
                include: {
                  author: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  sites: {
                    include: {
                      site: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          {
            category:
              "asc",
          },
          {
            updatedAt:
              "desc",
          },
        ],
      })

    res.json(manuals)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "업무 매뉴얼을 불러오지 못했습니다.",
    })
  }
})

app.post(
  "/api/manual-candidates/:id/promote",
  async (req, res) => {
    try {
      const user =
        getCurrentUser(req)

      if (!canManageUsers(user)) {
        return res.status(403).json({
          error:
            "매뉴얼 확정은 MASTER 또는 ADMIN만 할 수 있습니다.",
        })
      }

      const id =
        Number(req.params.id)

      const candidate =
        await prisma.manualCandidate.findUnique({
          where: {
            id,
          },
          include: {
            manual: true,
          },
        })

      if (!candidate) {
        return res.status(404).json({
          error: "매뉴얼 후보를 찾을 수 없습니다.",
        })
      }

      if (
        candidate.status !==
        "CANDIDATE"
      ) {
        return res.status(400).json({
          error: "이미 처리된 매뉴얼 후보입니다.",
        })
      }

      if (candidate.manual) {
        return res.status(400).json({
          error: "이미 매뉴얼로 등록되어 있습니다.",
        })
      }

      const title =
        String(
          req.body.title ||
          candidate.title
        ).trim()

      const content =
        String(
          req.body.content ||
          candidate.content ||
          ""
        ).trim()

      const category =
        String(
          req.body.category ||
          "기타"
        ).trim()

      if (!title) {
        return res.status(400).json({
          error: "매뉴얼 제목을 입력해주세요.",
        })
      }

      const manual =
        await prisma.$transaction(
          async (tx) => {
            const created =
              await tx.manual.create({
                data: {
                  title,
                  content:
                    content || null,
                  category:
                    category || "기타",
                  sourceCandidateId:
                    candidate.id,
                  createdById:
                    user.id,
                  status:
                    "ACTIVE",
                },
                include: {
                  createdBy: {
                    select: {
                      id: true,
                      name: true,
                      department: true,
                      position: true,
                    },
                  },
                },
              })

            await tx.manualCandidate.update({
              where: {
                id:
                  candidate.id,
              },
              data: {
                status:
                  "PROMOTED",
              },
            })

            return created
          }
        )

      res.status(201).json(
        manual
      )
    } catch (error) {
      console.error(error)

      res.status(500).json({
        error: "업무 매뉴얼로 확정하지 못했습니다.",
      })
    }
  }
)

app.post(
  "/api/manual-candidates/:id/reject",
  async (req, res) => {
    try {
      const user =
        getCurrentUser(req)

      if (!canManageUsers(user)) {
        return res.status(403).json({
          error:
            "매뉴얼 후보 처리 권한이 없습니다.",
        })
      }

      const id =
        Number(req.params.id)

      const candidate =
        await prisma.manualCandidate.findUnique({
          where: {
            id,
          },
        })

      if (!candidate) {
        return res.status(404).json({
          error: "매뉴얼 후보를 찾을 수 없습니다.",
        })
      }

      const updated =
        await prisma.manualCandidate.update({
          where: {
            id,
          },
          data: {
            status:
              "REJECTED",
          },
        })

      res.json(updated)
    } catch (error) {
      console.error(error)

      res.status(500).json({
        error: "매뉴얼 후보를 제외하지 못했습니다.",
      })
    }
  }
)

app.put("/api/manuals/:id", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error:
          "매뉴얼 수정 권한이 없습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const {
      title,
      content,
      category,
    } = req.body

    const manual =
      await prisma.manual.update({
        where: {
          id,
        },
        data: {
          ...(title !== undefined && {
            title:
              String(title).trim(),
          }),
          ...(content !== undefined && {
            content:
              String(content).trim() || null,
          }),
          ...(category !== undefined && {
            category:
              String(category).trim() || "기타",
          }),
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
            },
          },
        },
      })

    res.json(manual)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "업무 매뉴얼을 수정하지 못했습니다.",
    })
  }
})

app.delete("/api/manuals/:id", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    if (!canManageUsers(user)) {
      return res.status(403).json({
        error:
          "매뉴얼 삭제 권한이 없습니다.",
      })
    }

    const id =
      Number(req.params.id)

    const manual =
      await prisma.manual.findUnique({
        where: {
          id,
        },
      })

    if (!manual) {
      return res.status(404).json({
        error: "업무 매뉴얼을 찾을 수 없습니다.",
      })
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.manual.delete({
          where: {
            id,
          },
        })

        if (
          manual.sourceCandidateId
        ) {
          await tx.manualCandidate.update({
            where: {
              id:
                manual.sourceCandidateId,
            },
            data: {
              status:
                "CANDIDATE",
            },
          })
        }
      }
    )

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "업무 매뉴얼을 삭제하지 못했습니다.",
    })
  }
})

// ======================================================
// 연차
// ======================================================

const leaveRequestInclude = {
  user: {
    select: {
      id: true,
      name: true,
      department: true,
      position: true,
    },
  },
  agreements: {
    include: {
      approver: {
        select: {
          id: true,
          name: true,
          department: true,
          position: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
} as const

async function getEligibleLeaveApprovers(
  requesterId: number
) {
  return prisma.user.findMany({
    where: {
      id: {
        not: requesterId,
      },
      isActive: true,
      role: {
        in: ["USER", "ADMIN"],
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  })
}

function yearRange(year: number) {
  return {
    from: new Date(
      `${year}-01-01T00:00:00`
    ),
    to: new Date(
      `${year + 1}-01-01T00:00:00`
    ),
  }
}

async function getLeaveUsage(
  userId: number,
  year: number,
  excludeId?: number
) {
  const {
    from,
    to,
  } = yearRange(year)

  const baseWhere: any = {
    userId,
    startDate: {
      gte: from,
    },
    endDate: {
      lt: to,
    },
  }

  if (excludeId) {
    baseWhere.id = {
      not: excludeId,
    }
  }

  const [
    approved,
    pending,
  ] = await Promise.all([
    prisma.leaveRequest.aggregate({
      where: {
        ...baseWhere,
        status: "APPROVED",
      },
      _sum: {
        days: true,
      },
    }),
    prisma.leaveRequest.aggregate({
      where: {
        ...baseWhere,
        status: "PENDING",
      },
      _sum: {
        days: true,
      },
    }),
  ])

  return {
    usedDays:
      approved._sum.days || 0,
    pendingDays:
      pending._sum.days || 0,
  }
}

app.get("/api/leave/summary", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    const year =
      Number(req.query.year) ||
      CURRENT_YEAR

    const balance =
      await prisma.leaveBalance.upsert({
        where: {
          userId_year: {
            userId:
              user.id,
            year,
          },
        },
        update: {},
        create: {
          userId:
            user.id,
          year,
          grantedDays:
            15,
        },
      })

    const {
      from,
      to,
    } = yearRange(year)

    const [
      usage,
      requests,
    ] = await Promise.all([
      getLeaveUsage(
        user.id,
        year
      ),
      prisma.leaveRequest.findMany({
        where: {
          userId:
            user.id,
          startDate: {
            gte:
              from,
          },
          endDate: {
            lt:
              to,
          },
        },
        include:
          leaveRequestInclude,
        orderBy: {
          startDate:
            "desc",
        },
      }),
    ])

    res.json({
      user:
        publicUser(user),
      year,
      grantedDays:
        balance.grantedDays,
      usedDays:
        usage.usedDays,
      pendingDays:
        usage.pendingDays,
      remainingDays:
        balance.grantedDays -
        usage.usedDays,
      availableDays:
        balance.grantedDays -
        usage.usedDays -
        usage.pendingDays,
      requests,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "연차 정보를 불러오지 못했습니다.",
    })
  }
})

app.get("/api/leave/pending", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    const agreements =
      await prisma.leaveAgreement.findMany({
        where: {
          approverId:
            user.id,
          status:
            "PENDING",
          leaveRequest: {
            status:
              "PENDING",
          },
        },
        include: {
          leaveRequest: {
            include:
              leaveRequestInclude,
          },
        },
        orderBy: {
          createdAt:
            "desc",
        },
      })

    res.json(
      agreements.map(
        (item) =>
          item.leaveRequest
      )
    )
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "동의 대기 연차를 불러오지 못했습니다.",
    })
  }
})

app.get("/api/leave/calendar", async (req, res) => {
  try {
    const year =
      Number(req.query.year) ||
      CURRENT_YEAR

    const month =
      Number(req.query.month)

    const where: any = {
      status:
        "APPROVED",
    }

    if (
      month >= 1 &&
      month <= 12
    ) {
      const from =
        new Date(
          year,
          month - 1,
          1
        )

      const to =
        new Date(
          year,
          month,
          1
        )

      where.AND = [
        {
          startDate: {
            lt:
              to,
          },
        },
        {
          endDate: {
            gte:
              from,
          },
        },
      ]
    }

    const requests =
      await prisma.leaveRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              department: true,
              position: true,
            },
          },
        },
        orderBy: {
          startDate:
            "asc",
        },
      })

    res.json(requests)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "연차 캘린더를 불러오지 못했습니다.",
    })
  }
})

app.post("/api/leave", async (req, res) => {
  try {
    const user =
      getCurrentUser(req)

    const {
      startDate,
      endDate,
      days,
      leaveType,
      reason,
    } = req.body

    if (
      !startDate ||
      !endDate ||
      !days
    ) {
      return res.status(400).json({
        error:
          "시작일, 종료일, 사용 일수를 입력해주세요.",
      })
    }

    const requestedDays =
      Number(days)

    if (
      !Number.isFinite(requestedDays) ||
      requestedDays <= 0
    ) {
      return res.status(400).json({
        error:
          "사용 일수를 올바르게 입력해주세요.",
      })
    }

    const start =
      new Date(startDate)

    const end =
      new Date(endDate)

    if (end < start) {
      return res.status(400).json({
        error:
          "종료일은 시작일보다 빠를 수 없습니다.",
      })
    }

    const year =
      start.getFullYear()

    const balance =
      await prisma.leaveBalance.upsert({
        where: {
          userId_year: {
            userId:
              user.id,
            year,
          },
        },
        update: {},
        create: {
          userId:
            user.id,
          year,
          grantedDays:
            15,
        },
      })

    const usage =
      await getLeaveUsage(
        user.id,
        year
      )

    const availableDays =
      balance.grantedDays -
      usage.usedDays -
      usage.pendingDays

    if (
      requestedDays >
      availableDays
    ) {
      return res.status(400).json({
        error:
          `현재 신청 가능한 연차는 ${availableDays}일입니다.`,
      })
    }

    const approvers =
      await getEligibleLeaveApprovers(
        user.id
      )

    const request =
      await prisma.leaveRequest.create({
        data: {
          userId:
            user.id,
          startDate:
            start,
          endDate:
            end,
          days:
            requestedDays,
          leaveType:
            leaveType || "연차",
          reason:
            reason || null,
          status:
            approvers.length
              ? "PENDING"
              : "APPROVED",
          agreements: {
            create:
              approvers.map(
                (approver) => ({
                  approverId:
                    approver.id,
                  status:
                    "PENDING",
                })
              ),
          },
        },
        include:
          leaveRequestInclude,
      })

    res.status(201).json(request)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "연차를 신청하지 못했습니다.",
    })
  }
})

app.post("/api/leave/:id/agree", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const request =
      await prisma.leaveRequest.findUnique({
        where: {
          id,
        },
        include:
          leaveRequestInclude,
      })

    if (!request) {
      return res.status(404).json({
        error: "연차 신청을 찾을 수 없습니다.",
      })
    }

    if (
      request.userId === user.id
    ) {
      return res.status(400).json({
        error: "본인의 연차 신청에는 동의할 수 없습니다.",
      })
    }

    if (
      request.status !== "PENDING"
    ) {
      return res.status(400).json({
        error: "이미 처리가 완료된 연차입니다.",
      })
    }

    const agreement =
      await prisma.leaveAgreement.findUnique({
        where: {
          leaveRequestId_approverId: {
            leaveRequestId:
              id,
            approverId:
              user.id,
          },
        },
      })

    if (!agreement) {
      return res.status(403).json({
        error: "이 연차에 동의할 대상이 아닙니다.",
      })
    }

    if (
      agreement.status === "AGREED"
    ) {
      return res.status(400).json({
        error: "이미 동의한 연차입니다.",
      })
    }

    await prisma.leaveAgreement.update({
      where: {
        id:
          agreement.id,
      },
      data: {
        status:
          "AGREED",
        agreedAt:
          new Date(),
      },
    })

    const remaining =
      await prisma.leaveAgreement.count({
        where: {
          leaveRequestId:
            id,
          status: {
            not:
              "AGREED",
          },
        },
      })

    if (remaining === 0) {
      await prisma.leaveRequest.update({
        where: {
          id,
        },
        data: {
          status:
            "APPROVED",
        },
      })
    }

    const updated =
      await prisma.leaveRequest.findUnique({
        where: {
          id,
        },
        include:
          leaveRequestInclude,
      })

    res.json(updated)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "연차 동의 처리 중 오류가 발생했습니다.",
    })
  }
})

app.put("/api/leave/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const existing =
      await prisma.leaveRequest.findUnique({
        where: {
          id,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "연차 내역을 찾을 수 없습니다.",
      })
    }

    if (
      existing.userId !== user.id &&
      !canManageUsers(user)
    ) {
      return res.status(403).json({
        error: "본인의 연차만 수정할 수 있습니다.",
      })
    }

    const {
      startDate,
      endDate,
      days,
      leaveType,
      reason,
    } = req.body

    const start =
      new Date(startDate)

    const end =
      new Date(endDate)

    const requestedDays =
      Number(days)

    if (
      !startDate ||
      !endDate ||
      !Number.isFinite(requestedDays) ||
      requestedDays <= 0 ||
      end < start
    ) {
      return res.status(400).json({
        error: "연차 정보를 다시 확인해주세요.",
      })
    }

    const targetUserId =
      existing.userId

    const year =
      start.getFullYear()

    const balance =
      await prisma.leaveBalance.upsert({
        where: {
          userId_year: {
            userId:
              targetUserId,
            year,
          },
        },
        update: {},
        create: {
          userId:
            targetUserId,
          year,
          grantedDays:
            15,
        },
      })

    const usage =
      await getLeaveUsage(
        targetUserId,
        year,
        id
      )

    const availableDays =
      balance.grantedDays -
      usage.usedDays -
      usage.pendingDays

    if (
      requestedDays >
      availableDays
    ) {
      return res.status(400).json({
        error:
          `수정 가능한 연차는 ${availableDays}일입니다.`,
      })
    }

    const approvers =
      await getEligibleLeaveApprovers(
        targetUserId
      )

    await prisma.$transaction([
      prisma.leaveAgreement.deleteMany({
        where: {
          leaveRequestId:
            id,
        },
      }),
      prisma.leaveRequest.update({
        where: {
          id,
        },
        data: {
          startDate:
            start,
          endDate:
            end,
          days:
            requestedDays,
          leaveType:
            leaveType || "연차",
          reason:
            reason || null,
          status:
            approvers.length
              ? "PENDING"
              : "APPROVED",
        },
      }),
    ])

    if (
      approvers.length
    ) {
      await prisma.leaveAgreement.createMany({
        data:
          approvers.map(
            (approver) => ({
              leaveRequestId:
                id,
              approverId:
                approver.id,
              status:
                "PENDING",
            })
          ),
      })
    }

    const updated =
      await prisma.leaveRequest.findUnique({
        where: {
          id,
        },
        include:
          leaveRequestInclude,
      })

    res.json(updated)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "연차를 수정하지 못했습니다.",
    })
  }
})

app.delete("/api/leave/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id)

    const user =
      getCurrentUser(req)

    const existing =
      await prisma.leaveRequest.findUnique({
        where: {
          id,
        },
      })

    if (!existing) {
      return res.status(404).json({
        error: "연차 내역을 찾을 수 없습니다.",
      })
    }

    if (
      existing.userId !== user.id &&
      !canManageUsers(user)
    ) {
      return res.status(403).json({
        error: "본인의 연차만 삭제할 수 있습니다.",
      })
    }

    await prisma.leaveRequest.delete({
      where: {
        id,
      },
    })

    res.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      error: "연차를 삭제하지 못했습니다.",
    })
  }
})

await ensureSystemOptions()
await ensureDefaultChecklistTemplates()

const masterAccount = await ensureMasterAccount()

const masterPasswordMatchesEnv = await bcrypt.compare(
  MASTER_PASSWORD,
  masterAccount.passwordHash
)

const PORT = 4000

const frontendDistDir = path.join(projectRoot, "dist")

if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir))
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next()
    return res.sendFile(path.join(frontendDistDir, "index.html"))
  })
}

app.listen(PORT, () => {
  console.log("CS Manager API 서버 실행 중")
  console.log(`http://localhost:${PORT}`)
  console.log(`자료실 저장 폴더: ${resourceUploadDir}`)
  console.log(`MASTER 아이디: ${MASTER_USERNAME}`)
  console.log(
    `MASTER .env 비밀번호 일치: ${
      masterPasswordMatchesEnv ? "YES" : "NO"
    }`
  )

  if (MASTER_RESET_ON_START) {
    console.log(
      'MASTER_RESET_ON_START=true : MASTER 비밀번호를 .env 값으로 맞췄습니다.'
    )
  }
})
