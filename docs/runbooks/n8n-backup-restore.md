# Backup e recuperação do n8n

## Arquitetura e limites

`Compose PostgreSQL → pg_dumpall/pg_dump → staging privado → Restic → Cloudflare R2`

A role `infra/ansible/roles/n8n_backup` instala Restic pelo Debian e quatro comandos root em `/usr/local/sbin`. Não instala servidor PostgreSQL no host. Usa o PostgreSQL existente via `docker compose exec -T postgres`. Não copia PGDATA. Não usa rclone.

| Configuração | Valor |
|---|---|
| Bucket privado | `edmaker-homelab-backups` |
| Localização / classe | Eastern North America (ENAM) / Standard |
| Endpoint | `https://b27bd766e1ece5c9ce399d25e9c38101.r2.cloudflarestorage.com` |
| Região S3 | `auto` |
| Prefixo | `n8n/restic` |
| Restic repository | `s3:https://b27bd766e1ece5c9ce399d25e9c38101.r2.cloudflarestorage.com/edmaker-homelab-backups/n8n/restic` |
| Backup | 00:30 e 12:30, America/Sao_Paulo, atraso aleatório até 5 min |
| RPO alvo | aproximadamente 12h, condicionado a execuções bem-sucedidas |
| Manutenção | domingo 03:30, atraso até 5 min |
| Retenção | 7 daily, 4 weekly, 6 monthly |

Não habilitar acesso público, r2.dev, custom domain ou lifecycle no bucket. O token R2 deve ter **Object Read & Write**, restrito a esse bucket. A senha Restic cifra o repositório no cliente; credenciais R2 autorizam acesso ao armazenamento. São segredos diferentes e ambos precisam ser recuperáveis.

Cada execução produz `globals.sql` (sem hashes de senhas), `n8n.dump`, `rag.dump`, `SHA256SUMS` e `metadata.json`. Os dumps são custom format e validados por `pg_restore --list`. Metadata inclui UTC, hostname, versões reais PostgreSQL/n8n/pgvector, nomes dos bancos, hashes SHA256, nome lógico do repositório e versão do script.

Um único snapshot inclui staging e **todo `/srv/homelab/n8n/app`**, sem filtros ou exclusões: `config`, `.env`, arquivos PEM/KEY, `.ssh`, `secrets` e demais arquivos do app são protegidos integralmente pelo repository Restic criptografado. Não adicionar exclusões sem evidência técnica concreta de que o path é cache/transitório e dispensável para DR. `/etc/homelab`, PGDATA, imagens Docker e o repositório Git não são fontes deste backup.

Os dumps são consistentes **por banco**, não há transação global entre os dois bancos nem snapshot atômico do app vivo. Para arquivos binários e workflows que exigem consistência coordenada, usar janela de manutenção com produtores pausados; não prometer consistência transacional entre DB e filesystem. O backup normal não interrompe os serviços.

Staging `/var/backups/homelab/n8n/run-*`: diretório 0700, arquivos 0600. É removido tanto em sucesso quanto em erro; falha exige nova execução. Restos de backup com mais de um dia são removidos pela próxima execução sob lock. Planejar espaço para os dumps, cache Restic e restore-test. O restore-test baixa apenas o conjunto PostgreSQL, não valida funcionalmente os arquivos do app.

`flock` compartilhado aguarda até 300s e falha se outro backup/manutenção/restore/operação manual estiver em execução. Locks do Restic complementam o lock local. A manutenção filtra host lógico `lab-docker-01`, tag `homelab-n8n`, e usa `--group-by host,tags`: caminhos temporários não criam grupos separados. `forget --prune` só roda semanalmente; em seguida `restic check`. Check padrão valida estrutura; uma leitura integral exige `check --read-data` manual. Retenção seleciona períodos existentes, não garante um número fixo de snapshots ou snapshots em dias sem backup.

## Estratégia de globals.sql

A geração permanece `pg_dumpall -U postgres --globals-only --no-role-passwords`: preserva definições globais sem hashes de password. **SOPS continua sendo a source of truth das passwords das roles.** Backup normal e restore-test não carregam passwords dos usuários de aplicação.

