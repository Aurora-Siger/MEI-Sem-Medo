# MEI sem Medo — Citizen Assist AI (FIAP Global Solution 2026.2)

**Equipe:** _[nome da equipe]_ · **RMs:** _[RM — nome]_ (preencher)
**Vídeo (YouTube, não listado):** _[link]_

## 1. Problema, público e temas
Microempreendedores individuais (MEI) encontram informação dispersa e desatualizada sobre a reforma tributária, obrigações fiscais e vendas ao consumidor. O assistente organiza respostas verificadas e diz quando não sabe.
Temas (6): **reforma** (CBS/IBS, transição, Simples Híbrido), **mei** (DAS, limite, nota fiscal, DASN), **consumidor** (CDC/Procon sob a ótica do comerciante), **split** (split payment), **simples** (categorias/anexos, alíquotas, Fator R) e **creditos** (recuperação de créditos de IBS/CBS).

## 2. Base de conhecimento e busca
- `data/base.json`: 37 registros. Campos obrigatórios: `id`, `tema`, `titulo`, `palavras_chave`, `resposta`, `fonte`, `url`, `verificado`, `confianca` (`alta`/`confirmar`), `relacionados`.
- Para acrescentar ou corrigir uma orientação basta editar o JSON; o código não muda. `carregar()` valida a base e trata arquivo ausente, vazio, JSON inválido, campo faltando, id duplicado e ligação para id inexistente.
- Estruturas: **dicionário** id → registro (acesso por identificador), **lista** por tema (`por_tema`) e **grafo** de tópicos: cada registro lista `relacionados` (89 arestas ligando os 6 temas; ex.: nota fiscal do MEI ↔ nota como prova de compra no CDC ↔ nota na reforma).
- **Busca por palavras-chave com pontuação:** remove acentos e stopwords; palavra-chave = 3 pts, título = 2, corpo = 1, expressão composta = +4. Responde se a melhor pontuação for ≥ 3. Com várias correspondências, mostra a de maior pontuação; se a segunda for de outro tema com ≥ 90% da pontuação, a pergunta é tratada como **ambígua** e o usuário escolhe. Depois da resposta, "Veja também" sugere até 3 vizinhos no grafo.

## 3. Regras de resposta e limitações
Condicionais tratam: vazia, inválida (sem letras, muito curta ou longa), ambígua, sem correspondência e ok. Fora da base: "não sei, confirme em [fonte oficial]", sem inventar. Registros `confirmar` exibem aviso, porque as regras da reforma mudam e as fontes divergem.
**Dois modelos de resposta** (`--modelo A|B`, detalhados em `docs/uso_ia.md`): A = resposta + fonte + data; B = resumo + explicação + fonte + nível de confiabilidade. Comparação: ambos 26/26 completos; B é mais claro para incerteza, A é mais curto.

## 4. Testes e indicadores (`python tests/testes.py`)
| Indicador | Resultado |
|---|---|
| Perguntas de teste | 34 (23 diretas, 3 reformulações, 4 entradas vazias/inválidas, 1 ambígua, 3 fora do tema) |
| Taxa de acerto | 34/34 = **100%** |
| Tempo médio de consulta | ~1 ms (máx. ~1,5 ms) |
| Validação da base | 4/4 falhas simuladas tratadas |
| Paridade frontend x Python | 34 perguntas + DAS + créditos + MEI + 7 cenários puro x híbrido + histórico de 42 meses idênticos (`python tests/paridade.py`) |
Log completo: `docs/resultados_testes.txt`. Facilidade de uso: roteiro em `docs/usabilidade.md` (**ainda precisa ser aplicado com pessoas reais**).
**Interpretação e limites:** 100% reflete um conjunto pequeno escrito pelo próprio grupo, com vocabulário próximo ao da base; não prova o desempenho com usuários reais (ampliar os testes revelou falhas de sinônimos e colisões de palavras-chave (por exemplo, “receita” casando com receita de bolo), já corrigidas). O tempo mede só a busca local.
**Melhorias:** (1) tolerância a erros de digitação e sinônimos (distância de edição); (2) coletar perguntas reais caídas em "não sei" para ampliar a base; (3) revisão periódica dos registros `confirmar`.

