# MEI sem Medo — Citizen Assist AI (FIAP Global Solution 2026.2)

**Equipe:** _[nome da equipe]_

| Integrante | RM | Turma |
|---|---|---|
| Isabelle Caroline de Camargo Francisco | 572096 | 1CCOB |
| Matheus Lyncoln Souza Dias | 570765 | 1CCOB |
| Mirela Aparecida Bispo Miguel | 570830 | 1CCOB |
| Rodrigo Abrantes Mizerani | 571808 | 1CCOB |
| Vinícius Valiati | 568674 | 1CCOC |

**Vídeo (YouTube, não listado):** _[link]_

## 1. Problema, público e temas
Microempreendedores individuais (MEI) encontram informação dispersa e desatualizada sobre a reforma tributária, obrigações fiscais e vendas ao consumidor. O assistente organiza respostas verificadas e diz quando não sabe.
Temas (9): **abrir** (abrir e formalizar o MEI), **diaadia** (funcionário, sócio, benefícios, DAS atrasado, nota de serviço, alvará), **preco** (formação de preço, markup, ponto de equilíbrio), **reforma** (CBS/IBS, transição, Simples Híbrido), **mei** (DAS, limite, nota fiscal, DASN), **consumidor** (CDC/Procon sob a ótica do comerciante), **split** (split payment), **simples** (categorias/anexos, alíquotas, Fator R) e **creditos** (recuperação de créditos de IBS/CBS).

## 2. Base de conhecimento e busca
- `data/base.json`: 48 registros. Campos obrigatórios: `id`, `tema`, `titulo`, `palavras_chave`, `resposta`, `fonte`, `url`, `verificado`, `confianca` (`alta`/`confirmar`), `relacionados`. Campo opcional `base_legal` (lei e artigo, ex.: “LC 123/2006, art. 18-A”), mostrado ao usuário e devolvido ao agente para ele citar a norma em vez de inventar.
- Para acrescentar ou corrigir uma orientação basta editar o JSON; o código não muda. `carregar()` valida a base e trata arquivo ausente, vazio, JSON inválido, campo faltando, id duplicado e ligação para id inexistente.
- Estruturas: **dicionário** id → registro (acesso por identificador), **lista** por tema (`por_tema`) e **grafo** de tópicos: cada registro lista `relacionados` (122 arestas ligando os 9 temas; ex.: nota fiscal do MEI ↔ nota como prova de compra no CDC ↔ nota na reforma).
- **Busca por palavras-chave com pontuação:** remove acentos e stopwords; palavra-chave = 3 pts, título = 2, corpo = 1, expressão composta = +4. Responde se a melhor pontuação for ≥ 3. Com várias correspondências, mostra a de maior pontuação; se a segunda for de outro tema com ≥ 90% da pontuação, a pergunta é tratada como **ambígua** e o usuário escolhe. Depois da resposta, "Veja também" sugere até 3 vizinhos no grafo.

## 3. Regras de resposta e limitações
Condicionais tratam: vazia, inválida (sem letras, muito curta ou longa), ambígua, sem correspondência e ok. Fora da base: "não sei, confirme em [fonte oficial]", sem inventar. Registros `confirmar` exibem aviso, porque as regras da reforma mudam e as fontes divergem.
**Dois modelos de resposta** (`--modelo A|B`, detalhados em `docs/uso_ia.md`): A = resposta + fonte + data; B = resumo + explicação + fonte + nível de confiabilidade. Comparação: ambos 26/26 completos; B é mais claro para incerteza, A é mais curto.

## 4. Testes e indicadores (`python tests/testes.py`)
| Indicador | Resultado |
|---|---|
| Perguntas de teste | 44 (33 diretas, 3 reformulações, 4 entradas vazias/inválidas, 1 ambígua, 3 fora do tema) |
| Taxa de acerto | 44/44 = **100%** |
| Tempo médio de consulta | ~1 ms (máx. ~1,5 ms) |
| Validação da base | 4/4 falhas simuladas tratadas |
| Paridade frontend x Python | 44 perguntas + preço + DAS + créditos + MEI + 7 cenários puro x híbrido + histórico de 42 meses idênticos (`python tests/paridade.py`) |
Log completo: `docs/resultados_testes.txt`. Facilidade de uso: roteiro em `docs/usabilidade.md` (**ainda precisa ser aplicado com pessoas reais**).
**Interpretação e limites:** 100% reflete um conjunto pequeno escrito pelo próprio grupo, com vocabulário próximo ao da base; não prova o desempenho com usuários reais (ampliar os testes revelou falhas de sinônimos e colisões de palavras-chave (por exemplo, “receita” casando com receita de bolo), já corrigidas). O tempo mede só a busca local.
**Melhorias:** (1) tolerância a erros de digitação e sinônimos (distância de edição); (2) coletar perguntas reais caídas em "não sei" para ampliar a base; (3) revisão periódica dos registros `confirmar`.

