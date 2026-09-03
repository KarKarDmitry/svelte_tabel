@echo off
rem Сборка вьювера табеля для Windows XP (MinGW-w64).
rem Требуется gcc (i686 + msvcrt). Результат: tabviewer.exe
setlocal
cd /d "%~dp0"
set CC=C:\mingw32\bin\gcc.exe
set SRC=main.c model.c net.c events.c json.c enc.c log.c
rem Исходники UTF-8; выполняемые строки — ANSI CP1251 (рус. Windows XP, *A*-функции WinAPI)
set CFLAGS=-O2 -Wall -Wextra -D_WIN32_WINNT=0x0501 -mwindows -static-libgcc -finput-charset=UTF-8 -fexec-charset=CP1251
set LIBS=-lcomctl32 -lwininet -lgdi32

%CC% %CFLAGS% %SRC% -I. -o tabviewer.exe %LIBS%
if errorlevel 1 (
  echo Сборка не удалась.
  exit /b 1
)
echo Готово: tabviewer.exe