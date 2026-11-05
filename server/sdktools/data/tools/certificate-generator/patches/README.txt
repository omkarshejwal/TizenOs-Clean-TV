#How to patch?
 Go to $SDK_PATH/tools/certificate-generator/patches in shell or commandline, run

  ./patch.sh $PRIVILEGE_LEVEL ($SDK_PATH)    (for Linux or Mac)
  patch.bat $PRIVILEGE_LEVEL ($SDK_PATH)    (for Windows)

  - PRIVILEGE_LEVEL: public, partner
  
  The patch try to install certificates in default SDK path if $SDK_PATH is not input.

 EX)
 ./patch.sh partner
 patch.bat public c:\tizen-sdk
