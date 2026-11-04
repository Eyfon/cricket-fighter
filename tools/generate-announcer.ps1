# Run with Windows PowerShell 5.1 in STA mode, not pwsh 7:
# powershell.exe -NoProfile -STA -File tools/generate-announcer.ps1
param([string[]]$Keys = @())
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$audioDir = Join-Path $PSScriptRoot '../assets/audio/announcer'
New-Item -ItemType Directory -Force $audioDir | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft David Desktop')
$synth.Rate = 1
$synth.Volume = 100
$lines = @{ round='Round!'; one='One!'; two='Two!'; three='Three!'; fight='Fight!'; ko='K O!'; time='Time over!'; draw='Draw game!'; winner='You win!'; loser='You lose!'; p1win='Player one wins!'; p2win='Player two wins!'; ready='Get ready!' }
try {
  foreach ($entry in $lines.GetEnumerator()) {
    if ($Keys.Count -and $entry.Key -notin $Keys) { continue }
    $synth.SetOutputToWaveFile((Join-Path $audioDir ($entry.Key + '.wav')))
    if ($entry.Key -eq 'ko') {
      $synth.SpeakSsml('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><say-as interpret-as="characters">KO</say-as></speak>')
    } else { $synth.Speak($entry.Value) }
    $synth.SetOutputToNull()
    Write-Output $entry.Key
  }
} finally { $synth.Dispose() }
