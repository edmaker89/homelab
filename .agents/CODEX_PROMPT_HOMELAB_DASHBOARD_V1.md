# Prompt para Codex — Homelab Dashboard v1

Você está trabalhando no repositório local:

```text
/Users/douglassilva/dev/homelab
```

O objetivo é reconstruir o frontend do Homelab Dashboard, substituindo o protótipo antigo por uma interface preparada para crescer de um único Proxmox para múltiplos nós, VMs/LXCs e, futuramente, hosts Docker.

## 1. Antes de alterar qualquer arquivo

Leia e entenda:

```text
README.md
skills-lock.json
.agents/skills/frontend-design/SKILL.md
observability/homelab-dashboard/schemas/
observability/homelab-dashboard/collectors/
observability/homelab-dashboard/frontend/
```

Inspecione também os arquivos atuais do frontend antes de decidir o que reaproveitar.

O frontend anterior é descartável. Não preserve layout, CSS ou estrutura apenas por compatibilidade visual. Preserve somente algo que realmente seja útil.

## 2. Escopo desta tarefa

Trabalhe somente no frontend e em fixtures/examples necessários para desenvolvimento.

A princípio, não altere:

```text
observability/homelab-dashboard/collectors/
observability/homelab-dashboard/systemd/
observability/homelab-dashboard/schemas/
infra/
stacks/
```

Se descobrir que alguma alteração fora do frontend é realmente necessária, pare e explique antes de fazer.

Não implementar ainda:

- autenticação;
- backend web;
- banco de dados;
- Prometheus;
- Grafana;
- Beszel;
- integração SSH;
- cópia automática de arquivos dos hosts;
- provisionamento Terraform;
- Ansible;
- Docker.

Esta tarefa é apenas o frontend v1 e seu contrato de consumo de dados.

## 3. Contexto arquitetural

O dashboard deve responder progressivamente a três perguntas sobre cada host:

```text
1. Quem é esta máquina?
   -> inventory.json

2. Como esta máquina está agora?
   -> status.json

3. O que roda dentro dela?
   -> guests.json, quando o host for Proxmox
```

No PVE-01 esses arquivos já existem em runtime:

```text
/var/lib/homelab-monitor/
├── inventory.json
├── status.json
└── guests.json
```

O frontend NÃO deve depender desses caminhos Linux diretamente.

Ele deve consumir uma estrutura de dados web/publicável, preparada para múltiplos nós.

Conceito futuro:

```text
data/
├── nodes.json
└── nodes/
    ├── pve-01/
    │   ├── inventory.json
    │   ├── status.json
    │   └── guests.json
    ├── pve-02/
    │   ├── inventory.json
    │   ├── status.json
    │   └── guests.json
    └── lab-docker-01/
        ├── inventory.json
        └── status.json
```

Para esta primeira versão, crie fixtures de desenvolvimento dentro de uma pasta apropriada em:

```text
observability/homelab-dashboard/examples/
```

Não coloque dados de runtime dentro do Git.

## 4. Contratos existentes

Os contratos oficiais estão em:

```text
observability/homelab-dashboard/schemas/inventory.schema.json
observability/homelab-dashboard/schemas/status.schema.json
observability/homelab-dashboard/schemas/guests.schema.json
```

O frontend deve ser construído a partir deles.

Não invente nomes de campos quando os schemas já definem o dado.

### inventory.json

Responde "quem é esta máquina?".

Principais áreas:

```text
schema_version
generated_at

host
  hostname
  fqdn
  role
  os
  kernel
  architecture

hardware
  manufacturer
  product_name
  bios
  cpu
  memory
  disks

network
  default_gateway
  dns_servers
  interfaces

platform
  proxmox
  docker
```

O PVE-01 real atualmente é aproximadamente:

```text
hostname: pve-01
fqdn: pve-01.home.arpa
role: proxmox

OS:
Debian GNU/Linux 13 (trixie)

CPU:
Intel Core i3-6006U
1 socket
2 cores
2 threads/core
4 logical CPUs
VT-x

RAM física:
4009230336 bytes

Hardware:
LENOVO
product_name: 81FD

BIOS:
LENOVO
8RCN47WW
09/27/2018

Disco:
sda
P4-120
120034123776 bytes
SATA

Rede:
gateway 192.168.15.1
DNS 192.168.15.1
vmbr0 192.168.15.200/24

Proxmox:
pve-manager 9.2.18

Docker:
null
```

