@echo off
REM ============================================================
REM LANCER_MAINTENANT.bat — Atlas Sprint Final
REM Double-cliquer pour tout lancer d'un coup
REM ============================================================
echo.
echo ===== ATLAS SPRINT FINAL =====
echo.

set DB=postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
set WDIR=C:\PROJET_ATLAS_MASTER\atlas_reclone
set ARTDIR=C:\PROJET_ATLAS_MASTER\atlas_reclone\docs\RECHERCHE\article_geostats_togo
set PYTHONUTF8=1
set TF_ENABLE_ONEDNN_OPTS=0

cd /d %WDIR%

echo [1/6] Fix pipeline (VfS + MTGP re-queue + worker restart)...
python scripts\fix_and_resume.py
echo.

echo [2/6] Lancer 3 workers additionnels (parallelisme CPU)...
start /B python scripts\pipeline_worker.py --database-url %DB% --interval 10 > logs\worker_p2.log 2>&1
start /B python scripts\pipeline_worker.py --database-url %DB% --interval 10 > logs\worker_p3.log 2>&1
start /B python scripts\pipeline_worker.py --database-url %DB% --interval 10 > logs\worker_p4.log 2>&1
echo   3 workers supplementaires lances
echo.

echo [3/6] WSL2 Ubuntu CUDA setup (background)...
start /B wsl -d Ubuntu-22.04 --user root -e bash -c "apt-get update -qq 2>/dev/null; pip3 install --quiet tensorflow gpflow psycopg2-binary 2>/dev/null; echo WSL2 DONE" > logs\wsl2_setup.log 2>&1
echo   WSL2 setup en arriere-plan
echo.

echo [4/6] Regenerer figures...
cd /d %ARTDIR%
python generate_figures.py 2>&1 | findstr /I "Saved Error"
echo.

echo [5/6] Compiler article PDF (2 passes)...
cd /d %ARTDIR%
pdflatex -interaction=nonstopmode main.tex > logs_latex1.txt 2>&1
biber main >> logs_latex1.txt 2>&1
pdflatex -interaction=nonstopmode main.tex >> logs_latex1.txt 2>&1
pdflatex -interaction=nonstopmode main.tex >> logs_latex1.txt 2>&1
echo.

echo [6/6] Verification PDF...
if exist main.pdf (
    echo   SUCCES - main.pdf genere
    dir main.pdf
) else (
    echo   ERREUR - main.pdf non trouve, voir logs_latex1.txt
)

echo.
echo ===== TERMINE =====
echo PDF: %ARTDIR%\main.pdf
echo.
pause
