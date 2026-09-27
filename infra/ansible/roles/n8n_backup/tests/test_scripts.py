#!/usr/bin/env python3
"""Behavior/failure tests using isolated executables, never the real Docker/R2.
Run on Linux: python3 -m unittest discover -s .../n8n_backup/tests -v
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROLE = Path(__file__).resolve().parents[1]
MOCK = r'''#!/usr/bin/env python3
import json, os, pathlib, shutil, sys
p=pathlib.Path(os.environ['CASE'])
a=sys.argv[1:]
kind=pathlib.Path(sys.argv[0]).name
with (p/'calls').open('a') as f: f.write(json.dumps([kind,*a])+'\n')
fault=os.environ.get('FAULT','')
if kind=='restic':
    if a[0]=='snapshots':
        if fault=='repository': sys.exit(1)
        print(json.dumps([dict(id='a'*64,time='2026-09-27T00:00:00Z')]))
    elif a[0]=='backup':
        if fault=='upload': sys.exit(3)
        staging=pathlib.Path(a[-2])
        shutil.copytree(staging,p/'captured')
        (p/'modes').write_text(json.dumps({x.name:oct(x.stat().st_mode & 0o777) for x in staging.iterdir()}))
        print('snapshot aaaaaaaa saved')
    elif a[0]=='restore':
        dest=pathlib.Path(a[a.index('--target')+1])/'dump-set'
        shutil.copytree(p/'fixture',dest)
        if fault=='checksum': (dest/'rag.dump').write_text('corrupt')
    elif a[0]=='forget' and fault=='forget': sys.exit(1)
    sys.exit(0)
if a[0]=='info': sys.exit(0)
if a[0]=='compose':
    if 'ps' in a: print('fixture-postgres'); sys.exit(0)
    if 'pg_dumpall' in a: print('CREATE ROLE postgres;'); sys.exit(0)
    if 'pg_dump' in a:
        if fault=='dump-rag' and a[-1]=='rag': sys.exit(1)
        print('fixture archive '+a[-1]); sys.exit(0)
    if 'pg_restore' in a:
        sys.stdin.buffer.read()
        sys.exit(1 if fault=='archive' else 0)
    if 'psql' in a: print('0.8.6' if 'extversion' in a[-1] else '17.11'); sys.exit(0)
    if a[-1]=='--version': print('2.40.7'); sys.exit(0)
    sys.exit(0)
if a[0]=='volume':
    if a[1]=='create': (p/'volume-live').touch()
    if a[1]=='rm': (p/'volume-live').unlink(missing_ok=True)
    sys.exit(0)
if a[0]=='run':
    (p/'container-live').touch()
    if fault=='start': sys.exit(1)
    print('temporary-container'); sys.exit(0)
if a[0]=='rm':
    if fault=='cleanup': sys.exit(1)
    (p/'container-live').unlink(missing_ok=True); sys.exit(0)
if a[0]=='exec':
    if 'pg_restore' in a:
        sys.stdin.buffer.read()
        if fault=='restore-rag' and a[-1]=='rag': sys.exit(1)
    if 'psql' in a:
        if '-Atqc' in a: print('0.8.6' if 'extversion' in a[-1] else '3')
        else: sys.stdin.buffer.read()
    sys.exit(0)
sys.exit(2)
'''


class Scripts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='n8n-backup-tests-')
        self.p = Path(self.tmp.name)
        for name in ['bin', 'staging', 'app', 'config', 'fixture']:
            (self.p/name).mkdir(mode=0o700)
        self.env = dict(os.environ, CASE=str(self.p), PATH=str(self.p/'bin')+':'+os.environ['PATH'])
        for cmd in ['restic', 'docker']:
            f = self.p/'bin'/cmd
            f.write_text(MOCK)
            f.chmod(0o700)
        config = self.p/'config'
        (config/'restic-password').write_text('synthetic-test-password-only')
        (config/'r2.env').write_text('AWS_ACCESS_KEY_ID=synthetic\nAWS_SECRET_ACCESS_KEY=synthetic\nAWS_DEFAULT_REGION=auto\n')
        (config/'backup.conf').write_text('\n'.join(f'{k}={v}' for k,v in {
            'BACKUP_ROOT':self.p/'staging', 'APP_DIR':self.p/'app', 'STACK_DIR':self.p/'stack',
            'RESTORE_IMAGE':'pgvector/pgvector:0.8.6-pg17-trixie', 'BACKUP_HOST':'lab-docker-01',
            'BACKUP_TAG':'homelab-n8n', 'RESTIC_PASSWORD_FILE':config/'restic-password',
        }.items())+'\n')
        common = (ROLE/'templates/common.sh.j2').read_text()
        for name in ['backup.conf', 'r2.env']:
            common = common.replace("{{ (n8n_backup_config_dir ~ '/"+name+"') | quote }}",str(config/name))
        common = common.replace('/run/lock/homelab-n8n-backup.lock',str(self.p/'lock'))
        (self.p/'common.sh').write_text(common)
        for f in (ROLE/'files').iterdir():
            (self.p/f.name).write_text(f.read_text().replace('/usr/local/lib/homelab-n8n-backup/common.sh',str(self.p/'common.sh')))
        hashes={}
        for n in ['globals.sql','n8n.dump','rag.dump']:
            data=('fixture '+n).encode()
            (self.p/'fixture'/n).write_bytes(data)
            hashes[n]=hashlib.sha256(data).hexdigest()
        (self.p/'fixture'/'SHA256SUMS').write_text(''.join(f'{h}  {n}\n' for n,h in hashes.items()))
        (self.p/'fixture'/'metadata.json').write_text(json.dumps(dict(databases=['n8n','rag'],sha256=hashes)))

    def tearDown(self):
        self.tmp.cleanup()

    def run_script(self, name, fault='', *args):
        result = subprocess.run(['bash', str(self.p/name), *args], env=dict(self.env,FAULT=fault), capture_output=True,text=True)
        self.assertNotIn('synthetic-test-password-only',result.stdout+result.stderr)
        self.assertNotIn('AWS_SECRET_ACCESS_KEY=',result.stdout+result.stderr)
        return result

    def calls(self):
        return [json.loads(x) for x in (self.p/'calls').read_text().splitlines()]

    def assert_clean(self):
        self.assertEqual(list((self.p/'staging').iterdir()),[])
        self.assertFalse((self.p/'container-live').exists())
        self.assertFalse((self.p/'volume-live').exists())

    def test_backup_artifacts_and_scope(self):
        r=self.run_script('homelab-n8n-backup')
        self.assertEqual(r.returncode,0,r.stderr)
        p=self.p/'captured'
        m=json.loads((p/'metadata.json').read_text())
        self.assertEqual(m['databases'],['n8n','rag'])
        self.assertEqual(m['postgresql_version'],'17.11')
        self.assertEqual(m['n8n_version'],'2.40.7')
        self.assertEqual(m['pgvector_version'],'0.8.6')
        self.assertEqual(m['repository_logical_name'],'n8n/restic')
        self.assertTrue(m['timestamp_utc'] and m['hostname'] and m['script_version'])
        for name in ['globals.sql','n8n.dump','rag.dump']:
            self.assertEqual(m['sha256'][name],hashlib.sha256((p/name).read_bytes()).hexdigest())
        self.assertEqual(set(json.loads((self.p/'modes').read_text()).values()),{'0o600'})
        backup=[x for x in self.calls() if x[:2]==['restic','backup']]
        self.assertEqual(len(backup),1)
        self.assertEqual(backup[0][-1],str(self.p/'app'))
        self.assertEqual(backup[0][2:-2], ['--host', 'lab-docker-01', '--tag', 'homelab-n8n', '--group-by', 'host,tags'])
        self.assertFalse(any(arg.startswith(('--exclude', '--iexclude', '--files-from')) for arg in backup[0]))
        self.assertNotIn('/srv/homelab/n8n/postgres',backup[0])
        self.assertFalse(any('prune' in x for x in self.calls()))
        self.assert_clean()

    def test_backup_failures_clean_and_no_success(self):
        for fault in ['repository','dump-rag','archive','upload']:
            with self.subTest(fault=fault):
                r=self.run_script('homelab-n8n-backup',fault)
                self.assertNotEqual(r.returncode,0)
                self.assertNotIn('n8n backup completed',r.stdout)
                self.assert_clean()

    def test_retention_scope_and_order(self):
        r=self.run_script('homelab-n8n-backup-maintenance')
        self.assertEqual(r.returncode,0,r.stderr)
        commands=[x for x in self.calls() if x[0]=='restic']
        forget=next(x for x in commands if x[1]=='forget')
        for flag,value in [('--keep-daily','7'),('--keep-weekly','4'),('--keep-monthly','6'),('--group-by','host,tags'),('--host','lab-docker-01'),('--tag','homelab-n8n')]:
            self.assertEqual(forget[forget.index(flag)+1],value)
        self.assertIn('--prune',forget)
        self.assertEqual(commands[-1],['restic','check'])

    def test_failed_forget_does_not_report_success(self):
        r=self.run_script('homelab-n8n-backup-maintenance','forget')
        self.assertNotEqual(r.returncode,0)
        self.assertNotIn(['restic','check'],self.calls())

    def test_restore_isolated_and_cleanup(self):
        r=self.run_script('homelab-n8n-restore-test')
        self.assertEqual(r.returncode,0,r.stderr)
        calls=self.calls()
        run=next(x for x in calls if x[:2]==['docker','run'])
        self.assertEqual(run[run.index('--network')+1],'none')
        self.assertNotIn('-p',run)
        self.assertTrue(run[run.index('--mount')+1].startswith('type=volume,'))
        self.assertFalse(any('compose' in x for x in calls))
        self.assertEqual(len([x for x in calls if 'pg_restore' in x and '--exit-on-error' in x]),2)
        self.assertIn('Restore-test passed',r.stdout)
        self.assert_clean()

    def test_restore_failure_cleanup(self):
        for fault in ['checksum','start','restore-rag']:
            with self.subTest(fault=fault):
                r=self.run_script('homelab-n8n-restore-test',fault)
                self.assertNotEqual(r.returncode,0)
                self.assertNotIn('Restore-test passed',r.stdout)
                self.assert_clean()

    def test_cleanup_failure_is_not_success(self):
        r=self.run_script('homelab-n8n-restore-test','cleanup')
        self.assertNotEqual(r.returncode,0)
        self.assertNotIn('Restore-test passed',r.stdout)
        self.assertIn('cleanup incomplete',r.stderr)

    def test_corruption_fails_before_container_creation(self):
        r=self.run_script('homelab-n8n-restore-test','checksum')
        self.assertNotEqual(r.returncode,0)
        self.assertFalse(any(x[:2]==['docker','run'] for x in self.calls()))

    def test_unknown_snapshot_rejected(self):
        r=self.run_script('homelab-n8n-restore-test','','bbbbbbbb')
        self.assertNotEqual(r.returncode,0)
        self.assertFalse(any(x[:2]==['restic','restore'] for x in self.calls()))
        self.assert_clean()

    def test_lock_prevents_any_repository_operation(self):
        # Keep the production contention behavior, shorten only its test timeout.
        p=self.p/'common.sh'
        p.write_text(p.read_text().replace('flock -w 300','flock -w 0'))
        import fcntl
        with (self.p/'lock').open('w') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            r=self.run_script('homelab-n8n-backup')
        self.assertNotEqual(r.returncode,0)
        self.assertFalse((self.p/'calls').exists())


if __name__=='__main__':
    unittest.main()
