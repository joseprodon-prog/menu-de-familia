import re
SP='/tmp/claude-0/-home-claude/c73124b9-ddc5-518c-9f9e-c7cacfd48e9e/scratchpad'
R=lambda p:open(SP+'/'+p,encoding='utf-8').read()
a=R('rf/app.js').replace('%%RECS%%',R('recs.json'));hh=R('menus-familia.html');head=hh[:hh.index('</style>')].replace('<title>Menús Família</title>','<title>Menú de Família</title>')
html=head+R('rf/extra.css')+'</style>\n</head>\n<body>\n'+R('rf/body.html')+'\n<script>\n'+a+'\n</script>\n'
open(SP+'/proto_new.html','w',encoding='utf-8').write(html);print(len(html))
