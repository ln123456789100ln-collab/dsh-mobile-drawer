Option Explicit
Dim shell, files, folder, node, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
folder = files.GetParentFolderName(WScript.ScriptFullName)
node = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not files.FileExists(node) Then
  MsgBox "Node.js was not found. Please keep the existing Node.js installation.", 48, "DeepSeek Remote"
  WScript.Quit 1
End If
command = Chr(34) & node & Chr(34) & " " & Chr(34) & folder & "\one-click.mjs" & Chr(34)
shell.Run command, 0, False
