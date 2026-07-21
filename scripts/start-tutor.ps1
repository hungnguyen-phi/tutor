# =============================================================================
#  AI TUTOR - khoi dong sach + tunnel (dung cho shortcut "AI Tutor" tren Desktop)
#
#  QUAN TRONG: file nay phai giu ASCII thuan (khong go dau tieng Viet, khong
#  dung ky tu dac biet) vi PowerShell 5.1 doc file khong BOM theo ANSI ->
#  ky tu co dau se lam vo script (loi "Unexpected token").
#
#  Cac buoc:
#   1. Don dung port 3002 (KHONG dung port 3000/3010 cua app khac).
#   2. Cach ly cache: NEXT_DIST_DIR=.next-preview (khong pha dev khac).
#   3. Mo tunnel cloudflared -> in link chia se + copy vao clipboard.
#   4. Tu mo trinh duyet (link tunnel) khi server san sang.
#   5. Chay dev server trong cua so nay.
#
#  Giu cua so nay mo = app dang chay. Dong cua so = tat app.
# =============================================================================

$ErrorActionPreference = 'SilentlyContinue'
$Port   = 3002
$Local  = "http://localhost:$Port/"
$AppDir = 'D:\tutor\apps\web'
$TunnelLog = Join-Path $env:TEMP 'ai-tutor-tunnel.log'

$host.UI.RawUI.WindowTitle = "AI Tutor (cong $Port) - dong cua so nay de tat app"

Write-Host ""
Write-Host "  ==============================================" -ForegroundColor DarkCyan
Write-Host "     AI TUTOR - Truong Viet Anh" -ForegroundColor Cyan
Write-Host "  ==============================================" -ForegroundColor DarkCyan
Write-Host ""

# [1/5] Don port 3002 (chi 3002 - an toan cho 3000/graph va 3010/attendance)
Write-Host "  [1/5] Don port $Port..." -ForegroundColor Yellow
$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  Write-Host "        (da dung tien trinh cu tren $Port)" -ForegroundColor DarkGray
}

# Don tunnel cu tro vao dung port nay (khong dung tunnel cua app khac)
Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" |
  Where-Object { $_.CommandLine -match "localhost:$Port" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# [2/5] Cach ly cache
$env:NEXT_DIST_DIR = '.next-preview'

if (-not (Test-Path "$AppDir\package.json")) {
  Write-Host "  LOI: khong thay $AppDir. Kiem tra lai duong dan du an." -ForegroundColor Red
  Read-Host "  Nhan Enter de dong"
  exit 1
}
Set-Location $AppDir

# [3/5] Mo tunnel cloudflared (link chia se ra ngoai, doi moi lan chay)
Write-Host "  [2/5] Mo tunnel cloudflared..." -ForegroundColor Yellow
$TunnelUrl = $null
$TunnelProc = $null
if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
  Remove-Item $TunnelLog -Force -ErrorAction SilentlyContinue
  $TunnelProc = Start-Process cloudflared `
    -ArgumentList "tunnel", "--url", "http://localhost:$Port" `
    -RedirectStandardError $TunnelLog -WindowStyle Hidden -PassThru
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $m = Select-String -Path $TunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
         Select-Object -First 1
    if ($m) { $TunnelUrl = $m.Matches[0].Value; break }
  }
  if ($TunnelUrl) {
    Set-Clipboard -Value $TunnelUrl -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "        LINK CHIA SE (da copy san vao clipboard):" -ForegroundColor Green
    Write-Host "        $TunnelUrl" -ForegroundColor Black -BackgroundColor Green
    Write-Host ""
  } else {
    Write-Host "        (khong lay duoc link tunnel - xem log: $TunnelLog)" -ForegroundColor Red
  }
} else {
  Write-Host "        (khong tim thay cloudflared - bo qua, van chay local)" -ForegroundColor Red
}

# [4/5] Tu mo trinh duyet khi server da lang nghe (chay nen, khong chan)
$OpenUrl = $Local
if ($TunnelUrl) { $OpenUrl = $TunnelUrl }
Write-Host "  [3/5] Se tu mo trinh duyet: $OpenUrl" -ForegroundColor Yellow
Start-Job -ScriptBlock {
  param($p, $u)
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $t = New-Object Net.Sockets.TcpClient
      $t.Connect('localhost', $p)
      $t.Close()
      Start-Sleep -Seconds 2   # server da lang nghe -> cho compile 1 nhip roi mo
      Start-Process $u
      break
    } catch { Start-Sleep -Seconds 2 }
  }
} -ArgumentList $Port, $OpenUrl | Out-Null

# [5/5] Khoi dong dev server (khoa cua so nay - server song o day)
Write-Host "  [4/5] Khoi dong AI Tutor tren cong $Port..." -ForegroundColor Yellow
Write-Host "  [5/5] Local: $Local" -ForegroundColor Green
Write-Host ""
Write-Host "  ---- nhat ky server (giu cua so nay mo) ------------" -ForegroundColor DarkGray
Write-Host ""

pnpm --filter '@tutor/web' dev --port $Port

# Server dung (Ctrl+C hoac loi) -> tat tunnel, giu cua so de doc thong bao
if ($TunnelProc) { Stop-Process -Id $TunnelProc.Id -Force -ErrorAction SilentlyContinue }
Write-Host ""
Write-Host "  Server da dung. Chay lai shortcut de khoi dong lai." -ForegroundColor Yellow
Read-Host "  Nhan Enter de dong cua so"