### status.json

Responde "como está esta máquina agora?".

Principais áreas:

```text
schema_version
generated_at

host
  hostname
  fqdn
  kernel
  architecture
  uptime_seconds

health
  status
  issue_count
  issues
  transitions

resources
  load
  memory
  swap

storage
  root_filesystem
  root_inodes

thermal

hardware_health
  smart

time_sync

services

system
  failed_units
  journal_usage

security
  firewall

monitoring
  thresholds

platform
  proxmox
  docker
```

Estado real recente do PVE-01:

```text
health: OK
issues: 0

memory available: ~60%
swap used: 0%

root filesystem used: 15%
root inodes used: 3%

SMART: PASSED
SSD temperature: ~35 C
CPU package: ~37-39 C

firewall: enabled/running
chrony: Normal
failed units: []

Proxmox storages:
local -> active
local-lvm -> active
```

### guests.json

Responde "o que roda dentro deste Proxmox?".

Formato:

```text
schema_version
generated_at
node

summary
  total
  running
  stopped
  qemu
  lxc

guests[]
```

Atualmente o PVE-01 não possui guests:

```json
{
  "summary": {
    "total": 0,
    "running": 0,
    "stopped": 0,
    "qemu": 0,
    "lxc": 0
  },
  "guests": []
}
```

Zero guests deve ser tratado como estado válido, não como erro.

## 5. Visão de produto

Não construir apenas "a página do PVE-01".

Construir um "Homelab Dashboard" hierárquico.

A experiência deve suportar:

```text
Homelab
  ↓
lista/visão geral dos hosts
  ↓
Host
  ↓
detalhes de identidade e saúde
  ↓
subsystems
  ↓
guests
  ↓
futuramente uma VM/host Docker e suas aplicações
```

Devemos poder adicionar depois:

```text
PVE-01
PVE-02
PVE-03
PBS-01
lab-docker-01
outros hosts Linux
```

sem reconstruir toda a interface.

## 6. Tela inicial — Homelab Overview

Criar uma tela inicial preparada para múltiplos hosts.

Cada host deve aparecer como um card ou bloco operacional contendo, quando disponível:

- nome;
- FQDN;
- role;
- health;
- quantidade de issues;
- plataforma;
- OS;
- CPU cores/threads;
- memória;
- filesystem principal;
- temperatura;
- uptime;
- quantidade de guests;
- timestamp da última atualização.

O card não deve tentar exibir todos os detalhes.

Objetivo:

> bater o olho e saber quais máquinas existem e quais precisam de atenção.

Health deve ser visualmente evidente:

```text
OK
WARNING
CRITICAL
UNKNOWN
```

Não depender somente de cor. Use também texto/ícone/indicador.

## 7. Tela de Host

Ao selecionar um host, mostrar progressivamente:

### Cabeçalho

- hostname;
- FQDN;
- role;
- health;
- issues;
- última atualização;
- uptime.

### Identidade

Responder claramente:

> "Que máquina é esta?"

Mostrar:

- fabricante;
- modelo;
- OS;
- kernel;
- arquitetura;
- plataforma;
- versão do Proxmox quando existir;
- CPU;
- sockets;
- cores;
- threads;
- RAM física;
- BIOS.

### Recursos

Mostrar:

- load 1m / 5m / 15m;
- CPUs lógicas;
- RAM disponível/usada;
- swap;
- root filesystem;
- inodes;
- temperaturas.

Evite gráficos decorativos sem valor.

Use barras/progress indicators quando forem realmente úteis.

### Storage

Mostrar:

- discos físicos do inventory;
- modelo;
- tamanho;
- transporte;
- SMART;
- temperatura do disco;
- filesystem `/`;
- PVE storages quando role=proxmox.

### Rede

Mostrar:

- interfaces;
- IPv4;
- MAC;
- gateway;
- DNS;
- bridge.

Não esconder interfaces sem IP; apenas trate-as visualmente como "sem endereço".

### Saúde e segurança

Mostrar:

- firewall;
- failed units;
- chrony/time sync;
- SMART;
- journal usage;
- serviços monitorados;
- thresholds relevantes.

Para serviços, usar uma lista compacta.

### Guests

Somente quando existir `guests.json`.

Mostrar resumo:

- total;
- running;
- stopped;
- QEMU;
- LXC.

Quando não houver guests, mostrar um empty state adequado:

```text
Nenhuma VM ou container configurado neste nó.
```

