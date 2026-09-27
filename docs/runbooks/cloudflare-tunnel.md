# Cloudflare Tunnel do homelab

## Naming e arquitetura

`*.homelab.edmaker.dev.br` identifica homelab pessoal, estudo e portfolio. Serviços oficiais EdMaker continuam diretamente sob `*.edmaker.dev.br`.

```text
Cloudflare Edge → Tunnel → cloudflared → homelab-edge → serviços publicados
                                                    └─ n8n:5678
```

| Item | Valor |
|---|---|
| Tunnel existente | `edmaker-homelab` |
| Tunnel ID | `078aa601-ac92-453b-9a01-a1fe1fc17e43` |
| Gerenciamento | Remotely managed, configuração de rotas no dashboard Cloudflare |
| Primeiro hostname | `n8n.homelab.edmaker.dev.br` |
| Origin HTTP | `http://n8n:5678` |
| Imagem | `cloudflare/cloudflared:2026.9.3` |
| Compose runtime | `/opt/homelab/stacks/cloudflared` |
| Token runtime | `/etc/homelab/cloudflared/tunnel.env` |
| Rede Docker compartilhada | `homelab-edge` (bridge external para os projetos Compose) |

cloudflared é infraestrutura compartilhada, não pertence à stack n8n. Nenhuma porta do cloudflared é publicada no host. Não abrir portas no roteador. O connector estabelece conexões de saída; permitir a conectividade exigida pela Cloudflare no firewall de saída, inclusive TCP/UDP 7844. Não há DNS/API token nem alterações DNS automatizadas neste código.

Somente cloudflared e n8n entram em `homelab-edge`. PostgreSQL permanece na rede database, runners na rede runners. A rede edge é compartilhada entre serviços explicitamente conectados: não é isolamento entre seus membros. Não conectar bancos, runners ou serviços que não devem ser alcançáveis pelo edge. Somente configurar rotas para portas HTTP pretendidas, nunca para o broker de runners.

## Imagem, readiness e recursos

Imagem oficial pinada na versão 2026.9.3, confirmada com `--version` em container sem rede. `--no-autoupdate` e `restart: unless-stopped`. Updates são mudanças explícitas de imagem, revisadas/testadas e aplicadas via Ansible.

O processo recebe `--metrics 0.0.0.0:2000`; `/ready` e `/metrics` ficam no container/rede Docker, sem mapeamento de porta no host. O healthcheck executa o próprio binário:

```text
cloudflared tunnel --metrics 127.0.0.1:2000 ready
```

Esse comando consulta `/ready` e exige HTTP 200. Não depende de curl/wget/shell ausentes na imagem. `docker compose up --wait --wait-timeout 180` só conclui a ativação com o connector saudável. Readiness prova conectividade do tunnel, não prova DNS/TLS públicos ou saúde do n8n. Se falhar, a ativação retorna erro e pode deixar o container em execução tentando reconectar; consultar os logs e corrigir a causa.

Limites iniciais: 128 MiB RAM e 0.5 CPU; filesystem read-only, capabilities removidas e no-new-privileges. Logs info com rotação 10 MiB × 3. Rever limites com métricas caso o tráfego cresça.

## SOPS e comportamento da role

A regra `.sops.yaml` existente cobre `secrets/cloudflare-tunnel.sops.yaml`. O exemplo contém apenas `tunnel_token: REPLACE_ME`; não é credencial utilizável. O token existente fica salvo externamente até inserção pelo operador via SOPS:

```bash
# Na raiz do repositório, na controladora:
ansible-galaxy collection install -r infra/ansible/collections/requirements.yml
sops secrets/cloudflare-tunnel.sops.yaml
```

No editor do SOPS, definir `tunnel_token` com o token do tunnel correto, sem espaços ou quebras de linha. Não colar token em comandos, argumentos, Git plaintext ou terminal de logs. A chave AGE fica na controladora, nunca é copiada para a VM.

Ansible usa `community.sops.sops`, `no_log: true` no tratamento e implantação do token, diretório root:root 0700 e arquivo 0600. O token entra somente como `TUNNEL_TOKEN` via `env_file`, nunca na CLI. Usuários com acesso root/Docker podem inspecionar ambientes; não imprimir `docker inspect` completo, `docker compose config` com resolução de env ou usar debug/xtrace. Validar com `config --quiet --no-env-resolution`.

