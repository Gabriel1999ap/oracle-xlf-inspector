XLF INSPECTOR — ORACLE CLOUD

O processamento acontece inteiramente no navegador. Nenhum arquivo é enviado
para um servidor.

Recursos:
- Leitura dos atributos XLIFF e <file>;
- Destaque do idioma atual (source-language) e idioma de destino (target-language);
- Exibição completa do <header> em árvore;
- Listagem e busca de todos os <trans-unit>;
- Exibição de source, target, note, atributos e prop-groups;
- Diagnóstico de targets vazios ou iguais ao source;
- Seleção individual, seleção de todos os visíveis ou de todos iguais ao source;
- Tradução local no Chrome desktop, com proteção e validação de variáveis;
- Edição manual do target sem alteração do ID;
- Inclusão de novos blocos com ID exclusivo gerado automaticamente;
- Exportação de um novo XLF preservando o texto original fora dos targets editados;
- Visualização da árvore XML completa;
- Exportação da análise para CSV e JSON.

Tradução local:
- Requer uma versão atual do Chrome para computador com a Translator API;
- O pacote do par de idiomas pode ser baixado pelo próprio Chrome na primeira vez;
- Revise sempre a tradução antes de utilizar o XLF no Oracle.

Arquivos do projeto:
- index.html
- styles.css
- app.js