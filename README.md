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
| Paridade frontend x Python | 34 perguntas + DAS + créditos idênticos (`python tests/paridade.py`) |
Log completo: `docs/resultados_testes.txt`. Facilidade de uso: roteiro em `docs/usabilidade.md` (**ainda precisa ser aplicado com pessoas reais**).
**Interpretação e limites:** 100% reflete um conjunto pequeno escrito pelo próprio grupo, com vocabulário próximo ao da base; não prova o desempenho com usuários reais (ampliar os testes revelou falhas de sinônimos e colisões de palavras-chave (por exemplo, “receita” casando com receita de bolo), já corrigidas). O tempo mede só a busca local.
**Melhorias:** (1) tolerância a erros de digitação e sinônimos (distância de edição); (2) coletar perguntas reais caídas em "não sei" para ampliar a base; (3) revisão periódica dos registros `confirmar`.

## 5. Frontend e calculadoras
- **Frontend web** (`web/index.html`, sem instalação: abra o arquivo no navegador). Abas: Perguntar, Temas, Simples, Créditos e Split payment. Layout para celular, modo escuro, teclado e leitor de tela. O motor de busca em `web/motor.js` é uma porta do `sistema.py`; `python scripts/gerar_web.py` atualiza `web/base.js` depois de editar a base.
- **Simples:** tabela dos 5 anexos (LC 123/2006) e calculadora do DAS com alíquota efetiva e Fator R (`src/calculadora.py`, também no site).
- **Simulador de créditos IBS/CBS:** compara ficar no Simples com pagar IBS/CBS pelo regime regular, mostrando o crédito que o cliente B2B deixa de receber e o crédito das compras não aproveitado. **É uma simulação didática**: alíquota e parcela do DAS são estimativas editáveis, e a regulamentação para o Simples ainda não está definida.
- **Split payment:** explicador interativo (valor da venda → parte do imposto → valor que chega ao vendedor) e 4 registros na base (conceito, caixa, modalidades, início).

## 6. Como executar
```
python src/sistema.py              # requer só Python 3.8+
python src/sistema.py --modelo B
python tests/testes.py
python tests/paridade.py          # JS x Python (requer node)
python src/calculadora.py        # calculadoras no terminal
```
Comandos: `menu` (tema → assunto), `topicos`, `sair`, ou escreva a pergunta.

## 7. Exemplos
- "Qual o limite de faturamento do MEI?" → resposta M1 + fonte + data.
- "o cliente comprou na internet e quer devolver, pode?" → C3 (arrependimento de 7 dias) + fonte.
- "" → pede para digitar; "?!?! 123" → pede uma pergunta com palavras; "nota fiscal" → pergunta qual assunto; "como tirar passaporte?" → "não sei", indica onde confirmar.

## 8. Clareza, acessibilidade, privacidade e informação não oficial
Linguagem simples, mensagens curtas, interface textual compatível com leitor de tela, menu numerado. Não pede nem guarda dados pessoais (aviso ao iniciar). **Não é canal oficial** de Receita, Sebrae ou Procon e não substitui contador; as fontes são Sebrae, Idec e imprensa especializada, não os textos legais.

## 9. Conclusões
Protótipo funcional que responde com fonte, admite limites e navega entre temas. Limitações: busca por palavras exatas, base pequena, regras ainda em mudança (CBS, nota fiscal em 2027, Simples Híbrido; registros R4, R5, R7, R8, M6, S2, S3, S4, A6, K2, K3 e K5 marcados `confirmar`).

## Estrutura
```
src/sistema.py  src/calculadora.py  data/base.json
web/ (index.html, app.js, motor.js, style.css, base.js)  scripts/gerar_web.py
tests/testes.py  tests/paridade.py
docs/uso_ia.md  docs/usabilidade.md  docs/resultados_testes.txt
```
