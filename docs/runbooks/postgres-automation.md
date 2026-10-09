# PostgreSQL automation para workflows

| Banco / role | Finalidade |
|---|---|
| `n8n` / `n8n_app` | Estado interno da plataforma n8n |
| `rag` / `rag_app` | RAG, embeddings e pgvector |
| `automation` / `automation_app` | Dados de negócio, integrações, testes e projetos dos workflows |

`automation_app` tem LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION e NOBYPASSRLS. É owner de `automation` e do schema inicial `specialist`. Nenhum outro schema de projeto é provisionado; o `public` padrão não é removido. Usar `specialist.tabela` explicitamente: o search_path não é alterado.

## Secrets

`automation_db_password` foi adicionada ao SOPS existente `secrets/n8n.sops.yaml`, como senha de 64 caracteres hexadecimais gerada em memória e salva somente criptografada. Nenhum valor é exibido ou versionado em plaintext. A chave AGE permanece na controladora.

A role usa `community.sops`, `no_log: true` e envia somente a senha necessária via stdin JSON ao provisionador, nunca por argumento de processo. Conecta como `postgres` via socket interno de `docker compose exec -T postgres`, sem passwords de n8n/rag e sem publicar porta.

Para instalações novas, `AUTOMATION_DB_PASSWORD` é entregue apenas em `/etc/homelab/n8n/postgres.env`, root:root 0600. **Não é adicionada ao ambiente do n8n ou dos runners.** Para instalações existentes, não precisa entrar no env do PostgreSQL em execução: a migration recebe a senha diretamente por stdin.

## Migration do ambiente existente

Pré-requisitos: Docker/Compose, Python 3 e flock na VM; PostgreSQL em execução com acesso local administrativo; SOPS/AGE na controladora.

```bash
# Controladora: configurar o caminho da chave AGE quando necessário.
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
cd infra/ansible
ansible-playbook playbooks/postgres-automation.yml --syntax-check
ansible-playbook playbooks/postgres-automation.yml --check --diff
ansible-playbook playbooks/postgres-automation.yml
# Segunda aplicação deve reportar changed=0:
ansible-playbook playbooks/postgres-automation.yml
```

Check mode valida SOPS e simula arquivos; **não executa SQL**, pois o provisionador pode ainda não estar instalado. A convergência do banco é verificada na aplicação real.

A role `postgres_automation` instala o provisionador root-only e executa sob flock. Não usa `compose up`, não reinicia containers, não altera PGDATA diretamente e não reexecuta os init scripts de n8n/rag.

O provisionador consulta a role, atributos, ownership do banco/schema e verificador SCRAM da senha. Cria objetos ausentes; corrige apenas atributos/owners divergentes; modifica a senha somente se não corresponder ao SOPS. Reexecuções convergidas não geram novo hash nem ALTER. A comparação SCRAM-SHA-256 usa o formato ASCII/hex exigido; verificadores de outros formatos são substituídos por SCRAM.

Não há DROP, TRUNCATE ou recriação de objetos. Dados existentes em automation permanecem. A migration não escreve em n8n ou rag. Em falha parcial, corrigir a causa e repetir: objetos já criados são reaproveitados. O flock serializa o provisionador no host; coordenar separadamente mudanças administrativas concorrentes.

A sessão administrativa desativa logging/amostragem de statements antes de enviar verificadores. Erros SQL são suprimidos pelo provisionador e tarefas sensíveis usam no_log. Não imprimir stdin ou habilitar xtrace durante diagnóstico.

## Instalação nova

```bash
# Controladora, infra/ansible:
ansible-playbook playbooks/n8n.yml
# VM, após configurar a stack e sua rede external:
cd /opt/homelab/stacks/n8n
sudo docker compose up -d postgres
```

Com PGDATA vazio, `001-bootstrap-databases.sh` continua criando n8n/rag, `002-enable-vector.sh` habilita pgvector em rag e `003-automation.sh` cria automation/automation_app/specialist. A migration posterior deve encontrar o mesmo estado sem mudanças.

**PGDATA já inicializado não executa init scripts como migration.** Usar o playbook dedicado. Nunca apagar PGDATA nem reexecutar todos os scripts init contra o cluster existente para criar automation.

## Credential no n8n

Cadastrar posteriormente uma Credential PostgreSQL no editor:

- Host: `postgres`, pela rede Docker database existente.
- Port: `5432`, sem publicação no host.
- Database: `automation`.
- User: `automation_app`.
- Password: valor recuperado por procedimento seguro do SOPS, sem colar no terminal ou código do workflow.

Esta implementação não cria Credentials via API nem altera o banco interno do n8n. Ao rotacionar a senha via SOPS e reaplicar a migration, atualizar também a Credential no editor.

## Verificação sem secrets

Na VM:

```bash
cd /opt/homelab/stacks/n8n
sudo docker compose exec -T postgres psql -X -U postgres -d postgres -c "SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname='automation_app';"
sudo docker compose exec -T postgres psql -X -U postgres -d postgres -c "SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname='automation';"
sudo docker compose exec -T postgres psql -X -U postgres -d automation -c "SELECT nspname, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='specialist';"
```

**Backup:** n8n_backup atualmente faz dumps explícitos somente de n8n e rag. Automation ainda não é coberto por dump/restore-test; globals sozinho não protege seus dados. Ampliar essa cobertura será uma mudança separada antes de depender de dados irrecuperáveis nesse banco.

## Testes

`tests/test_integration.py` da role usa containers pgvector descartáveis com network none, sem portas/mounts de produção. Verifica criação, simulação sem escrita, reexecução sem mudanças, correção de atributos/ownership, rotação, preservação de dados e convergência entre bootstrap e migration.

Em Linux com Docker autorizado e a imagem disponível:

```bash
sudo python3 -m unittest discover -s infra/ansible/roles/postgres_automation/tests -v
```
