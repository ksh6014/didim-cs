# CS 업무관리 서버 PC 설치

1. 전달받은 ZIP 파일을 `C:\CS-DEV`에 압축 해제합니다.
2. PowerShell에서 아래 명령을 실행합니다.

   `powershell -ExecutionPolicy Bypass -File C:\CS-DEV\scripts\install-server.ps1`

3. 설치 후 브라우저에서 `http://localhost:4000`을 확인합니다.
4. Tailscale 외부 접속을 켭니다.

   `tailscale serve --bg 4000`

서버 PC의 Windows 사용자가 로그인하면 CS Manager가 자동으로 실행됩니다. 데이터베이스는 `prisma\dev.db`, 첨부파일은 `uploads` 폴더에 있습니다.