O nome/ID declarados documentam a identidade esperada; o token determina a identidade efetiva do remotely managed tunnel. Confirmar no dashboard que o connector entrou em **edmaker-homelab**, com o UUID acima.

`cloudflare_tunnel_enabled: false` instala estrutura/Compose e garante a rede quando o playbook é aplicado, sem exigir token nem iniciar container. Em check mode, apenas simula escritas. **Desativar a variável não para um connector já existente**; para desligamento operacional, usar o comando stop abaixo. Nenhum credential dummy é instalado. `config --no-env-resolution` permite validar Compose sem token.

Com enabled=true, o contrato é validado antes de alterações; o token deve ser não vazio e diferente de REPLACE_ME. A role aplica `compose up` idempotentemente, recriando o connector quando configuração, imagem ou ambiente mudam, e espera `/ready` saudável. Falta de arquivo, descriptografia ou token inválido falha sem expor valores.

## Ativação real, em ordem

Nenhuma etapa abaixo foi executada com token real durante os testes.

1. Conferir cobertura TLS do hostname: em uma zona full setup de `edmaker.dev.br`, Universal SSL padrão cobre o apex e apenas um nível de subdomínio. `n8n.homelab.edmaker.dev.br` precisa de cobertura própria, por exemplo Advanced Certificate/Total TLS ou certificado adequado à configuração da zona. Não alterar o namespace como contorno. Conferir o certificado no dashboard antes da validação HTTPS.
2. Preparar infraestrutura sem iniciar tunnel:

   ```bash
   cd infra/ansible
   ansible-playbook playbooks/cloudflare-tunnel.yml --syntax-check
   ansible-playbook playbooks/cloudflare-tunnel.yml --check --diff -e '{"cloudflare_tunnel_enabled":false}'
   ansible-playbook playbooks/cloudflare-tunnel.yml -e '{"cloudflare_tunnel_enabled":false}'
   ```

3. Criar o arquivo SOPS conforme a seção anterior. Ativar o connector na controladora:

   ```bash
   ansible-playbook playbooks/cloudflare-tunnel.yml -e '{"cloudflare_tunnel_enabled":true}'
   ```

4. Após o tunnel ficar online, configurar **manualmente** no dashboard seu Public Hostname: hostname `n8n.homelab.edmaker.dev.br`, Service Type `HTTP`, URL `n8n:5678`. Sem wildcard. Confirmar UUID correto. Não executar `cloudflared tunnel route dns`, curl/API ou criar token de API para isso.
5. Implantar o Compose atualizado do n8n em janela apropriada, com `homelab-edge` já criada:

   ```bash
   # Controladora, infra/ansible:
   ansible-playbook playbooks/n8n.yml
   # VM, apenas n8n, sem recriar dependências/bancos/runners:
   cd /opt/homelab/stacks/n8n
   sudo docker compose up -d --no-deps n8n
   ```

   O playbook n8n existente entrega configuração; o comando acima recria somente o serviço n8n. A sessão do editor pode ser interrompida. Os containers PostgreSQL/runners não são recriados; runners devem reconectar ao broker.
6. Validar HTTPS/certificado, login, editor, URLs de webhook de teste e produção e execução de um workflow. Conferir readiness e logs. Acesso público mantém autenticação do n8n; políticas Cloudflare Access, se escolhidas depois, precisam considerar webhooks externos.
7. Manter `192.168.15.220:5678:5678` até validação completa. Sua remoção é uma mudança posterior, não parte desta implementação. Com secure cookies e URLs públicas HTTPS, acesso direto via HTTP LAN pode não servir para login no navegador; não desativar secure cookies para contornar isso.

n8n 2.40.7 usa `N8N_WEBHOOK_URL` (sucessora de WEBHOOK_URL), junto de N8N_HOST, N8N_PROTOCOL=https, N8N_EDITOR_BASE_URL, N8N_PROXY_HOPS=1 e N8N_SECURE_COOKIE=true. Um hop corresponde ao cloudflared encaminhando para o origin. Se outro proxy for introduzido, revisar a contagem.

