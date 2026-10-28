Option Explicit
Dim shell, files, app, folder, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
app = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\DeepSeek Harness\DeepSeek Harness.exe"
folder = files.GetParentFolderName(WScript.ScriptFullName)
If Not files.FileExists(app) Then
  MsgBox "DeepSeek Harness was not found. Please install it first, then open this launcher again.", 48, "DSH Remote Launcher"
  WScript.Quit 1
End If
shell.Environment("PROCESS")("ELECTRON_RUN_AS_NODE") = "1"
command = Chr(34) & app & Chr(34) & " --expose-internals " & Chr(34) & folder & "\main.mjs" & Chr(34)
shell.Run command, 0, False