Não mostrar erro.

Quando futuramente houver guests, apresentar cada guest de forma navegável e pronta para evolução futura.

## 8. Navegação

A interface deve permitir algo conceitualmente equivalente a:

```text
Homelab / PVE-01
```

Ao adicionar guests:

```text
Homelab / PVE-01 / lab-docker-01
```

Nesta versão não é obrigatório criar uma tela completa de guest se não houver dados suficientes.

Mas a arquitetura do frontend não deve impedir isso.

## 9. Data layer

Separar renderização de acesso a dados.

Não espalhar `fetch()` aleatoriamente pelos componentes/funções.

Criar uma pequena camada de acesso a dados, por exemplo:

```text
data-provider.js
```

ou estrutura equivalente.

Ela deve conseguir carregar:

```text
nodes index
inventory
status
guests
```

O frontend deve lidar com:

- arquivo ausente;
- JSON inválido;
- dados parciais;
- status desatualizado;
- host offline futuramente;
- `platform.proxmox = null`;
- `platform.docker = null`;
- `guests = []`.

Não deixar a tela inteira quebrar por causa de um campo opcional.

## 10. nodes.json

Para desenvolvimento, defina um índice simples e extensível.

Pode ser algo semelhante a:

```json
{
  "schema_version": 1,
  "generated_at": "2026-09-24T20:00:00-03:00",
  "nodes": [
    {
      "id": "pve-01",
      "role": "proxmox",
      "data_path": "./nodes/pve-01"
    }
  ]
}
```

Não duplicar no índice todos os dados existentes em inventory/status.

O índice serve principalmente para descoberta dos nós.

Crie isso como fixture/example, não como telemetria real versionada.

## 11. Fixtures

Criar fixtures coerentes com os schemas.

Precisamos, no mínimo:

```text
examples/data/nodes.json
examples/data/nodes/pve-01/inventory.json
examples/data/nodes/pve-01/status.json
examples/data/nodes/pve-01/guests.json
```

Use os valores reais fornecidos acima como base, mas trate esses arquivos explicitamente como exemplos de desenvolvimento.

Pode criar também um segundo nó fictício apenas se isso ajudar a provar que a tela realmente suporta múltiplos hosts.

Se criar um segundo nó:

- deixar claro que é fixture;
- usar dados plausíveis;
- não confundir com infraestrutura real;
- não adicionar ao README como host existente.

## 12. Tecnologia

Preferir manter este frontend leve.

Se o projeto atual não tiver build system e não houver benefício claro em adicionar um framework, use:

- HTML;
- CSS;
- JavaScript moderno em módulos ES.

Evite introduzir React/Vite/Node/npm apenas para construir uma dashboard estática pequena.

Se decidir que um framework é realmente necessário, explique primeiro antes de adicionar dependências.

Não usar CDN obrigatório.

A aplicação deve funcionar em rede local e poder futuramente ser servida por um container HTTP simples.

## 13. Design visual

Use a skill de frontend disponível no repositório.

Queremos um visual:

- técnico;
- sóbrio;
- moderno;
- profissional;
- denso o suficiente para infraestrutura;
- legível;
- responsivo;
- sem parecer template genérico de admin;
- sem parecer clone do Grafana;
- sem excesso de gradientes, glow ou cyberpunk.

A dashboard deve transmitir:

```text
estado
hierarquia
confiança
operabilidade
```

e não apenas "design bonito".

Evite cards para absolutamente tudo.

Use hierarquia visual, grupos, tabelas compactas, barras e badges conforme cada informação.

## 14. Responsividade

O dashboard deve funcionar bem em:

- desktop;
- notebook;
- tablet;
- mobile.

No desktop, usar bem largura disponível.

No mobile, reorganizar sem causar tabelas horizontais impossíveis de ler.

## 15. Acessibilidade

Implementar:

- HTML semântico;
- foco visível;
- navegação por teclado;
- contraste adequado;
- labels;
- indicadores que não dependam somente de cor;
- `aria` quando apropriado.

## 16. Formatação de dados

Criar helpers reutilizáveis para:

- bytes -> GiB/MiB;
- uptime -> dias/horas/minutos;
- porcentagens;
- temperaturas;
- timestamps;
- load;
- valores ausentes.

Não espalhar conversões manuais por toda a aplicação.

Exemplos:

```text
4009230336 bytes -> 3.73 GiB
22746 seconds -> 6h 19m
0.04 CPU -> 4%
```

