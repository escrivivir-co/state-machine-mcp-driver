@echo off
set PORT=3009
echo Buscando procesos en el puerto %PORT%...

REM Buscar el PID del proceso que usa el puerto
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set PID=%%a
    goto :found
)

echo No se encontro ningun proceso en el puerto %PORT%.
goto :end

:found
echo Encontrado proceso con PID: %PID%
echo Matando proceso Node.js en el puerto %PORT%...
taskkill /PID %PID% /F

if %errorlevel% equ 0 (
    echo Proceso eliminado exitosamente.
) else (
    echo Error al eliminar el proceso.
)

:end
pause
