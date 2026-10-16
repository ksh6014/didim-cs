# Git 자동배포: 프론트엔드 전용

개발 PC에서 검증한 변경을 GitHub `ksh6014/didim-cs`의 `main`에 푸시하면 서버의 별도 에이전트가 기본 60초마다 확인한다. 서버 소스 폴더는 `D:\DIDIM-CS`, 기존 운영 폴더는 `C:\CS-DEV`다. 에이전트는 운영 앱을 재시작하지 않는다. 새 포트나 웹훅, DB 변경, Funnel 변경은 없다.

## 동작과 제한

- 특정 커밋을 별도 준비 폴더에 꺼내고 `npm ci --ignore-scripts --include=dev --no-audit --no-fund`, 기존 테스트 14개, 프론트엔드 빌드를 실행한다. 잠금 파일을 사용하며 패키지를 업그레이드하지 않는다. 운영 node_modules를 건드리지 않는다.
- 자동 반영 가능 범위는 `src/`, `public/`(다운로드·DB 등 제외), `index.html`, `vite.config.js`다. 문서와 `scripts/git-deploy/` 변경만 있으면 운영 파일을 바꾸지 않고 커밋 확인 이력만 기록한다.
- 백엔드·Prisma·package.json·package-lock.json·기존 배포 스크립트 변경은 자동배포를 차단한다. 현재 도구를 전체 앱 또는 DB 자동배포 도구로 사용하지 않는다.
- 에이전트 자체는 설치 시 운영 폴더 아래에 복사한 고정 버전을 실행한다. Git의 새 에이전트 코드를 자동 실행하거나 자동 업그레이드하지 않는다.
- 초기화는 이미 운영 반영한 `29bc25c4074551ac4f7e4cea46f28e426994d62b`의 소스·빌드 및 HTTP 내용을 대조한다. 서버 package.json의 기존 allowScripts 설정은 보존한다.
- 새 커밋은 기존에 수용한 커밋의 후손이어야 한다. 강제 푸시는 차단한다. 되돌리기는 새 `git revert` 커밋으로 전달한다.
- 기존 ZIP 배포 에이전트와 같은 `deployment/deployment.lock`을 확인한다. 앞으로 기존 `deploy-to-server.ps1`은 함께 사용하지 않는다. 기존 에이전트 설정·프로세스는 이 설치 도구가 변경하지 않는다.
- Git 원격 인증은 서버 사용자의 Git 설정을 사용한다. 비공개 저장소 인증이 필요하면 서버에서 직접 설정한다. 토큰을 소스나 명령 인수에 넣지 않는다.

## 서버 설치

개발 PC에서 도구를 검증하는 명령:

```powershell
node --test scripts/git-deploy/agent.test.mjs src/LeaveCalendarDays.test.mjs server/worklog-entries.test.mjs
```

통합 검증은 무시된 deployment 폴더 안에 임시 운영 폴더와 Git 복제본을 만들며, 실제 운영 서버를 변경하지 않는다. 전체 Git 아카이브·의존성 설치·기존 테스트·빌드·HTTP 확인 경로도 로컬 임시 환경에서 실행한다.