## 17. Freshness

O dashboard deve usar `generated_at` para mostrar idade dos dados.

Exemplo conceitual:

```text
Atualizado há 37 s
```

ou:

```text
Dados possivelmente desatualizados
```

Não inventar "offline" apenas porque o timestamp ficou velho.

Separar:

```text
stale data
```

de:

```text
host offline
```

pois ainda não temos um mecanismo confiável de heartbeat/offline.

## 18. Thresholds

O status contém thresholds de monitoramento.

Quando fizer sentido, use-os para explicar visualmente o estado.

Não recalcular `health.status` como verdade principal no frontend.

O backend/healthcheck é a fonte principal do health.

O frontend pode destacar métricas usando thresholds, mas não deve contradizer arbitrariamente o health recebido.

## 19. Estado de erro

Criar estados adequados para:

- falha ao carregar nodes.json;
- inventory ausente;
- status ausente;
- guests ausente;
- JSON inválido;
- host sem dados dinâmicos.

Não usar apenas `alert()`.

Mostrar erro contextual sem destruir toda a aplicação.

## 20. Estrutura sugerida

Você pode reorganizar `frontend/`, desde que mantenha simples.

Algo próximo de:

```text
frontend/
├── index.html
├── styles.css
├── app.js
├── data-provider.js
├── formatters.js
└── components/
```

Não siga isso mecanicamente se outra organização simples for melhor.

Evite criar dezenas de arquivos minúsculos.

## 21. Execução local

O README do dashboard deve explicar que `fetch()` exige servir os arquivos por HTTP, não abrir `index.html` diretamente por `file://`.

Para desenvolvimento, documentar algo simples como:

```bash
cd observability/homelab-dashboard
python3 -m http.server 8080
```

A aplicação deve então conseguir ser acessada em:

```text
http://localhost:8080/
```

Organize paths de forma que frontend e examples funcionem corretamente nesse modo.

## 22. README do dashboard

Atualize:

```text
observability/homelab-dashboard/README.md
```

Documente:

- objetivo;
- arquitetura;
- contratos;
- estrutura;
- execução local;
- fixtures;
- diferença entre inventory/status/guests;
- que runtime telemetry não deve ser commitada;
- evolução futura para múltiplos PVE e Docker hosts.

## 23. Qualidade

Antes de finalizar:

- validar JavaScript;
- verificar console do navegador;
- testar navegação;
- testar desktop/mobile;
- testar com zero guests;
- testar com campo opcional ausente;
- testar status WARNING/CRITICAL usando fixture;
- evitar erros silenciosos;
- evitar duplicação;
- não deixar TODOs desnecessários;
- não incluir secrets;
- não hardcodar PVE-01 dentro da lógica da aplicação.

`pve-01` pode existir somente nos fixtures de desenvolvimento.

## 24. Git

Não faça commit automaticamente.

Ao terminar:

1. mostre os arquivos criados/modificados;
2. resuma decisões de arquitetura;
3. informe como executar localmente;
4. informe como testar;
5. rode as verificações possíveis;
6. mostre `git diff --stat`;
7. mostre `git status --short`;
8. aguarde revisão antes do commit.

## 25. Critério de sucesso

Ao final eu devo conseguir abrir a dashboard e responder rapidamente:

```text
Quais hosts existem?
Qual deles está com problema?
Que máquina é o PVE-01?
Qual hardware ele possui?
Qual versão de Proxmox está rodando?
Como estão CPU/load, RAM, swap e storage?
Como estão temperaturas e SMART?
Firewall está ativo?
Chrony está sincronizado?
Há serviços com falha?
Quais storages do Proxmox estão ativos?
Existem VMs ou LXCs nesse nó?
Quando esses dados foram atualizados?
```

E a arquitetura deve estar pronta para futuramente responder:

```text
O que está rodando dentro da lab-docker-01?
Quais containers existem?
Como estão n8n e PostgreSQL?
Qual PVE hospeda determinada VM?
Como está o homelab inteiro?
```

sem reescrever o frontend do zero.

## 26. Forma de trabalho

Primeiro faça uma inspeção do repositório e apresente um plano curto.

Depois implemente.

Não altere os collectors que já estão funcionando apenas para facilitar o frontend.

Trate os schemas atuais como contratos do backend.

Se encontrar uma inconsistência real entre schema, fixture e frontend, reporte claramente em vez de mascará-la.
