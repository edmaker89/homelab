# Homelab Dashboard

Frontend estático para descobrir hosts, inspecionar identidade e saúde e navegar pelos guests de um Proxmox. HTML, CSS e módulos ES, sem framework, build, CDN ou dependências de runtime.

## Execução local

`fetch()` exige HTTP: não abra `index.html` por `file://`.

```bash
cd observability/homelab-dashboard
python3 frontend/serve.py
```

Abra **http://localhost:8080/**. O servidor de desenvolvimento, limitado ao loopback, redireciona para `/frontend/` e serve as fixtures em `/examples/`. Não acessa hosts ou caminhos de runtime Linux.

Alternativa usando apenas o servidor padrão:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Nesse caso, abra **http://localhost:8080/frontend/** (a raiz mostra a listagem de diretórios).

## Arquitetura e arquivos

```text
frontend/
  index.html          shell semântico e navegação
  styles.css          layout responsivo e estados visuais
  app.js              overview, host, guest e rotas hash
  data-provider.js    descoberta e carregamento independente dos arquivos
  formatters.js       unidades, valores ausentes, timestamps e freshness
  serve.py            servidor HTTP de desenvolvimento
  tests/
    data.test.mjs     contratos de carregamento e formatação
    browser.py        navegação, responsividade e falhas HTTP/JSON
examples/
  data/nodes.json      índice de demonstração principal
  data/nodes/pve-01/   inventory.json, status.json e guests.json
  scenarios/          hosts fictícios para WARNING, CRITICAL e dados parciais
schemas/              contratos existentes; não alterados
collectors/           produtores existentes; não alterados
```

O índice usa `schema_version: 1`, `generated_at` e `nodes`, com `id`, `role` e `data_path` por entrada. IDs devem ser únicos, com letras, números, `_` ou `-`. O caminho de cada nó é relativo ao **índice**, na mesma origem HTTP. O campo opcional `example: true` identifica demonstrações e exibe um aviso persistente na interface. O índice não duplica inventário ou telemetria.

Para usar outro índice publicado:

```text
/frontend/?index=/data/nodes.json
```

Os arquivos são carregados em paralelo, com timeout de dez segundos por requisição, sem cache. O botão **Atualizar dados** repete a leitura. A idade exibida se atualiza a cada 30 segundos; não há polling de telemetria.

Rotas: `#/`, `#/hosts/<id>` e `#/hosts/<id>/guests/<vmid>`. Voltar/avançar do navegador funciona sem configuração especial de servidor. Adicionar outro PVE, Linux ou futuro host Docker exige uma entrada no índice e seus arquivos; nenhum hostname está fixado na lógica. A tela de guest exibe os campos disponíveis, sem inventar containers ou aplicações internas.

## Contratos e limites conhecidos

- `inventory.json`: identidade, hardware, rede e plataformas relativamente estáveis.
- `status.json`: saúde, recursos, segurança e serviços no instante de `generated_at`.
- `guests.json`: resumo e guests de um nó. Lista vazia é válida. Arquivo ausente é distinto de zero guests; a seção só existe quando o documento está disponível.
- `state.json`, quando usado pelos collectors, não é um contrato consumido pelo frontend.

O provider confere objeto raiz e versão 1; valida a estrutura do índice. Não implementa um validador JSON Schema completo no browser. Campos ausentes têm fallback; arquivos ausentes, JSON inválido, falhas HTTP e timeout geram mensagens contextuais. Falha de status resulta em `UNKNOWN`, sem descartar inventário.

**Lacuna existente:** o schema de status permite objetos livres para load, memory, swap, filesystem, inodes, thermal, SMART, thresholds e plataforma. O adapter repassa o conteúdo do healthcheck, cujo contrato interno não está neste repositório. Portanto, a validação do schema não comprova compatibilidade desses campos com a telemetria real.

As fixtures usam as seguintes convenções de apresentação, ainda a confirmar com uma amostra sanitizada do produtor:

