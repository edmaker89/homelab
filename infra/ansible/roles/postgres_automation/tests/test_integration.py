"""Linux/Docker integration. Only disposable network-none containers, no Compose stack.
Run: sudo python3 -m unittest discover -s .../postgres_automation/tests -v
"""
import importlib.util
import json
from pathlib import Path
import subprocess
import time
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[5]
spec = importlib.util.spec_from_file_location('provision', Path(__file__).resolve().parents[1]/'files/provision.py')
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)
PASSWORD = 'a1' * 32  # Synthetic test value only.


class AutomationIntegration(unittest.TestCase):
    def setUp(self):
        self.name = 'automation-test-' + uuid.uuid4().hex[:12]
        subprocess.run(['docker','run','-d','--name',self.name,'--network','none','--memory','256m',
                        '--memory-swap','512m','--cpus','0.5','-e','POSTGRES_HOST_AUTH_METHOD=trust',
                        '-e','AUTOMATION_DB_PASSWORD='+PASSWORD,'pgvector/pgvector:0.8.6-pg17-trixie'],check=True,capture_output=True)
        self.addCleanup(lambda: subprocess.run(['docker','rm','-fv',self.name],check=True,capture_output=True))
        for _ in range(90):
            r=subprocess.run(['docker','exec',self.name,'sh','-c','[ "$(cat /proc/1/comm)" = postgres ] && pg_isready -U postgres'],capture_output=True)
            if r.returncode==0: break
            time.sleep(1)
        else: self.fail('Disposable PostgreSQL did not become ready')
        self.config=dict(password=PASSWORD,stack_dir='/fixture-only')
        subprocess.run(['docker','exec',self.name,'sh','-c',
                        'printf "%s\\n" "local all all trust" "host all all 127.0.0.1/32 scram-sha-256" > "$PGDATA/pg_hba.conf"'],check=True,capture_output=True)
        self.sql('SELECT pg_reload_conf();')

    def sql(self, query, database='postgres'):
        r=subprocess.run(['docker','exec','-i',self.name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],input=query,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,'Fixture SQL failed; output suppressed')
        return r.stdout.strip()

    def runner(self, args, **kwargs):
        # Translate only the provisioner's expected Compose prefix to our disposable target.
        self.assertEqual(args[:7],['docker','compose','--project-directory','/fixture-only','exec','-T','postgres'])
        return subprocess.run(['docker','exec','-i',self.name]+args[7:],**kwargs)

    def assert_state(self, password=PASSWORD):
        attrs=self.sql("SELECT rolcanlogin AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname='automation_app';")
        self.assertEqual(attrs,'t')
        self.assertEqual(self.sql("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='automation';"),'automation_app')
        self.assertEqual(self.sql("SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='specialist';",'automation'),'automation_app')
        stored=self.sql("SELECT rolpassword FROM pg_authid WHERE rolname='automation_app';")
        self.assertTrue(provision.matches(password,stored))
        self.assertFalse(provision.matches('b2'*32,stored))
        # Real PostgreSQL SCRAM authentication, password delivered on stdin only.
        command=['docker','exec','-i',self.name,'sh','-c',
                 'IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -X -w -h 127.0.0.1 -U automation_app -d automation -Atqc "SELECT current_user;"']
        login=subprocess.run(command,input=password+'\n',text=True,capture_output=True)
        self.assertEqual(login.returncode,0,'SCRAM login failed; output suppressed')
        self.assertEqual(login.stdout.strip(),'automation_app')
        wrong=subprocess.run(command,input='incorrect-test-password\n',text=True,capture_output=True)
        self.assertNotEqual(wrong.returncode,0)
        return stored

    def test_existing_cluster_convergence_and_data_preservation(self):
        for db in ['n8n','rag']:
            self.sql('CREATE DATABASE '+db+';')
            self.sql('CREATE TABLE sentinel(id int); INSERT INTO sentinel VALUES(42);',db)
        self.assertTrue(provision.converge(dict(self.config,check=True),self.runner))
        self.assertEqual(self.sql("SELECT count(*) FROM pg_database WHERE datname='automation';"),'0')
        self.assertTrue(provision.converge(self.config,self.runner))
        before=self.assert_state()
        self.sql('SET ROLE automation_app; CREATE TABLE specialist.sentinel(id int); INSERT INTO specialist.sentinel VALUES(99);','automation')
        self.assertFalse(provision.converge(self.config,self.runner))
        self.assertEqual(before,self.sql("SELECT rolpassword FROM pg_authid WHERE rolname='automation_app';"))
        self.sql('ALTER ROLE automation_app SUPERUSER CREATEDB; ALTER DATABASE automation OWNER TO postgres;')
        self.sql('ALTER SCHEMA specialist OWNER TO postgres;','automation')
        self.assertTrue(provision.converge(self.config,self.runner))
        self.assert_state()
        self.assertEqual(self.sql('SELECT id FROM specialist.sentinel;','automation'),'99')
        for db in ['n8n','rag']:
            self.assertEqual(self.sql('SELECT id FROM sentinel;',db),'42')
        self.assertTrue(provision.converge(dict(self.config,password='c3'*32),self.runner))
        self.assert_state('c3'*32)
        self.assertFalse(provision.converge(dict(self.config,password='c3'*32),self.runner))

    def test_fresh_bootstrap_matches_migration(self):
        script=(ROOT/'stacks/n8n/postgres/init/003-automation.sh').read_text()
        result=subprocess.run(['docker','exec','-i',self.name,'bash'],input=script,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,'Fresh bootstrap failed; output suppressed')
        self.assertNotIn(PASSWORD,result.stdout+result.stderr)
        self.assert_state()
        self.assertFalse(provision.converge(self.config,self.runner))
        # Repeated bootstrap preserves existing objects/data, even though fresh init normally runs once.
        self.sql('CREATE TABLE specialist.sentinel(id int); INSERT INTO specialist.sentinel VALUES(99);','automation')
        result=subprocess.run(['docker','exec','-i',self.name,'bash'],input=script,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,'Repeated bootstrap failed; output suppressed')
        self.assertEqual(self.sql('SELECT id FROM specialist.sentinel;','automation'),'99')


if __name__=='__main__':
    unittest.main()
