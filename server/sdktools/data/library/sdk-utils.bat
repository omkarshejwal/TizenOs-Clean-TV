@ECHO OFF

goto :main

:readInfo
	set sdkInfoPath=%~dp0..\sdk.info
	set JDK_PATH=%~dp0..\jdk

	rem extracting the paths from sdk.info
	for /F "delims=" %%a in (!sdkInfoPath!) do (
		set paths=%%a
		for /f "tokens=1,2 delims==" %%b in ("!paths!") do (
	 		if %%b==TIZEN_SDK_DATA_PATH (
				set sdkDataPath=%%c
	 		)
	 		if %%b==JDK_PATH (
				set sdkInfoJDKPath=%%c
	 		)
	 		if %%b==TIZEN_SDK_INSTALLED_PATH (
				set sdkPath=%%c
	 		)
		)		
	)
	goto :eof


:setExecPath
	rem set the java exec path to be used
	rem update javaExec if JDK_PATH specified and exists in sdk.info
	if exist "%sdkInfoJDKPath%" (
		set JDK_PATH=%sdkInfoJDKPath%
	)
	if not exist "!JDK_PATH!" (
		set javaExec=java
	) else (
		set javaExec=!JDK_PATH!\bin\java
	)

	goto :eof


:main
setlocal enabledelayedexpansion
call :readInfo
call :setExecPath
:end

:: run sdk utils from input path..
"%javaExec%" -jar "%~dp0\sdk-utils-core.jar" %*


