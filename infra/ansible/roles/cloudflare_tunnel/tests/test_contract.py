"""Offline contract tests. No token, Docker execution or Cloudflare connection."""
from pathlib import Path
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[5]
ROLE = ROOT / 'infra/ansible/roles/cloudflare_tunnel'


class TunnelContract(unittest.TestCase):
    def setUp(self):
        self.cf = yaml.safe_load((ROOT/'stacks/cloudflared/compose.yaml').read_text())
        self.n8n = yaml.safe_load((ROOT/'stacks/n8n/compose.yaml').read_text())
        self.tasks = yaml.safe_load((ROLE/'tasks/main.yml').read_text())

    def test_shared_network_is_opt_in(self):
        self.assertEqual(self.cf['networks']['homelab-edge'], dict(external=True, name='homelab-edge'))
        self.assertEqual(self.n8n['networks']['homelab-edge'], dict(external=True, name='homelab-edge'))
        self.assertEqual(self.cf['services']['cloudflared']['networks'], ['homelab-edge'])
        self.assertIn('homelab-edge', self.n8n['services']['n8n']['networks'])
        for name in ['postgres', 'task-runners']:
            self.assertNotIn('homelab-edge', self.n8n['services'][name]['networks'])

    def test_token_never_in_command_and_no_published_ports(self):
        service = self.cf['services']['cloudflared']
        self.assertEqual(service['command'], ['tunnel','--no-autoupdate','--loglevel','info','--metrics','0.0.0.0:2000','run'])
        self.assertEqual(service['restart'], 'unless-stopped')
        self.assertNotIn('ports', service)
        self.assertNotIn('environment', service)
        self.assertEqual(service['env_file'], ['${CLOUDFLARED_CONFIG_DIR:-/etc/homelab/cloudflared}/tunnel.env'])
        self.assertIn('cloudflare/cloudflared:2026.9.3', service['image'])
        self.assertNotIn('latest', service['image'])

    def test_native_readiness_not_missing_curl(self):
        health = self.cf['services']['cloudflared']['healthcheck']
        self.assertEqual(health['test'], ['CMD','cloudflared','tunnel','--metrics','127.0.0.1:2000','ready'])
        self.assertEqual(health['timeout'], '5s')

    def test_n8n_https_and_lan_preserved(self):
        service = self.n8n['services']['n8n']
        self.assertEqual(service['ports'], ['192.168.15.220:5678:5678'])
        expected = dict(N8N_HOST='n8n.homelab.edmaker.dev.br', N8N_PROTOCOL='https',
                        N8N_EDITOR_BASE_URL='https://n8n.homelab.edmaker.dev.br/',
                        N8N_WEBHOOK_URL='https://n8n.homelab.edmaker.dev.br/',
                        N8N_PROXY_HOPS='1', N8N_SECURE_COOKIE='true')
        for key, value in expected.items():
            self.assertEqual(service['environment'][key], value)
        self.assertNotIn('WEBHOOK_URL', service['environment'])

    def test_disabled_default_and_no_automatic_start_in_check_mode(self):
        defaults = yaml.safe_load((ROLE/'defaults/main.yml').read_text())
        self.assertIs(defaults['cloudflare_tunnel_enabled'], False)
        block = next(t for t in self.tasks if t['name']=='Load tunnel credentials only when enabled')
        self.assertEqual(block['when'], 'cloudflare_tunnel_enabled | bool')
        up = next(t for t in self.tasks if t['name'].startswith('Converge enabled'))
        self.assertEqual(up['when'], ['cloudflare_tunnel_enabled | bool', 'not ansible_check_mode'])
        self.assertIn('--wait', up['ansible.builtin.command']['argv'])
        self.assertTrue(up['no_log'])

    def test_private_credentials_and_no_resolved_compose_output(self):
        task = next(t for t in self.tasks if t['name']=='Install tunnel token environment')
        self.assertTrue(task['no_log'])
        self.assertEqual(task['ansible.builtin.template']['mode'], '0600')
        self.assertEqual(task['ansible.builtin.template']['owner'], 'root')
        directory = next(t for t in self.tasks if t['name']=='Create private tunnel configuration directory')
        self.assertEqual(directory['ansible.builtin.file']['mode'], '0700')
        validation = next(t for t in self.tasks if t['name'].startswith('Validate installed Compose'))
        self.assertIn('--quiet', validation['ansible.builtin.command']['argv'])
        self.assertIn('--no-env-resolution', validation['ansible.builtin.command']['argv'])


if __name__ == '__main__':
    unittest.main()
