# Menú de Família

App familiar de menús setmanals, receptari compartit, llista de la compra, despesa i entrada de documents.

- El disseny i les funcions es proven primer al prototip (artefacte de Claude) i després es traslladen aquí.
- `index.html` es genera a partir del mateix codi del prototip; `adapter.js` connecta l'app a Supabase.
- `supabase/schema.sql`: taules, permisos i fitxers (executar una vegada al SQL Editor de Supabase).
- Publicació: Cloudflare Pages (https://menu-de-familia.pages.dev), directament des d'aquest repositori (sense compilació; capçaleres a _headers).
