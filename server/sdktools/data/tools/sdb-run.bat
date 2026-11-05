@ECHO OFF

set SDK_PATH=%~dp0

setlocal enabledelayedexpansion
IF EXIST !SDK_PATH! (
    set TOOLS_HOME=!SDK_PATH!
)
setlocal disabledelayedexpansion

if "%1" == "-s" (
title sdb - %2
) else (
title sdb
)

"%TOOLS_HOME%ansicon.exe" "%TOOLS_HOME%sdb.exe" %*