No restore-test descartável, `globals.sql` é restaurado integralmente: o cluster temporário usa um superusuário distinto, permitindo validar as definições das roles do ambiente original sem atingir produção.

No DR padrão do ambiente real, o bootstrap PostgreSQL cria `n8n_app`/`rag_app` e define suas senhas via SOPS **antes do `pg_restore`**. Portanto, **não executar `globals.sql` cegamente em um cluster já bootstrapped**: as roles podem já existir, causando conflitos, e suas definições podem afetar outros consumidores.

`globals.sql` permanece disponível para recuperação seletiva de atributos/grants e para cenários de cluster totalmente vazio. Nesses cenários, revisar conflitos com a role administrativa criada pelo initdb antes de aplicar as definições. As passwords continuam sendo repostas via SOPS; não vêm de `globals.sql`.

## Contrato SOPS e instalação

O exemplo `secrets/n8n-backup.sops.example.yaml` contém somente chaves vazias. **Não é um arquivo criptografado utilizável.** O arquivo efetivo `secrets/n8n-backup.sops.yaml` deve ser criado pelo operador; a regra `.sops.yaml` existente já o cobre. Não inventamos credenciais nem uma senha de recuperação.

Na estação controladora, com SOPS/AGE e `community.sops` disponíveis:

```bash
ansible-galaxy collection install -r infra/ansible/collections/requirements.yml
sops secrets/n8n-backup.sops.yaml
```

No editor seguro do SOPS, preencher as três chaves: `restic_password` (senha aleatória forte, uma linha, pelo menos 20 caracteres), `r2_access_key_id`, `r2_secret_access_key`. Não usar `echo SECRET`, argumentos de processo, arquivos temporários dentro do Git ou `sops --decrypt` com saída no terminal. Confirmar que o arquivo salvo contém `ENC[...]` e metadata `sops`, sem mostrar valores descriptografados. Preservar senha Restic e chave AGE também no plano externo de recuperação.

O Ansible usa `community.sops.sops` na controladora e `no_log: true` no processamento dos valores. A VM recebe somente `/etc/homelab/n8n-backup/restic-password` e `r2.env`, root:root 0600; diretório root:root 0700. `RESTIC_PASSWORD_FILE` aponta para o primeiro; `r2.env` exporta AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION. Não se exporta RESTIC_PASSWORD.

Instalar com backup desativado, sem exigir secrets e sem inicializar repositório:

```bash
cd infra/ansible
ansible-playbook playbooks/n8n-backup.yml --syntax-check
ansible-playbook playbooks/n8n-backup.yml --check --diff -e '{"n8n_backup_enabled": false}'
ansible-playbook playbooks/n8n-backup.yml -e '{"n8n_backup_enabled": false}'
```

A desativação para os timers, mas não interrompe uma execução já iniciada e não apaga credenciais antigas. Em check mode, instalação é simulada e gestão de timers é omitida porque unidades novas ainda não existem; verificar estado real após aplicação.

## Ativação real, em ordem

1. Criar o arquivo SOPS acima e garantir recuperação externa dos secrets.
2. Implantar credenciais mantendo os timers parados:

   ```bash
   cd infra/ansible
   ansible-playbook playbooks/n8n-backup.yml -e '{"n8n_backup_enabled": true, "n8n_backup_timers_enabled": false}'
   ```

3. Na VM, listar snapshots. Se o repositório **ainda não existe**, inicializar explicitamente uma única vez. Erro de acesso ou senha não é motivo para recriar repositório:

   ```bash
   sudo homelab-n8n-restic snapshots
   # Somente no primeiro provisionamento, após confirmar que ainda não existe:
   sudo homelab-n8n-restic init
   sudo homelab-n8n-restic snapshots
   ```

4. Fazer primeiro backup e restore-test:

   ```bash
   sudo systemctl start homelab-n8n-backup.service
   sudo systemctl start homelab-n8n-restore-test.service
   sudo journalctl -u homelab-n8n-backup -u homelab-n8n-restore-test --since today
   ```

