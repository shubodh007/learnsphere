LiteLLM + OpenRouter setup for Anthropic-compatible clients

This repo now includes a ready LiteLLM proxy config and PowerShell helpers.

Files added
- config.yaml
- scripts/litellm-set-openrouter-key.ps1
- scripts/litellm-start.ps1
- scripts/litellm-client-env.ps1
- scripts/litellm-test.ps1

1) Install LiteLLM in the workspace venv
- Recommended runtime: Python 3.11 in `./.litellm311b-venv`.
- If needed again:
  C:\Users\shubodh\AppData\Local\Programs\Python\Python311\python.exe -m venv .\.litellm311b-venv
  .\.litellm311b-venv\Scripts\python.exe -m pip install -U pip
  .\.litellm311b-venv\Scripts\python.exe -m pip install -U "litellm[proxy]==1.74.9" websockets

2) Set your OpenRouter key
- Current shell only:
  powershell -ExecutionPolicy Bypass -File .\scripts\litellm-set-openrouter-key.ps1 -CurrentShellOnly
- Persist for user profile:
  powershell -ExecutionPolicy Bypass -File .\scripts\litellm-set-openrouter-key.ps1
- If not set in shell, `litellm-start.ps1` auto-loads `OPENROUTER_API_KEY` from `.env` then `.env.example`.

3) Start LiteLLM proxy on port 4000
- Normal:
  powershell -ExecutionPolicy Bypass -File .\scripts\litellm-start.ps1 -Port 4000
- With debug logs:
  powershell -ExecutionPolicy Bypass -File .\scripts\litellm-start.ps1 -Port 4000 -Debug

`litellm-start.ps1` now:
- prefers `./.litellm311b-venv` first
- falls back to other local venvs if needed
- launches via `python -m litellm.proxy.proxy_cli`
- sets `LITELLM_LOCAL_MODEL_COST_MAP=True` (avoids startup stalls when external model map fetch is slow)

4) In another shell, point Anthropic-style clients at local proxy
  powershell -ExecutionPolicy Bypass -File .\scripts\litellm-client-env.ps1 -Port 4000

This sets:
- ANTHROPIC_BASE_URL=http://localhost:4000
- ANTHROPIC_API_KEY=sk-localproxy

5) Test proxy directly
  powershell -ExecutionPolicy Bypass -File .\scripts\litellm-test.ps1 -BaseUrl http://localhost:4000 -ApiKey sk-localproxy -HealthOnly
  powershell -ExecutionPolicy Bypass -File .\scripts\litellm-test.ps1 -BaseUrl http://localhost:4000 -ApiKey sk-localproxy -Model claude-code

Model aliases in config.yaml
- sonnet-4.6 / claude-sonnet-4.6 -> openrouter/openai/gpt-oss-20b:free (coding)
- opus-4.6 / claude-opus-4.6 -> openrouter/qwen/qwen3.6-plus:free (reasoning)
- haiku-4.5 / claude-haiku-4.5 -> openrouter/minimax/minimax-m2.5:free (all-rounder)
- fast-free -> openrouter/liquid/lfm-2.5-1.2b-instruct:free
- smart-free -> openrouter/minimax/minimax-m2.5:free
- reasoning-free -> openrouter/qwen/qwen3.6-plus:free

Notes
- OpenRouter model IDs change over time. Update config.yaml if any alias returns invalid model errors.
- Keep OPENROUTER_API_KEY in environment variables only. Do not hardcode it in files.
- If chat test fails with OpenRouter 401, your proxy is up but your `OPENROUTER_API_KEY` is invalid/missing in that shell.
