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

Write-Error "No usable Python interpreter found."
exit 1