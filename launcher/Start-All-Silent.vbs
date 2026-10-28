Option Explicit
Dim shell, files, folder, node, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
folder = files.GetParentFolderName(WScript.ScriptFullName)
node = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not files.FileExists(node) Then
  WScript.Quit 1
End If
' Start hidden and do not open a browser at login. The control page is still
' available from the desktop shortcut when it is needed.
shell.Environment("PROCESS")("DSH_LAUNCHER_NO_BROWSER") = "1"
command = Chr(34) & node & Chr(34) & " " & Chr(34) & folder & "\one-click.mjs" & Chr(34)
shell.Run command, 0, False
