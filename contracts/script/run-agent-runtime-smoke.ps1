$ErrorActionPreference = "Stop"

$foundry = Join-Path $env:LOCALAPPDATA "Mandate\foundry\v1.8.1"
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
$env:MANDATE_LOCAL_RPC_URL = $rpcUrl
$env:MANDATE_LOCAL_CHAIN_ID = "31337"

Push-Location (Join-Path $PSScriptRoot "..")
try {
    & $forge script script/DeployLocal.s.sol --broadcast --rpc-url $rpcUrl
    if ($LASTEXITCODE -ne 0) { throw "local deployment failed" }
    $deployment = Get-Content "broadcast/local-deployment.json" | ConvertFrom-Json
    $env:MANDATE_LOCAL_APP = $deployment.app
    & $forge script script/PrepareLocalAgentRuntime.s.sol --broadcast --rpc-url $rpcUrl
    if ($LASTEXITCODE -ne 0) { throw "local strategy preparation failed" }
}
finally {
    Pop-Location
}

Push-Location (Join-Path $PSScriptRoot "..\..")
try {
    pnpm --filter @mandate/agent smoke:local
    if ($LASTEXITCODE -ne 0) { throw "agent runtime smoke failed" }
}
finally {
    Pop-Location
}