5. Na controladora, habilitar schedules:

   ```bash
   ansible-playbook playbooks/n8n-backup.yml -e '{"n8n_backup_enabled": true}'
   ```

O primeiro disparo pode ser imediato por `Persistent=true`. Até credenciais e init efetivos, a validação de upload, retenção R2 e restauração remota está **BLOCKED BY R2 CREDENTIALS / RESTIC REPOSITORY INITIALIZATION**.

## Operação e restore-test

Na VM:

```bash
sudo homelab-n8n-restic snapshots --host lab-docker-01 --tag homelab-n8n
sudo homelab-n8n-restic check
sudo homelab-n8n-restic check --read-data  # integral, mais tráfego/tempo
sudo systemctl list-timers 'homelab-n8n-*'
sudo systemctl status homelab-n8n-backup.timer homelab-n8n-backup-maintenance.timer
sudo journalctl -u homelab-n8n-backup.service -u homelab-n8n-backup-maintenance.service
sudo systemctl start homelab-n8n-restore-test.service  # latest
sudo homelab-n8n-restore-test SNAPSHOT_ID             # execução manual específica
sudo homelab-n8n-restic forget --host lab-docker-01 --tag homelab-n8n --group-by host,tags --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --dry-run
```

Restore-test fixa latest num ID do conjunto correto, restaura em staging temporário, verifica hashes (manifest + metadata), lista os archives e executa globals em cluster descartável com superusuário distinto. Restaura ownership/ACL dos dumps, verifica tabelas em n8n e conexão/extension vector em rag. Usa `pgvector/pgvector:0.8.6-pg17-trixie`, `--network none`, sem portas, sem bind mounts, volume temporário, CPU 0.5, RAM 256 MiB, memória+swap 512 MiB. Trust só existe no cluster sem rede. Nenhuma instrução usa Compose para restaurar ou parar serviços reais. Container e volume são removidos via trap, inclusive falhas e SIGTERM. Não há network Docker criado para remover.

SIGKILL, queda de energia ou daemon Docker indisponível podem impedir cleanup. Inspecionar recursos **rotulados** antes de remoção manual; jamais usar `docker system prune` como rotina:

```bash
sudo docker ps -a --filter label=homelab.n8n.restore-test=true
sudo docker volume ls --filter label=homelab.n8n.restore-test=true
sudo find /var/backups/homelab/n8n -maxdepth 1 -type d -name 'restore-*'
```

Remover apenas nomes identificados como restos de teste, sem nenhuma execução ativa. Journald registra snapshot ID e sucesso/falha, não variáveis de ambiente. Não usar `bash -x`, `env`, `docker inspect` completo ou imprimir arquivos de configuração secrets durante diagnóstico.

## Preparar recuperação manual

As seções seguintes são **procedimentos destrutivos de DR**, para execução humana em janela aprovada. Não são executadas pelo playbook ou restore-test. Antes de substituir qualquer banco, preservar o estado atual e validar o snapshot pelo restore-test. Não aplicar globals.sql ao PostgreSQL real indiscriminadamente: ele define roles globais e pode afetar outros consumidores.

Na VM, abrir shell root (`sudo -i`) sem xtrace. Escolher ID exato listado por snapshots e restaurar em staging, nunca diretamente em `/srv`:

```bash
umask 077
recovery=$(mktemp -d /var/backups/homelab/n8n/recovery-XXXXXXXX)
homelab-n8n-restic restore SNAPSHOT_ID --target "$recovery" --verify
find "$recovery" -type f -name SHA256SUMS
# Atribuir o caminho EXATO encontrado, sem adivinhar timestamp:
dumps="$recovery/var/backups/homelab/n8n/run-TIMESTAMP-SUFFIX"
(cd "$dumps" && sha256sum --check SHA256SUMS)
docker compose --project-directory /opt/homelab/stacks/n8n exec -T postgres pg_restore --list < "$dumps/n8n.dump" > /dev/null
docker compose --project-directory /opt/homelab/stacks/n8n exec -T postgres pg_restore --list < "$dumps/rag.dump" > /dev/null
cd /opt/homelab/stacks/n8n
systemctl stop homelab-n8n-backup.timer homelab-n8n-backup-maintenance.timer
# Aguardar término de qualquer operação antes de alterar dados.
exec 9>/run/lock/homelab-n8n-backup.lock
flock -w 300 9
# Se falhar, NÃO continuar. Manter este shell aberto durante toda recuperação.
```

