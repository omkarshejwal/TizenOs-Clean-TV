@echo off
setlocal

set DIR=%~dp0
set DEFAULT_SDK_PATH=c:\tizen-sdk
set DEFAULT_CERT_PATH=tools\certificate-generator\certificates\distributor

echo Start Patch

if not (%1)==() (
	set TARGET_PATH=%1\%DEFAULT_CERT_PATH%
) else (
	set TARGET_PATH=%DEFAULT_SDK_PATH%\%DEFAULT_CERT_PATH% 
)

if not exist %TARGET_PATH% (
	echo ERROR - Tizen SDK was not installed or invalid SDK path is input.
) else (
	xcopy /y /q /u %DIR%\certificates\* %TARGET_PATH%
	echo End Patch
)
