#!/usr/bin/env python3
"""Controller integration: Ansible CHECK MODE only, ephemeral SOPS test values.
Requires SSH inventory, sops, age-keygen, community.sops. Never deploys a token.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[5]


def main():
    with tempfile.TemporaryDirectory(prefix='cloudflare-sops-check-') as tmp:
        p = Path(tmp)
        key = p/'age-key'
        subprocess.run(['age-keygen','-o',str(key)],check=True,capture_output=True)
        recipient = subprocess.run(['age-keygen','-y',str(key)],check=True,capture_output=True,text=True).stdout.strip()
        config = p/'sops-config.yaml'
        config.write_text('creation_rules:\n  - age: '+recipient+'\n')
        cases = [('synthetic-valid', {'tunnel_token':'SYNTHETIC_TEST_VALUE_NOT_A_REAL_TOKEN'}, 0),
                 ('placeholder', {'tunnel_token':'REPLACE_ME'}, 2),
                 ('empty', {'tunnel_token':''}, 2),
                 ('newline', {'tunnel_token':'SYNTHETIC_TEST_VALUE\n'}, 2),
                 ('missing', {}, 2)]
        for name, data, expected in cases:
            source = p/'input.json'
            source.write_text(json.dumps(data))
            encrypted = p/'test.sops.yaml'
            encrypted.write_bytes(subprocess.run(['sops','--config',str(config),'--encrypt','--output-type','yaml',str(source)],check=True,capture_output=True).stdout)
            result = subprocess.run(['ansible-playbook','playbooks/cloudflare-tunnel.yml','--check','--diff','-e',
                                     json.dumps(dict(cloudflare_tunnel_enabled=True,cloudflare_tunnel_sops_file=str(encrypted)))],
                                    cwd=ROOT/'infra/ansible',env=dict(os.environ,SOPS_AGE_KEY_FILE=str(key)),capture_output=True,text=True)
            output = result.stdout + result.stderr
            assert 'SYNTHETIC_TEST_VALUE' not in output, 'Synthetic token leaked'
            assert result.returncode == expected, f'{name}: unexpected exit {result.returncode}; output withheld'
            if expected:
                assert 'SOPS token invalid or unreadable' in output, 'Unexpected failure, output withheld'
            print(f'PASS: {name}, expected exit {expected}, no synthetic secret output')


if __name__ == '__main__':
    main()
