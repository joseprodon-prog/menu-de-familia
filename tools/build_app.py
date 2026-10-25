"""Construeix l'app (index.html) a partir del mateix codi que l'artefacte (rf/*)."""
import re,sys,os,json
SP='/tmp/claude-0/-home-claude/c73124b9-ddc5-518c-9f9e-c7cacfd48e9e/scratchpad'
OUT=sys.argv[1] if len(sys.argv)>1 else '/home/claude/menu-de-familia'
a=open(SP+'/rf/app.js',encoding='utf-8').read();c=open(SP+'/rf/extra.css',encoding='utf-8').read();b=open(SP+'/rf/body.html',encoding='utf-8').read();r=open(SP+'/recs.json',encoding='utf-8').read()
hh=open(SP+'/menus-familia.html',encoding='utf-8').read();head=hh[:hh.index('</style>')]
head=re.sub(r'<title>.*?</title>\n?','',head).replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
# fitxers: /_blob/ -> Supabase Storage
a=a.replace('"/_blob/"+','(window.BLOBBASE||"/_blob/")+').replace('/_blob/${','${window.BLOBBASE||"/_blob/"}${')
a=a.replace('const APPURL="https://claude.ai/artifact/9kT5ZGR5xToApPz85hikHh";','const APPURL=location.origin+"/";')
assert '/_blob/"' not in a.replace('||"/_blob/"','')
a=a.replace('%%RECS%%',r)
login_css='''
#mflogin{position:fixed;inset:0;z-index:200;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:24px}
#mflogin .mfl{background:var(--surface);border-radius:18px;box-shadow:var(--shadow);padding:28px 24px;width:min(420px,100%)}
#mflogin h1{font:700 30px var(--display);margin:0 0 8px}
#mflogin form{display:flex;flex-direction:column;gap:10px;margin-top:14px}
#mflogin input{font:16px var(--body);padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#fff}
#mflogin button.primary{font:600 16px var(--body);padding:12px;border-radius:999px;border:0;background:var(--blue,#2a78c2);color:#fff;cursor:pointer}
#mfout{margin:28px auto 8px;display:block}
#mflogin .ghost{font:600 14px var(--body);padding:8px;border:0;background:none;color:var(--muted);cursor:pointer}
#mflogin [hidden]{display:none}
'''
pwa='''<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Menú de Família</title>
<meta name="theme-color" content="#2a78c2">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Menú">
'''
b2=b.replace('</section>\n</div>','</section>\n  <button type="button" class="ghost" id="mfout" onclick="window.MF_SB&&MF_SB.auth.signOut()">Tanca la sessió</button>\n</div>') if '</section>\n</div>' in b else b
html='<!doctype html>\n<html lang="ca">\n<head>\n'+pwa+head+c+login_css+'</style>\n</head>\n<body>\n'+b2+'\n<script src="config.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.js"></script>\n<script src="adapter.js"></script>\n<script>\n'+a+'\n</script>\n<script>if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));</script>\n</body>\n</html>\n'
open(OUT+'/index.html','w',encoding='utf-8').write(html)
print('ok',len(html))
