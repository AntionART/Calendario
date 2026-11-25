; Red de seguridad para preservar datos del calendario (db/, uploads/)
; ante una reinstalacion/actualizacion. El mecanismo principal es que estos
; archivos nunca se incluyen en el paquete (ver build/stage.js); estas macros
; son una segunda capa de proteccion por si una actualizacion diferencial
; llegara a limpiar la carpeta de instalacion antes de extraer.

!macro customInit
  StrCpy $0 "$INSTDIR\resources\app-server"
  ${IfNot} ${FileExists} "$PLUGINSDIR\preserved-data"
    CreateDirectory "$PLUGINSDIR\preserved-data"
  ${EndIf}
  ${If} ${FileExists} "$0\db\calendario.db"
    CreateDirectory "$PLUGINSDIR\preserved-data\db"
    CopyFiles /SILENT "$0\db\*.*" "$PLUGINSDIR\preserved-data\db"
  ${EndIf}
  ${If} ${FileExists} "$0\uploads\*.*"
    CreateDirectory "$PLUGINSDIR\preserved-data\uploads"
    CopyFiles /SILENT "$0\uploads\*.*" "$PLUGINSDIR\preserved-data\uploads"
  ${EndIf}
!macroend

!macro customInstall
  StrCpy $0 "$INSTDIR\resources\app-server"
  ${If} ${FileExists} "$PLUGINSDIR\preserved-data\db\calendario.db"
    ${IfNot} ${FileExists} "$0\db\calendario.db"
      CreateDirectory "$0\db"
      CopyFiles /SILENT "$PLUGINSDIR\preserved-data\db\*.*" "$0\db"
    ${EndIf}
  ${EndIf}
  ${If} ${FileExists} "$PLUGINSDIR\preserved-data\uploads\*.*"
    CreateDirectory "$0\uploads"
    CopyFiles /SILENT "$PLUGINSDIR\preserved-data\uploads\*.*" "$0\uploads"
  ${EndIf}
!macroend

!macro customUnInstall
  MessageBox MB_YESNO "¿Desea eliminar tambien los datos del calendario (base de datos y adjuntos)? Esta accion no se puede deshacer." IDYES un_deleteData IDNO un_keepData
  un_deleteData:
    RMDir /r "$INSTDIR\resources\app-server\db"
    RMDir /r "$INSTDIR\resources\app-server\uploads"
    RMDir /r "$LOCALAPPDATA\CalendarioNeurocoop"
    Goto un_done
  un_keepData:
  un_done:
!macroend