Não continuar após erro de integridade. O shell de recuperação mantém o lock; não chamar `homelab-n8n-restic` de dentro dele após adquirir o lock. Ao terminar, `flock -u 9` e `exec 9>&-` liberam o lock antes de novos testes/backups. Manter timers de backup/manutenção parados durante recuperação e religar somente após validação. Pausar produtores externos relevantes, inclusive consumidores de rag.

## Recuperar somente n8n

Verificar disponibilidade da N8N_ENCRYPTION_KEY correspondente ao snapshot. Parar escritores e runners; preservar dump pré-restore. O comando `dropdb --force` encerra conexões e destrói o banco escolhido:

```bash
systemctl stop homelab-n8n-backup.timer homelab-n8n-backup-maintenance.timer
# Confirmar que nenhum service de backup/manutenção está em execução.
docker compose stop task-runners n8n
docker compose exec -T postgres pg_dump -U postgres -Fc n8n > "$recovery/pre-restore-n8n.dump"
docker compose exec -T postgres dropdb -U postgres --force n8n
docker compose exec -T postgres createdb -U postgres -O n8n_app n8n
docker compose exec -T postgres pg_restore -U postgres --exit-on-error -d n8n < "$dumps/n8n.dump"
docker compose up -d n8n
# Aguardar readiness antes de iniciar runners.
docker compose up -d task-runners
```

Se falhar, manter aplicação parada, investigar e repetir restauração num banco limpo ou recuperar o dump pré-restore. Não prosseguir com banco parcialmente restaurado.

## Recuperar somente rag

Pausar todos os produtores/consumidores de rag (incluindo workflows n8n que o usam). O banco n8n não é removido:

```bash
docker compose stop task-runners n8n
docker compose exec -T postgres pg_dump -U postgres -Fc rag > "$recovery/pre-restore-rag.dump"
docker compose exec -T postgres dropdb -U postgres --force rag
docker compose exec -T postgres createdb -U postgres -O rag_app rag
docker compose exec -T postgres pg_restore -U postgres --exit-on-error -d rag < "$dumps/rag.dump"
docker compose exec -T postgres psql -X -U postgres -d rag -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
docker compose up -d n8n
# Após readiness:
docker compose up -d task-runners
```

A imagem pgvector fornece a extensão; o archive restaura sua definição. Roles n8n_app/rag_app devem existir, provisionadas pelo bootstrap/SOPS, antes do restore.

## Recuperar dados do app

Usar o mesmo snapshot dos bancos sempre que necessário para coerência. Com n8n/runners parados, guardar o diretório atual e instalar o restaurado; nunca sobrescrever PGDATA:

```bash
docker compose stop task-runners n8n
mv /srv/homelab/n8n/app "$recovery/app-before-restore"
install -d -m 0700 -o 1000 -g 1000 /srv/homelab/n8n/app
cp -a "$recovery/srv/homelab/n8n/app/." /srv/homelab/n8n/app/
chown -R 1000:1000 /srv/homelab/n8n/app
```

O arquivo `config` faz parte do backup integral do app. Após restaurá-lo, conferir que sua encryption key corresponde à **mesma N8N_ENCRYPTION_KEY** fornecida via SOPS para esse snapshot. Validar permissões e dependências de custom nodes. Iniciar n8n, aguardar readiness e iniciar runners. Após sucesso e período de observação, apagar staging e cópias pré-restore conscientemente; não deixá-los crescer indefinidamente.

## Perda completa da VM