## 5. Frontend e calculadoras
- **Frontend web** (`web/index.html`, sem instalação: abra o arquivo no navegador, ou rode `python src/servidor.py`), desenhado para o dono de pequeno negócio. A **landing** abre com a caixa de pergunta (chat com o assistente) e atalhos; abaixo, a seção **Veja na prática** mostra uma captura de tela de cada recurso (conversa, preço, limite do MEI, Simples, puro x híbrido, créditos e split) e a seção **O projeto** explica o desafio Citizen Assist AI. O menu **Ferramentas**, no topo, leva a qualquer calculadora a qualquer momento. **Tema claro e escuro**: segue o sistema e pode ser trocado no botão ◐ (a escolha fica no navegador); o logo tem uma versão para cada tema (`web/img/logo-claro.png` e `logo-escuro.png`). **Calculadoras simplificadas**: cada uma mostra só os campos essenciais (o resto fica em "Ajustar…"), responde primeiro com um número grande e uma frase, e deixa a conta detalhada em "Ver a conta". A simulação mês a mês da reforma fica em "Avançado". Toda calculadora tem o botão **Tirar dúvida com o assistente**, que leva uma pergunta pronta (com o seu resultado, se já houver) para o chat; com a IA ligada o agente usa as ferramentas, e sem ela a busca na base responde. O botão **IA**, no topo, abre a configuração da chave de API (ver seção 6). Layout para celular, teclado e leitor de tela. O motor de busca em `web/motor.js` é uma porta do `sistema.py`; `python scripts/gerar_web.py` atualiza `web/base.js` depois de editar a base.
- **Quanto cobrar? (formação de preço):** produto ou serviço. Para produto, você **monta o custo pelos componentes** (ingrediente, matéria-prima, embalagem, etiqueta): em cada um informa quanto pagou e quantas unidades aquilo rende, e o custo por unidade é a soma. O resultado mostra o peso de cada componente no custo e uma tabela de preço e lucro mensal para margens de 10 a 40%. Método do markup divisor do Sebrae: preço = (custo + gastos fixos rateados pelo volume) ÷ (1 − (taxas + impostos + lucro)). Mostra o preço sugerido, a composição, o **preço mínimo** (lucro zero), o desconto máximo sem prejuízo, o **ponto de equilíbrio** em unidades e, se você informar o preço de hoje, se ele dá lucro. Para serviço calcula o valor da hora (renda desejada + gastos fixos ÷ horas faturáveis). Recusa contas impossíveis (taxas + impostos + lucro ≥ 100%). No MEI use imposto 0 e ponha o DAS nos gastos fixos.
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

**Testes automáticos:** o workflow `.github/workflows/testes.yml` roda os quatro conjuntos de testes a cada push na `main`. O projeto não é publicado online (o agente de IA precisa do servidor local), então o site é usado com `python src/servidor.py`.