먼저 개발 PC에서 배포 도구 커밋을 검토하고 GitHub에 푸시해야 한다. 서버에서 아래 명령을 실행한다.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    git -C D:\DIDIM-CS status --short
    # 변경 파일이 있으면 여기서 중단하고 먼저 확인한다.
    if (git -C D:\DIDIM-CS status --porcelain) { throw 'Source folder has local changes.' }
    git -C D:\DIDIM-CS pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Git pull failed.' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\DIDIM-CS\scripts\git-deploy\install.ps1 -SourceRoot D:\DIDIM-CS -RuntimeRoot C:\CS-DEV -PollSeconds 60 -Start
    if ($LASTEXITCODE -ne 0) { throw 'Agent installation failed.' }
}
```

같은 Windows 사용자가 로그인하면 시작프로그램의 `DIDIM CS Git Auto Deploy.cmd`가 에이전트를 실행한다. 로그인 전 실행을 보장하는 Windows 서비스는 아니다. 현재 운영 앱도 별도 시작프로그램으로 실행 중이다. 서버 전체 재부팅은 필요 없다.

에이전트는 복제한 폴더의 main을 임의로 reset/pull하지 않고, fetch한 커밋을 별도 폴더에서 빌드한다. 따라서 `D:\DIDIM-CS`의 작업 폴더 HEAD와 실제 배포 버전이 다를 수 있다. 실제 배포 상태는 아래 state.json을 기준으로 확인한다.

## 상태 확인

```powershell
Get-Content C:\CS-DEV\deployment\git-auto\agent.log -Tail 30
Get-Content C:\CS-DEV\deployment\git-auto\state.json
Get-Content C:\CS-DEV\deployment\git-auto\stderr.log -Tail 20
```

`acceptedCommit`은 정책 검사를 통과한 커밋, `frontendCommit`은 실제 화면을 마지막으로 반영한 커밋이다. 초기 설치 도구 변경만 들어온 경우 두 값이 다를 수 있다. `APPLIED`와 HTTP 내용 검증 통과를 확인해야 실제 반영 성공이다.

실패한 커밋은 반복 시도하지 않는다. `failedCommit`, `lastError`와 `D:\DIDIM-CS\deployment\git-releases` 아래 설치·테스트·빌드 로그를 확인한다. 수정 커밋을 푸시하면 다음 확인 때 재시도한다. 네트워크 오류 등으로 같은 커밋을 재시도하려면 원인을 해결한 뒤 다음을 실행한다. 기존 에이전트와 잠금이 겹치면 실행을 건너뛰므로 로그를 확인한다.

```powershell
node C:\CS-DEV\deployment\git-auto\agent\agent.mjs --config C:\CS-DEV\deployment\git-auto\config.json --once --retry
```

## 중단·재개

```powershell
New-Item -ItemType File -Path C:\CS-DEV\deployment\git-auto\PAUSED
```

이미 진행 중인 파일 교체는 끝날 수 있다. 빌드 후와 파일 교체 직전에 중단 여부를 확인한다. 재개할 때는 직접 만든 PAUSED 파일만 제거한다.

```powershell
Remove-Item -LiteralPath C:\CS-DEV\deployment\git-auto\PAUSED
```

## 백업·복구와 운영 제한

반영 전 변경 대상 파일을 `C:\CS-DEV\deployment\git-auto\backups`에 보존한다. 새 리소스·소스를 먼저 반영하고 HTML을 마지막에 같은 디렉터리에서 교체한다. 파일 해시와 HTTP 응답 본문 해시를 확인한다. 이전 해시 이름의 assets 및 Git 대상이 아닌 downloads는 보존한다. 여러 파일 전체가 하나의 원자적 거래로 바뀌는 방식은 아니므로 교체 중 짧은 혼합 상태가 있을 수 있다.

반영 실패 시 백업으로 복원한다. 새 파일은 원래 없었던 파일에 한해서 정리하며 새 해시 assets는 비참조 상태로 남길 수 있다. DB·uploads·.env·토큰·패키지·서버 코드는 이 파일 교체 대상이 아니다. 복구 자체에 실패하면 pending.json을 보존한다. 다음 시작 때 재복구하고 PAUSED 상태로 멈춰 점검을 요청한다.

운영 src/dist/public을 다른 도구로 수정하면 해시 검사에서 멈춘다. 자동배포와 기존 수동 덮어쓰기를 섞지 않는다. 백업·빌드 폴더는 자동 삭제하지 않으므로 용량을 주기적으로 확인한다.

기능 또는 모바일 표시 문제처럼 HTTP로 발견되지 않는 회귀는 자동 복구를 보장하지 않는다. 개발 PC에서 화면을 검증한 뒤 푸시하고, 운영 확인 후 문제가 있으면 `git revert` 커밋을 만든다. 자동배포가 실패한 경우 우선 PAUSED 후 해당 백업의 이전 state·파일을 검토한다. 백업 안 `applied-journal.json`에는 복구 대상과 원래 해시가 남는다. DB를 과거 버전으로 덮어쓰지 않는다.

## 에이전트 업그레이드

main의 도구 파일 변경만으로 실행 중 에이전트는 바뀌지 않는다. PAUSED 후 배포 잠금이 사라진 것을 확인하고, agent.pid와 실제 프로세스 명령행을 대조한 뒤 해당 에이전트만 중지한다. 기존 agent 폴더를 백업하고 검토된 도구 파일만 교체한 뒤 start-agent.ps1로 시작한다. 기존 state.json·config.json을 재초기화하거나 제거하지 않는다.