1. Recuperar repositório Git, acesso ao Proxmox, state/variáveis do OpenTofu e chaves externas. Executar `tofu plan` e `tofu apply` em `infra/terraform/proxmox` com state correto; não recriar recursos do PVE sem conferir o plano.
2. Ajustar alias SSH `lab-docker-01` e verificar a nova host key fora de banda.
3. Na controladora recuperar AGE pelo Bitwarden e tornar SOPS operacional. **Nunca copiar AGE private key para VM/PVE.** Isto precisa ocorrer antes do playbook n8n que descriptografa secrets.
4. Em `infra/ansible`, aplicar `playbooks/bootstrap.yml`, `playbooks/docker.yml`, `playbooks/n8n.yml`. A role n8n instala configuração; não iniciar app antes de recuperar dados.
5. Aplicar backup role habilitada com timers desativados. Conectar ao repositório existente com a senha original; **não executar init de novo**.
6. Iniciar **somente PostgreSQL** (`docker compose up -d postgres`), aguardar healthcheck. O bootstrap cria roles e bancos com senhas SOPS. Confirmar que a VM/PGDATA é a nova, nunca a antiga em produção.
7. Baixar snapshot em staging e validar checksums/archives. Restaurar n8n e rag conforme procedimentos, com app parado. Não executar globals cegamente; bootstrap repõe roles conhecidas e senhas. Roles adicionais presentes em globals precisam de revisão e recriação manual antes de restaurar objetos dependentes.
8. Restaurar app do mesmo snapshot, permissões 1000:1000; recuperar N8N_ENCRYPTION_KEY original via `secrets/n8n.sops.yaml`.
9. Iniciar n8n, verificar `/healthz/readiness`, iniciar task-runners. `docker compose ps` deve mostrar serviços saudáveis. Conferir logs sem expor secrets, login, workflows, descriptografia de credentials e extensão vector. Executar workflow de teste com JavaScript/Python.
10. Fazer novo backup e restore-test, reativar timers e acompanhar próxima execução.

**DB backup + N8N_ENCRYPTION_KEY preservada pelo SOPS + AGE private key recuperável = recuperação completa das credentials do n8n.** Perder a encryption key impede descriptografar credentials mesmo com banco íntegro. O plano externo da AGE private key é Bitwarden; ela não fica na VM, PVE ou Git. Validar acesso de emergência ao Bitwarden e recuperação da senha Restic periodicamente.

Snapshot da VM é rollback operacional. Backup lógico PostgreSQL/Restic é recuperação de dados com retenção externa. PBS será camada futura de disaster recovery rápido. Nenhum substitui os demais nem o teste de recuperação.

## Troubleshooting

- Falta SOPS/AGE: validar acesso na controladora e contrato, sem imprimir plaintext; role desativada não precisa de secrets.
- Repository inexistente: confirmar endpoint/prefixo/permissões; init somente para novo repository. Senha incorreta exige recuperar a original.
- AccessDenied / assinatura: conferir token limitado ao bucket, região auto, horário/NTP, conectividade HTTPS. Não ativar acesso público.
- Exit 3 do backup: snapshot parcial é falha, consultar logs e repetir após resolver arquivos ilegíveis/mutáveis. Restore-test deve passar antes de confiar no conjunto.
- Lock ocupado: aguardar operação. Não usar `restic unlock` até confirmar ausência de clientes ativos, inclusive de outra máquina.
- Disco cheio / OOM: medir staging/cache/volumes, espaço e swap; testes têm limites. Não aumentar paralelismo de dump/prune neste host de 2 GiB.
- Falha de check: preservar evidência e snapshots; não executar prune/reparos cegamente. Restore-test e check integral ajudam delimitar corrupção.
- Timer parado: default intencional; habilitar só após init/teste. `systemctl --failed`, `journalctl`, `list-timers` e snapshot mais recente são a verificação operacional. Não há alerta externo automático implementado.
- Restore falhou: trap limpa recursos temporários. Em SIGKILL/reboot, revisar nomes/labels e limpar restos manualmente. Nunca usar bancos reais como laboratório.

## Referências

- [Restic: retenção, agrupamento e check após prune](https://restic.readthedocs.io/en/stable/060_forget.html)
- [n8n: encryption key](https://docs.n8n.io/hosting/configuration/configuration-examples/encryption-key)
- [Cloudflare R2: API S3](https://developers.cloudflare.com/r2/api/s3/api/)