| Objeto | Campos usados nas métricas |
| --- | --- |
| `resources.load` | `load1`, `load5`, `load15` |
| `resources.memory` | `total_bytes`, `used_bytes`, `available_bytes`, `used_percent`, `available_percent` |
| `resources.swap` | `total_bytes`, `used_bytes`, `used_percent` |
| `storage.root_filesystem` | `mountpoint`, `total_bytes`, `used_bytes`, `used_percent` |
| `storage.root_inodes` | `used_percent` |
| `thermal` | `cpu_package_celsius` |
| `hardware_health.smart` | objeto por dispositivo com `status`, `temperature_celsius` |
| `platform.proxmox.storage` | objeto por storage com `status` |

Campos desconhecidos continuam visíveis nas listas de detalhes e em “Campos de recursos recebidos”. Sufixos `_bytes`, `_percent` e `_celsius` têm formatação reutilizável. Campos de thresholds são mostrados como recebidos, sem recalcular saúde. Não há inferência silenciosa de nomes alternativos.

O collector de inventário preenche `hardware.cpu.cores` com **cores por socket**; esse é o rótulo da interface. `logical_cpus` informa os threads totais. O inventário de rede não contém tipo de interface nem relação bridge/portas; a interface mostra todos os nomes e endereços, inclusive interfaces sem IPv4, mas não inventa essa topologia.

`health.status` é a fonte principal de saúde (`OK`, `WARNING`, `CRITICAL`, `UNKNOWN`). Dados acima de cinco minutos recebem aviso de possível desatualização, independente da saúde. Timestamp ausente ou no futuro também recebe aviso. **Stale não significa offline**: ainda não há heartbeat confiável.

## Fixtures

Todos os dados em `examples/` são exemplos estáticos de desenvolvimento, não telemetria runtime. A fixture principal usa os valores aproximados fornecidos para o host e contém **zero guests**. MACs e dados auxiliares são sintéticos. Datas permanecem fixas; é esperado que envelheçam e acionem o aviso de freshness.

Cenários adicionais, sem representar infraestrutura existente:

```text
http://localhost:8080/frontend/?index=../examples/scenarios/nodes.json
```

- `fixture-warning`: saúde WARNING, campos opcionais ausentes e um guest navegável.
- `fixture-critical`: saúde CRITICAL e plataformas nulas.
- `fixture-partial`: status propositalmente incompleto, para exercitar tolerância; este status não satisfaz todos os campos obrigatórios do schema.

**Nunca commitar telemetria runtime, credenciais ou cópias reais de `/var/lib/homelab-monitor/`.** Publicação e coleta automática não fazem parte desta versão.

## Verificações

A partir da raiz do repositório:

```bash
node --check observability/homelab-dashboard/frontend/app.js
node --check observability/homelab-dashboard/frontend/data-provider.js
node --check observability/homelab-dashboard/frontend/formatters.js
node --test observability/homelab-dashboard/frontend/tests/data.test.mjs
```

Node serve apenas para testes, não para executar o dashboard. Para o teste de navegador, use um ambiente Python com `playwright` e Chromium instalados (`python -m playwright install chromium`), mantenha o servidor na porta 8080 e execute:

```bash
python observability/homelab-dashboard/frontend/tests/browser.py
```

O teste verifica navegação host/guest/voltar, 375/768/1440 px, zero guests, campos opcionais ausentes, WARNING/CRITICAL/UNKNOWN, inventory/status/guests ausentes, JSON inválido, índice inválido e erros inesperados de console. Respostas 404 são esperadas nos cenários de arquivos ausentes. Screenshots ficam em `/tmp/homelab-*.png`.

Para revisão manual: navegue por Tab, abra um host e suas seções, use voltar, atualize os dados e abra os cenários adicionais. Confira badges textuais, unidades, estado vazio e avisos de freshness.

## Evolução

O índice e as rotas permitem múltiplos nós PVE, hosts Linux e futuros hosts Docker. A descoberta de aplicações, relações entre VM e host Docker e containers depende de novos contratos de dados. Não estão implementados autenticação, backend web, banco, SSH, sincronização de arquivos, provisionamento ou execução de Docker.