## Operação e diagnóstico

Na VM:

```bash
cd /opt/homelab/stacks/cloudflared
sudo docker compose ps
sudo docker compose logs --tail 100 cloudflared
sudo docker compose exec -T cloudflared cloudflared tunnel --metrics 127.0.0.1:2000 ready
sudo docker compose config --quiet --no-env-resolution
sudo docker network inspect homelab-edge --format '{{range .Containers}}{{println .Name}}{{end}}'
```

Não publicar a porta 2000 para consultar `/ready`: o comando acima faz a consulta internamente. Procurar eventos de conexão registrada nos logs info e status Healthy no dashboard do tunnel. Não usar nível debug com tráfego real ou compartilhar logs sem revisão.

- Unhealthy: conferir token do tunnel correto, DNS/egress da VM, saída TCP/UDP 7844, limites de recursos e logs.
- Tunnel saudável, origin 502: conferir que o n8n foi recriado com a rede edge, nome DNS Docker `n8n`, porta 5678 e readiness do app.
- Falha TLS no hostname: conferir certificado que cobre o subdomínio de segundo nível; tunnel saudável não resolve ausência de certificado público.
- Webhooks/redirects incorretos: conferir variáveis HTTPS atuais e proxy hops, sem alterar WEBHOOK_URL legada.
- `homelab-edge` ausente: aplicar primeiro a role cloudflare_tunnel desativada. A stack n8n não cria rede external por conta própria.

Desligar somente o connector, preservando rede e serviços:

```bash
cd /opt/homelab/stacks/cloudflared
sudo docker compose stop cloudflared
```

Não usar `docker network rm homelab-edge` durante operação: a rede é compartilhada.

## Rotacionar token

Gerar/rotacionar o token no dashboard do tunnel existente. Atualizar `secrets/cloudflare-tunnel.sops.yaml` com `sops`, sem plaintext no Git. Aplicar novamente o playbook com enabled=true; Compose detecta mudança no env e recria somente cloudflared. Confirmar `/ready`, connector correto no dashboard e acesso ao n8n. Acompanhar revogação dos connectors/token anteriores conforme controles do dashboard. Nenhuma senha PostgreSQL ou dado do app é alterado pela rotação.

## Adicionar serviços

Para Grafana, MinIO ou outro serviço, conectar explicitamente somente o frontend/origin desejado à rede external `homelab-edge` em sua própria stack. Usar aliases únicos para evitar colisões de DNS entre projetos. Publicar manualmente um hostname específico sob `homelab.edmaker.dev.br` apontando ao nome/porta internos. Validar autenticação, TLS público e parâmetros de proxy do serviço. Não adicionar wildcard nem conectar automaticamente todos os serviços/bancos à edge.

## Validação reproduzível

```bash
python3 -m unittest discover -s infra/ansible/roles/cloudflare_tunnel/tests -v
python3 infra/ansible/roles/cloudflare_tunnel/tests/check_role.py
bash -n infra/ansible/roles/cloudflare_tunnel/tests/integration-local.sh
shellcheck infra/ansible/roles/cloudflare_tunnel/tests/integration-local.sh
```

`check_role.py` usa chave AGE temporária e valores sintéticos somente em `--check --diff`; não instala credenciais. A integração Linux `tests/integration-local.sh` valida os dois Compose e testa o binário cloudflared contra fixtures HTTP 200/503 em namespaces `network none`. Requer Docker e imagens já disponíveis; executar como root no host de teste com a árvore de arquivos copiada. Nunca executa `tunnel run` nem usa token. Readiness real com Cloudflare, DNS/TLS e acesso público ficam pendentes de ativação.

## Fontes verificadas

- [Release cloudflared 2026.9.3](https://github.com/cloudflare/cloudflared/releases/tag/2026.9.3)
- [Implementação nativa de tunnel ready e TUNNEL_TOKEN](https://github.com/cloudflare/cloudflared/blob/2026.9.3/cmd/cloudflared/tunnel/subcommands.go)
- [Configuração n8n 2.40.7: N8N_WEBHOOK_URL](https://github.com/n8n-io/n8n/blob/n8n%402.40.7/packages/%40n8n/config/src/index.ts)
- [Cobertura de subdomínios do Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/)
