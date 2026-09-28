# Telemetria da VPS de teste

Este agente é exclusivo da VPS do ambiente **Gestão Licita TESTE**. Ele fornece CPU, núcleos/modelo, RAM, swap, disco, uptime, load average, rede, processos, containers e estado de Docker/Caddy/PostgreSQL para a MW TECH Control.

## Instalação na VPS

Copie `mw-health.py` para `/opt/mw-health/mw-health.py` e execute com Python 3. Use um token forte em `MW_HEALTH_TOKEN`.

Exemplo de variáveis esperadas pela MW TECH Control na Vercel:

- `VPS_TEST_HEALTH_URL=http://179.197.76.18:9108/health`
- `VPS_TEST_HEALTH_TOKEN=<o mesmo token configurado no servidor>`

Não coloque o token no GitHub.
