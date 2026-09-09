$ErrorActionPreference = "Stop"

$foundry = Join-Path $env:LOCALAPPDATA "Mandate\foundry\v1.8.1"
$anvil = Join-Path $foundry "anvil.exe"
$cast = Join-Path $foundry "cast.exe"
$forge = Join-Path $foundry "forge.exe"
$rpcUrl = "http://127.0.0.1:8545"
$mnemonic = "test test test test test test test test test test test junk"

$ownerKey = (& $cast wallet private-key $mnemonic 0).Trim()
$agentKey = (& $cast wallet private-key $mnemonic 1).Trim()
$agentAddress = (& $cast wallet address --private-key $agentKey).Trim()
$env:LOCAL_DEPLOYER_PRIVATE_KEY = $ownerKey
$env:LOCAL_OWNER_PRIVATE_KEY = $ownerKey
$env:LOCAL_AGENT_PRIVATE_KEY = $agentKey
$env:LOCAL_AGENT_ADDRESS = $agentAddress

$anvilArguments = "--port 8545 --chain-id 31337 --mnemonic `"$mnemonic`""
$anvilProcess = Start-Process -FilePath $anvil -ArgumentList $anvilArguments -PassThru -NoNewWindow
try {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        & $cast block-number --rpc-url $rpcUrl
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Milliseconds 250
    }
    if ($LASTEXITCODE -ne 0) { throw "Anvil did not become ready" }

    Push-Location (Join-Path $PSScriptRoot "..")
    try {
        & $forge script script/DeployLocal.s.sol --rpc-url $rpcUrl
        & $forge script script/DeployLocal.s.sol --broadcast --rpc-url $rpcUrl
        & $forge script script/SetupLocalStrategy.s.sol --rpc-url $rpcUrl
        & $forge script script/SetupLocalStrategy.s.sol --broadcast --rpc-url $rpcUrl
    }
    finally {
        Pop-Location
    }
}
finally {
    if (!$anvilProcess.HasExited) { Stop-Process -Id $anvilProcess.Id }
}