## 5. Frontend e calculadoras
- **Frontend web** (`web/index.html`, sem instalação: abra o arquivo no navegador). A aba Perguntar é um **chat com o assistente**: mostra a resposta com fonte, opções de “Veja também” e um botão que abre a calculadora certa (DAS, créditos, limite do MEI ou split). Abas: Perguntar, Meu MEI, Temas, Simples, Puro x Híbrido, Créditos e Split payment. Layout para celular, modo escuro, teclado e leitor de tela. O motor de busca em `web/motor.js` é uma porta do `sistema.py`; `python scripts/gerar_web.py` atualiza `web/base.js` depois de editar a base.
- **Meu MEI:** calcula o DAS-MEI por atividade (5% do salário mínimo + R$ 1 de ICMS e/ou R$ 5 de ISS), o limite proporcional de R$ 81 mil, quanto ainda pode faturar por mês, o que acontece se estourar (até 20% ou acima) e uma estimativa do custo de virar microempresa. Também em `python src/calculadora.py` (opção 3).
- **Simples:** tabela dos 5 anexos (LC 123/2006) e calculadora do DAS com alíquota efetiva e Fator R (`src/calculadora.py`, também no site).
- **Puro x Híbrido:** quanto a empresa paga por mês no **Simples puro** (tudo no DAS) e no **Simples híbrido** (CBS e IBS fora do DAS, com débito sobre as vendas menos crédito das compras), de 2027 a 2033.
  - A parte do DAS que vira CBS (PIS+Cofins) e IBS (ICMS/ISS) sai da **tabela de repartição da LC 123** por anexo e faixa, com o teto de 5% de ISS. Não é um percentual chutado.
  - A transição segue a EC 132 e a LC 214. Em 2027–2028 entram a CBS cheia e o IBS de teste de 0,1%. De 2029 a 2032 o ICMS/ISS vira IBS em 10% ao ano, e em 2033 vale a regra final.
  - Campos: anexo (III ou V; a tabela do anexo mostra faixas de RBT12, alíquota nominal e valor a deduzir, destaca a faixa do RBT12 digitado e passa para o Anexo III quando o Fator R é de 28% ou mais), folha (Fator R), alíquotas de CBS e IBS (estimativas editáveis), redução do setor (0, 30 ou 60%), % de vendas B2B, compras com crédito, RBT12, receita e ano.
  - **Histórico mês a mês do RBT12:** você registra o RBT12 real atual (os 12 meses um a um ou só o total, que é dividido pela média) e acrescenta meses reais ou de previsão. O RBT12 de cada mês é a soma dos 12 meses anteriores, então anda sozinho. O crédito que sobra no híbrido passa para o mês seguinte.
  - O site guarda vários históricos (por empresa ou cenário) **no próprio navegador** (localStorage), com exportar e importar em JSON. `python src/calculadora.py` (opções 4 e 5) faz a mesma conta e lê o JSON exportado.
- **Simulador de créditos IBS/CBS:** compara ficar no Simples com pagar IBS/CBS pelo regime regular, mostrando o crédito que o cliente B2B deixa de receber e o crédito das compras não aproveitado. **É uma simulação didática**: alíquota e parcela do DAS são estimativas editáveis, e a regulamentação para o Simples ainda não está definida.
- **Split payment:** explicador interativo (valor da venda → parte do imposto → valor que chega ao vendedor) e 4 registros na base (conceito, caixa, modalidades, início).

**Site online (GitHub Pages):** o workflow `.github/workflows/pages.yml` roda os testes e publica a pasta `web/`. Ative uma vez em *Settings → Pages → Source: GitHub Actions*; o endereço será `https://aurora-siger.github.io/MEI-Sem-Medo/`.

