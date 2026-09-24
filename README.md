# EdMaker Homelab

Laboratório pessoal de infraestrutura, automação, observabilidade e aplicações.

## Objetivos

- Gerenciar infraestrutura com Infrastructure as Code.
- Automatizar a configuração de hosts e VMs.
- Executar workloads pessoais e de laboratório com Docker Compose.
- Centralizar inventário, health checks e observabilidade.
- Manter documentação e troubleshooting reproduzíveis.
- Utilizar o ambiente como laboratório prático para estudos de infraestrutura, automação, containers e aplicações.

## Arquitetura atual

```text
PVE-01
└── Proxmox VE
```

O host físico permanece dedicado ao papel de hypervisor e aos componentes necessários para sua própria operação, segurança e monitoramento.

## Próxima camada planejada

```text
PVE-01
└── lab-docker-01
    ├── Debian
    ├── Docker Engine
    ├── Docker Compose
    ├── PostgreSQL
    └── n8n
```

A VM `lab-docker-01` será o primeiro host de workloads do homelab.

Inicialmente, o ambiente será baseado em Docker Compose em vez de Kubernetes, priorizando o melhor uso dos recursos disponíveis no hardware atual.

## Estrutura do repositório

```text
homelab/
├── .agents/
├── .gitignore
├── README.md
├── skills-lock.json
│
├── docs/
│
├── infra/
│   ├── ansible/
│   └── terraform/
│       └── proxmox/
│
├── observability/
│   └── homelab-dashboard/
│       ├── collectors/
│       │   ├── common/
│       │   ├── docker-host/
│       │   └── proxmox/
│       ├── examples/
│       ├── frontend/
│       ├── schemas/
│       └── systemd/
│
└── stacks/
    └── n8n/
```

## Responsabilidade das camadas

### `infra/terraform`

Responsável pelo provisionamento da infraestrutura.

Exemplos:

- criação de VMs no Proxmox;
- definição de CPU, memória e disco;
- configuração de interfaces de rede;
- integração futura com cloud-init;
- outputs utilizados por outras etapas da automação.

Terraform ou OpenTofu devem cuidar da infraestrutura, não da configuração interna dos sistemas operacionais.

### `infra/ansible`

Responsável pela configuração dos sistemas operacionais e serviços base.

Exemplos:

- configuração comum de hosts Linux;
- hardening;
- usuários administrativos;
- instalação do Docker Engine;
- instalação do Docker Compose Plugin;
- estrutura de diretórios;
- instalação futura dos collectors de monitoramento.

Sempre que possível, os inventories devem utilizar os aliases já definidos no `~/.ssh/config`, evitando duplicar IP, usuário e chave SSH dentro do repositório.

### `observability/homelab-dashboard`

Dashboard customizado do homelab.

Seu objetivo é centralizar informações de:

- inventário;
- estado operacional;
- configuração;
- compliance;
- health checks;
- segurança;
- armazenamento;
- rede;
- serviços.

A arquitetura será preparada para diferentes tipos de hosts.

```text
collectors/
├── common/
├── proxmox/
└── docker-host/
```

Os dados serão divididos conceitualmente em:

```text
inventory.json
status.json
state.json
```

`inventory.json` conterá dados relativamente estáticos.

`status.json` conterá telemetria e estado atualizado periodicamente.

`state.json` será utilizado internamente para controle de mudanças e alertas quando necessário.

Dados de runtime não devem ser versionados no Git.

### `stacks`

Contém workloads declarados com Docker Compose.

Cada aplicação deverá possuir sua própria pasta.

Exemplo futuro:

```text
stacks/
├── n8n/
├── app-pessoal-01/
└── lab/
```

A primeira stack será o n8n Community Edition.

A arquitetura inicial prevista para o n8n é:

```text
n8n
├── PostgreSQL
└── Task Runners
    ├── JavaScript
    └── Python
```

O runner Python será preparado para receber dependências adicionais conforme os projetos de estudo exigirem, especialmente bibliotecas utilizadas em pipelines e processamento de dados.

## PostgreSQL

O homelab utilizará inicialmente uma única instância PostgreSQL para aplicações que utilizem esse banco.

O isolamento será realizado logicamente por banco de dados e usuário.

Exemplo:

```text
PostgreSQL
├── database: n8n
│   └── user: n8n
├── database: app_pessoal_01
│   └── user: app_pessoal_01
└── database: app_pessoal_02
    └── user: app_pessoal_02
```

Isso reduz consumo de recursos sem misturar credenciais e permissões entre aplicações.

## Princípios do projeto

- O Proxmox permanece limpo e dedicado ao papel de hypervisor.
- Terraform/OpenTofu gerencia infraestrutura.
- Ansible gerencia configuração dos sistemas operacionais.
- Docker Compose gerencia workloads.
- Configurações devem ser reproduzíveis.
- Mudanças manuais devem ser reduzidas sempre que possível.
- Secrets nunca devem ser versionados em texto puro.
- Arquivos `.env` reais não devem ser versionados.
- `terraform.tfstate` não deve ser versionado.
- `.terraform.lock.hcl` deve ser versionado.
- Arquivos `*.tfvars` reais não devem ser versionados.
- Arquivos de exemplo podem ser versionados.
- Dados de runtime e telemetria não devem ser armazenados no Git.
- O laboratório pode utilizar componentes temporários e descartáveis para estudo.
- O ambiente não tem objetivo de produção.
- Decisões devem priorizar aprendizado, segurança, estabilidade e uso consciente dos recursos disponíveis.

## Estado atual

O host `PVE-01` já possui:

- Proxmox VE configurado;
- rede e bridge configuradas;
- hardening SSH;
- usuário administrativo;
- autenticação TFA no Proxmox;
- firewall ativo;
- journald persistente;
- notificações SMTP;
- SMART monitorado;
- health check customizado;
- reboot unattended validado com workaround para o reboot watchdog.

A próxima etapa do projeto será estruturar a camada de observabilidade no repositório e, em seguida, iniciar o provisionamento da VM `lab-docker-01` com Infrastructure as Code.