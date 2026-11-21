## O que muda e por quê


## Checklist
- [ ] `npm run check` passou localmente (tipos, lint, testes)
- [ ] Migration nova: tem rollback em `supabase/rollbacks/` e foi aplicada no SQL Editor antes do deploy
- [ ] Tabela nova: RLS ligado e políticas por perfil (o teste de segurança reprova sem isso)
- [ ] Nada de dado pessoal em log, URL ou mensagem de erro (LGPD)
- [ ] Mudou tela: conferi no celular (largura 375px)
