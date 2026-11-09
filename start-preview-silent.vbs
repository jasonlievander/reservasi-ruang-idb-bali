Option Explicit
Dim shell, fso, file
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
file = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = file
shell.Run """" & file & "\start-preview-hidden.cmd""", 0, False
