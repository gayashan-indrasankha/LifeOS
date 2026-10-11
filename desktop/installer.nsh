!include "LogicLib.nsh"

!macro customInstall
  ; Electron's sandboxed Windows processes must be able to read the installed app.
  ; Limit these read-only grants to LifeOS files, never the user's data directory.
  DetailPrint "Setting permissions for LifeOS sandboxed processes"
  nsExec::ExecToStack '"$SYSDIR\icacls.exe" "$INSTDIR" /grant:r "*S-1-15-2-1:(OI)(CI)(RX)" "*S-1-15-2-2:(OI)(CI)(RX)" /Q'
  Pop $0
  Pop $1
  ${If} $0 != "0"
    MessageBox MB_ICONSTOP|MB_OK "LifeOS could not set read access for its application files. Setup cannot complete."
    Abort
  ${EndIf}
!macroend