## 6. Agente de IA (Claude com ferramentas)
Além da busca por palavras-chave, o projeto tem um **agente de IA de verdade** (`src/agente.py`): o modelo decide, a cada pergunta, quais ferramentas chamar em até 6 passos: `buscar_base`, `obter_registro`, `listar_temas`, `calcular_das`, `analisar_mei` e `simular_creditos`. Ele pede os dados que faltam antes de calcular e lembra o contexto da conversa (8 turnos).
**Proteções aplicadas em código, não só no prompt:**
- só há resposta se ela citar um registro **realmente recuperado** da base ou usar uma calculadora; caso contrário vira “não sei, confirme em…”;
- citações inventadas são removidas, e a lista de fontes (nome, link, data) vem da base, nunca do modelo;
- avisos automáticos para registros `confirmar` e para valores calculados (estimativas);
- CPF, CNPJ, e-mail e telefone são removidos antes de ir para a API;
- falha de rede, chave ou recusa de segurança não derrubam o app: o site volta para a busca na base.
Limitação: o código verifica que há fonte e que o id existe, mas não checa cada número do texto contra o registro; por isso o prompt exige citar e as respostas são curtas.
**Como usar:**
```
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sua-chave        # Windows PowerShell: $env:ANTHROPIC_API_KEY="sua-chave"
python src/servidor.py                    # abre http://127.0.0.1:8000 com o agente ativo
python src/agente.py                      # ou o agente no terminal
```
O modelo padrão é `claude-opus-5-5` (troque com `MEI_MODELO=claude-sonnet-5-5` para gastar menos). A chave fica só no servidor e o navegador nunca a vê; o servidor limita 20 perguntas por minuto por IP e aceita só a própria origem. **Sem chave, tudo continua funcionando no modo base verificada.** O site publicado no GitHub Pages é estático e usa esse modo; o agente precisa do servidor. Para uso público, coloque o servidor atrás de autenticação e defina um limite de gasto na conta da API.
Testes (sem gastar API, com cliente simulado): `python tests/test_agente.py` e `python tests/test_servidor.py`.

## 7. Como executar
```
python src/sistema.py              # requer só Python 3.8+
python src/sistema.py --modelo B
python tests/testes.py
python tests/paridade.py          # JS x Python (requer node)
python src/calculadora.py        # calculadoras no terminal
```
Comandos: `menu` (tema → assunto), `topicos`, `sair`, ou escreva a pergunta.

## 8. Exemplos
- "Qual o limite de faturamento do MEI?" → resposta M1 + fonte + data.
- "o cliente comprou na internet e quer devolver, pode?" → C3 (arrependimento de 7 dias) + fonte.
- "" → pede para digitar; "?!?! 123" → pede uma pergunta com palavras; "nota fiscal" → pergunta qual assunto; "como tirar passaporte?" → "não sei", indica onde confirmar.

## 9. Clareza, acessibilidade, privacidade e informação não oficial
Linguagem simples, mensagens curtas, interface textual compatível com leitor de tela, menu numerado. Não pede nem guarda dados pessoais (aviso ao iniciar). O histórico de receitas da aba Puro x Híbrido fica salvo só no navegador de quem usa (localStorage) e nunca é enviado a servidor. Apagar os dados do site ou usar janela anônima o perde, então o botão Exportar serve de cópia de segurança. **Não é canal oficial** de Receita, Sebrae ou Procon e não substitui contador; as fontes são Sebrae, Idec e imprensa especializada, não os textos legais.

## 10. Conclusões
Protótipo funcional que responde com fonte, admite limites e navega entre temas. Limitações: busca por palavras exatas, base pequena, regras ainda em mudança (CBS, nota fiscal em 2027, Simples Híbrido; registros R4, R5, R7, R8, M6, S2, S3, S4, A6, K2, K3 e K5 marcados `confirmar`). O simulador puro x híbrido supõe que as tabelas do Simples continuam iguais e aplica a mesma alíquota a todas as vendas. Ele também deixa o IPI do Anexo II dentro do DAS e não trata o sublimite de R$ 3,6 milhões nem empresa com menos de 12 meses de atividade.

## Estrutura
```
src/sistema.py  src/calculadora.py  src/agente.py  src/servidor.py  data/base.json
web/ (index.html, app.js, motor.js, style.css, base.js)  scripts/gerar_web.py
tests/testes.py  tests/paridade.py  tests/test_agente.py  tests/test_servidor.py
docs/uso_ia.md  docs/usabilidade.md  docs/resultados_testes.txt
```
