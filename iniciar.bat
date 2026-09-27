@echo off
rem Abre o Open Finance Intelligence no Windows com dois cliques.
rem Na primeira vez instala as dependencias; depois so sobe a API e o site e abre o navegador.
title Open Finance Intelligence
cd /d "%~dp0"

echo.
echo  ==================================================
echo    Open Finance Intelligence
echo  ==================================================
echo.

if not exist "backend\.venv\Scripts\python.exe" (
  echo  [1/3] Preparando o Python ^(so na primeira vez, alguns minutos^)...
  python -m venv backend\.venv || goto :sem_python
  backend\.venv\Scripts\python.exe -m pip install --disable-pip-version-check -q -r backend\requirements.txt || goto :falhou
)

if not exist "frontend\node_modules" (
  echo  [2/3] Instalando o site ^(so na primeira vez, alguns minutos^)...
  call npm --prefix frontend install --no-audit --no-fund || goto :sem_node
)

echo  [3/3] Ligando a API e o site...
start "OFI - API (deixe aberta)" /min cmd /k "backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000"
start "OFI - Site (deixe aberta)" /min cmd /k "npm --prefix frontend run dev"

echo.
echo  Aguardando tudo ficar pronto. Na primeira vez os dados
echo  de demonstracao sao gerados e pode levar ~1 minuto...
set /a tentativas=0
:espera_api
set /a tentativas+=1
if %tentativas% gtr 120 goto :demorou
ping -n 3 127.0.0.1 >nul
curl -s -o nul http://localhost:8000/api/health || goto :espera_api

:espera_site
set /a tentativas+=1
if %tentativas% gtr 160 goto :demorou
ping -n 3 127.0.0.1 >nul
curl -s -o nul http://localhost:3000 || goto :espera_site

start "" http://localhost:3000
echo.
echo  Pronto! O app abriu no navegador: http://localhost:3000
echo.
echo  Para DESLIGAR: feche as janelas "OFI - API" e "OFI - Site"
echo  (ficam minimizadas na barra de tarefas).
echo.
pause
exit /b 0

:sem_python
echo.
echo  Nao encontrei o Python. Instale o Python 3.11 ou mais novo em
echo  https://www.python.org/downloads/ ^(marque "Add python.exe to PATH"^)
echo  e rode este arquivo de novo.
pause
exit /b 1

:sem_node
echo.
echo  Nao encontrei o Node.js. Instale a versao LTS em https://nodejs.org
echo  e rode este arquivo de novo.
pause
exit /b 1

:falhou
echo.
echo  Algo deu errado na instalacao. Veja a mensagem acima.
pause
exit /b 1

:demorou
echo.
echo  Esta demorando mais que o normal. Confira as janelas "OFI - API"
echo  e "OFI - Site" na barra de tarefas para ver se apareceu algum erro.
echo  Quando estiverem prontas, abra http://localhost:3000 no navegador.
pause
exit /b 1
