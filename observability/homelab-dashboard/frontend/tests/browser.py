"""Run against frontend/serve.py, using Python with Playwright + Chromium installed."""
from pathlib import Path
from playwright.sync_api import sync_playwright
URL = 'http://localhost:8080/frontend/'
with sync_playwright() as p:
 browser=p.chromium.launch()
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' and '404' not in m.text else None)
 page.goto(URL)
 page.get_by_role('link',name='Inspecionar host').click()
 page.get_by_text('Nenhuma VM ou container configurado neste nó.',exact=True).wait_for()
 assert page.get_by_text('pve-manager/9.2.18',exact=False).count()>0
 assert page.get_by_text('Sem endereço IPv4',exact=True).count()==1
 page.screenshot(path='/tmp/homelab-host-desktop.png',full_page=True)
 for width in [375,768,1440]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
 page.set_viewport_size({'width':375,'height':900})
 page.screenshot(path='/tmp/homelab-host-mobile.png',full_page=True)
 page.get_by_role('link',name='Homelab',exact=True).click()
 page.get_by_role('heading',name='Visão geral').wait_for()
 page.set_viewport_size({'width':1440,'height':1000})
 page.screenshot(path='/tmp/homelab-overview.png',full_page=True)
 page.goto(URL+'?index=../examples/scenarios/nodes.json')
 page.get_by_role('link',name='fixture-warning',exact=True).first.wait_for()
 assert page.locator('.host-row.warning').count()==1
 assert page.locator('.host-row.critical').count()==1
 assert page.locator('.host-row.unknown').count()==1
 page.get_by_role('link',name='fixture-warning',exact=True).first.click()
 page.get_by_role('link',name='fixture-vm',exact=False).click()
 page.get_by_role('heading',name='fixture-vm',exact=True).wait_for()
 assert page.get_by_text('4%',exact=True).count()==1
 page.go_back()
 page.get_by_role('heading',name='fixture-warning',exact=True).wait_for()
 page.locator('#nodes-nav a[href="#/hosts/fixture-partial"]').click()
 page.get_by_role('heading',name='fixture-partial',exact=True).wait_for()
 # Intercept failures without modifying fixtures on disk.
 page.route('**/status.json',lambda route:route.fulfill(status=200,body='{broken',content_type='application/json'))
 page.goto(URL)
 page.get_by_text('status.json: JSON inválido.',exact=False).wait_for()
 assert page.locator('.host-row.unknown').count()==1
 page.unroute('**/status.json')
 page.route('**/status.json',lambda route:route.fulfill(status=404,body=''))
 page.goto(URL)
 page.get_by_text('status.json: Arquivo ausente.',exact=False).wait_for()
 page.unroute('**/status.json')
 page.route('**/guests.json',lambda route:route.fulfill(status=404,body=''))
 page.goto(URL)
 page.get_by_text('guests.json: Arquivo ausente.',exact=False).wait_for()
 page.get_by_role('link',name='Inspecionar host').click()
 assert page.get_by_text('Nenhuma VM ou container configurado neste nó.',exact=True).count()==0
 page.unroute('**/guests.json')
 page.route('**/inventory.json',lambda route:route.fulfill(status=404,body=''))
 page.goto(URL)
 page.get_by_text('inventory.json: Arquivo ausente.',exact=False).wait_for()
 page.get_by_role('link',name='Inspecionar host').click()
 page.get_by_role('heading',name='pve-01',exact=True).wait_for()
 page.unroute('**/inventory.json')
 page.route('**/nodes.json',lambda route:route.fulfill(status=200,body='{}',content_type='application/json'))
 page.goto(URL)
 page.locator('#main .notice').filter(has_text='nodes.json:').wait_for()
 page.unroute('**/nodes.json')
 page.goto('http://localhost:8080/')
 page.get_by_role('heading',name='Visão geral').wait_for()
 page.get_by_role('button',name='Atualizar dados').click()
 page.get_by_role('button',name='Atualizar dados').wait_for()
 page.get_by_role('link',name='Inspecionar host').focus()
 page.keyboard.press('Enter')
 page.get_by_role('heading',name='pve-01',exact=True).wait_for()
 page.get_by_role('link',name='Rede',exact=True).focus()
 page.keyboard.press('Enter')
 assert page.evaluate('document.activeElement.id')=='network'
 assert not errors,errors
 browser.close()
 print('PASS: desktop/tablet/mobile, navigation, zero guests, optional fields, WARNING/CRITICAL, invalid JSON, missing inventory, index failure; no unexpected console/page errors')
