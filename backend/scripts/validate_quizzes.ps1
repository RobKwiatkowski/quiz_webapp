$pythonCmd = Get-Command py -ErrorAction SilentlyContinue

if ($pythonCmd) {
    py -3.12 backend/scripts/validate_quizzes.py
    exit $LASTEXITCODE
}

$venvPython = ".venv\\Scripts\\python.exe"
if (Test-Path $venvPython) {
    & $venvPython backend/scripts/validate_quizzes.py
    exit $LASTEXITCODE
}

$pythonCandidates = @(
    "$env:LOCALAPPDATA\\Programs\\Python\\Python312\\python.exe",
    "$env:USERPROFILE\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
    "$env:ProgramFiles\\Python312\\python.exe",
    "${env:ProgramFiles(x86)}\\Python312\\python.exe"
)

foreach ($pythonCandidate in $pythonCandidates) {
    if ($pythonCandidate -and (Test-Path $pythonCandidate)) {
        try {
            & $pythonCandidate --version *> $null
            if ($LASTEXITCODE -eq 0) {
                & $pythonCandidate backend/scripts/validate_quizzes.py
                exit $LASTEXITCODE
            }
        }
        catch {
            continue
        }
    }
}

Write-Error "No usable Python interpreter found."
exit 1