## 6. Agente de IA (Claude, Gemini ou OpenRouter, com ferramentas)
Além da busca por palavras-chave, o projeto tem um **agente de IA de verdade** (`src/agente.py`): o modelo decide, a cada pergunta, quais ferramentas chamar em até 6 passos. São **12 ferramentas**, as mesmas calculadoras do site: `buscar_base`, `obter_registro`, `listar_temas`, `calcular_das`, `tabela_anexo`, `analisar_mei`, `formar_preco_produto`, `formar_preco_servico`, `simular_creditos`, `simular_puro_hibrido`, `projetar_meses` e `simular_split_payment`. Ele pede os dados que faltam antes de calcular e lembra o contexto da conversa (8 turnos).
**Proteções aplicadas em código, não só no prompt:**
- só há resposta se ela citar um registro **realmente recuperado** da base ou usar uma calculadora; caso contrário vira “não sei, confirme em…”;
- citações inventadas são removidas, e a lista de fontes (nome, link, data) vem da base, nunca do modelo;
- avisos automáticos para registros `confirmar` e para valores calculados (estimativas);
- CPF, CNPJ, e-mail e telefone são removidos antes de ir para a API;
- falha de rede, chave ou recusa de segurança não derrubam o app: o site volta para a busca na base.
Limitação: o código verifica que há fonte e que o id existe, mas não checa cada número do texto contra o registro; por isso o prompt exige citar e as respostas são curtas.
**Como usar:**
No macOS, abra o Terminal na raiz do projeto (a pasta que contém `requirements.txt` e `src/`) e crie um ambiente virtual para não instalar pacotes no Python do sistema. Se o Terminal estiver na pasta `web/`, primeiro volte uma pasta com `cd ..`:
```
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```
Para iniciar o site, ainda no Terminal e com o ambiente ativado:
```
python src/servidor.py
```
Depois, abra http://127.0.0.1:8000 no navegador. Sem chave de API, o site usa a busca na base verificada. Para habilitar o agente de IA, o jeito mais simples é o botão **IA** no topo do site: escolha o provedor (Gemini, Claude ou OpenRouter), cole a chave de API e salve. A chave fica só no `localStorage` do seu navegador; com o servidor local ela é enviada apenas a ele (a cada pergunta, em cabeçalho HTTP), que fala com o provedor. A IA só funciona com o servidor local; abrir o `index.html` direto no navegador mantém a busca na base e as calculadoras. Se a chamada falhar, o aviso mostra o motivo (por exemplo `HTTP 404` de modelo) e o site volta à busca na base. Outra opção é o arquivo `.env`: `cp .env.example .env`, preencha `GEMINI_API_KEY` (ou `ANTHROPIC_API_KEY`) e rode `python src/servidor.py` (o `.env` já está no `.gitignore`). Também funciona exportar a variável no Terminal antes de iniciar o servidor:
```
export ANTHROPIC_API_KEY="sua-chave"
python src/servidor.py
```
No Windows PowerShell, use `$env:ANTHROPIC_API_KEY="sua-chave"`. Para o Gemini: `export GEMINI_API_KEY="sua-chave"` e `export MEI_PROVEDOR=gemini`. Para usar o agente no terminal, execute `python src/agente.py` com a chave configurada.
**Provedores:** Claude (padrão, modelo `claude-opus-5-5`; troque com `MEI_MODELO=claude-sonnet-5-5` para gastar menos) ou **Gemini** (Google): `GEMINI_API_KEY=... MEI_PROVEDOR=gemini python src/servidor.py`, modelo padrão `gemini-3.8-flash`, configurável com `GEMINI_MODELO`. Ou **OpenRouter**, que dá acesso a modelos de vários fabricantes com uma chave só: `OPENROUTER_API_KEY=... MEI_PROVEDOR=openrouter python src/servidor.py`, modelo padrão `anthropic/claude-sonnet-5.5`, configurável com `OPENROUTER_MODELO` ou no campo **Modelo** do botão IA (use um modelo que aceite ferramentas; a lista está em openrouter.ai/models). No site publicado o OpenRouter também funciona, na versão reduzida sem as ferramentas de cálculo. Sem `MEI_PROVEDOR`, usa o que tiver chave (Claude, depois Gemini, depois OpenRouter). O código dos três está em `src/provedores.py` e o resto do agente (ferramentas, regras, avisos) é o mesmo. **O Gemini foi implementado pela API REST e testado só com respostas simuladas: valide com a sua chave antes de apresentar, e confira o nome do modelo vigente e as regras do plano gratuito (limites de uso e se os dados podem ser usados pelo Google) na documentação do Google AI.** A chave fica só no servidor e o navegador nunca a vê; o servidor limita 20 perguntas por minuto por IP e aceita só a própria origem. **Sem chave, tudo continua funcionando no modo base verificada.**
Testes (sem gastar API, com clientes simulados de Claude, Gemini e OpenRouter): `python tests/test_agente.py` e `python tests/test_servidor.py`.

## 7. Como executar
Os comandos abaixo devem ser executados na pasta do projeto, com o ambiente virtual ativado no macOS (`source .venv/bin/activate`).
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
src/sistema.py  src/calculadora.py  src/agente.py  src/provedores.py  src/servidor.py  data/base.json
web/ (index.html, app.js, motor.js, style.css, base.js, img/)  scripts/gerar_web.py  .env.example
tests/testes.py  tests/paridade.py  tests/test_agente.py  tests/test_servidor.py
docs/uso_ia.md  docs/usabilidade.md  docs/resultados_testes.txt  docs/storytelling.md  docs/pesquisa_usuarios.md
```
