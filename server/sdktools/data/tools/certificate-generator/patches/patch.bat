@echo off
setlocal

set DIR=%~dp0
set DEFAULT_SDK_PATH=c:\tizen-sdk
set DEFAULT_CERT_PATH=tools\certificate-generator\certificates\distributor

echo Start Patch
if (%1)==(partner) (
    set PRIVILEGE_LEVEL=partner
) else if (%1)==(public) (
    set PRIVILEGE_LEVEL=public
) else (
    echo Invalid privilege level: %1
    echo .
    type README.txt
    goto END
)

if not (%2)==() (
	set TARGET_PATH=%2\%DEFAULT_CERT_PATH%
) else (
	set TARGET_PATH=..\certificates\distributor
)

if not exist %TARGET_PATH% (
	echo ERROR - Tizen SDK was not installed or invalid SDK path: %2 %TARGET_PATH%
) else (
	xcopy /y /q /u %DIR%\%PRIVILEGE_LEVEL%\certificates\* %TARGET_PATH%
	echo End Patch
)
:END
